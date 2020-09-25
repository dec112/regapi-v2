/// <reference path="../../../typings/index.d.ts"/>
"use strict";

var lang = require('./lang'),
	swagger = require("swagger-node-express"),
	db = require('../data/queries_v2'),
	oyd = require('../lib/oyd');


// ======================================================================
// Module Functions

function send_sms(reg_id, sms_type, lang_code, phone_number, code) {
	var message;

	switch(sms_type) {
		//case 'code':
		default:
			message = {
				to: phone_number,
				from: 'DEC112',
				text: lang.loc.translate('verify_phone_code', phone_number, code),
				route: 3
			}
			break;
	}

	return tools.send_sms(message);
}


// ======================================================================
// Swagger API Metadata

var check = {
	spec: {
		method: "GET",
		path: "/register/{reg_id}",
		description: "Check state of a registration",
		summary: "Returns the current registration state",
		parameters: [
			swagger.pathParam("reg_id", "Unique registration ID", "string")
		],
		produces: ['application/json'],
		type: "RegistrationState",
		errorResponses: [
			swagger.errors.notFound('reg_id'),
			swagger.errors.invalid('reg_id')
		],
		nickname: "check"
	},
	action: function(req, res, next) {
		tools.logInfo('Check registration (' +
			_.get(req, 'params.reg_id', 'null') + ')');

		var reg_id = _.get(req, "params.reg_id", null);
		if(!reg_id)
			return next(swagger.errors.notFound('reg_id'));

		db.check(req, res, next, swagger);
	}
};


var register = {
	spec: {
		method: "POST",
		path: "/register",
		description: "Create new registration",
		summary: "Create new registration",
		parameters: [
			swagger.bodyParam("RegistrationRequest",
				"JSON object of new registration", "RegistrationRequest",
				null, true)
		],
		produces: ['application/json'],
		type: "RegistrationState",
		errorResponses: [
			swagger.errors.notFound('reg_id'),
			swagger.errors.notFound('phone_number'),
			swagger.errors.invalid('RegistrationRequest'),
			swagger.errors.invalid('reg_id')
		],
		nickname: "register"
	},
	action: function(req, res, next) {
		var method = 'register';
		tools.logDebug(method + ': request', {
			params: req.params,
			query: req.query,
			body: req.body
		});

		var bd = _.get(req, 'body', {});
		req.body = bd;

		// If server is configured to verify a registrations phone number
		// check if phone number is provided in registration request
		if(_.get(config, 'api.v2.registration.verify_phone.enabled', false)) {
			if(!bd.phone_number) {
				return next(swagger.errors.notFound('phone_number'));
			}
		}
		else {
			// If server is configured to not verify phone numbers and also to
			// not store phone numbers - ignore provided phone number
			if(_.get(config, 'api.v2.registration.verify_phone.delete_after_verify', false)) {
				bd.phone_number = null;
			}
		}

		bd.model = _.get(bd, 'model', 'unknown');
		bd.lang = _.get(bd, 'lang', lang.available[0]);
		bd.lang = (lang.available.includes(bd.lang) ? bd.lang : lang.available[0]);

		// create registration id
		var reg_id = tools.strRandomUUID();
		bd.reg_id = reg_id;

		tools.logInfo(`Register (${bd.phone_number}), (${bd.lang}), ` +
			`(${bd.model}) as (${bd.reg_id})`);

		if(bd.phone_number) {
			// remove all whitespaces and replace leading
			// international prefix '+' with 00
			var phone_norm = bd.phone_number
				.toString()
				.replace(/\s/g,'')
				.replace(/^\+/, '00');
			// if we dont have an intl. prefix starting with 00
			if(!_.startsWith(phone_norm, '00')) {
				// check if we have a local prefix starting with 0
				if(_.startsWith(phone_norm, '0')) {
					// and replace it with the preconfigured
					// international prefix
					phone_norm = phone_norm.replace(/^0/,
						_.get(config, 'api.v2.int_phone_prefix', ''));
				}
				// if we dont have a local prefix starting with 0
				else {
					// just prepend the configured intl. prefix
					phone_norm = _.get(config, 'api.v2.int_phone_prefix', '') + phone_norm;
				}
			}
			// ensure that there are always two zeros prefix
			phone_norm = phone_norm.replace(/^0*/, '00');

			tools.logDebug(`Normalized phone from (${bd.phone_number}) to (${phone_norm})`);

			bd.phone_number = phone_norm;
		}

		db.register(req, res, next, swagger)
			.then(function(result) {

				tools.logDebug('Result after DB register', result);
				if(result.state >= 10)
					return Promise.resolve('do nothing');

				lang.loc.setLocale(bd.lang);
				tools.logDebug('Request body after DB registration', bd);

				// send verification sms
				return new Promise(function(resolve, reject) {
					if(_.get(config, 'api.v2.registration.verify_phone.enabled', false)) {
						var sms_type = _.get(config,
							'api.v2.registration.verify_phone.type', 'code');

						return send_sms(bd.reg_id, sms_type, bd.lang,
								bd.phone_number, bd.phone_token)
							.then(function() {
								resolve('SMS sent');
							})
							.catch(function(error) {
								tools.logError('SMS error', error);
								reject(error);
							});
					}
					else
						resolve('No SMS sent');
				});
			})
			.catch(function (error) {
				tools.logError('Unhandled SMS error', error);
			});
	}
};


var unregister = {
	spec: {
		method: "DELETE",
		path: "/register/{reg_id}",
		description: "Cancel a registration",
		summary: "Removes a registration from the registry",
		parameters: [
			swagger.pathParam("reg_id", "Unique registration ID", "string"),
			swagger.queryParam("phone_number", "A registrations phone number (optional)", "string")
		],
		produces: ['application/json'],
		type: "EmptyResponse",
		errorResponses: [
			swagger.errors.notFound('reg_id'),
			swagger.errors.invalid('reg_id'),
			swagger.errors.notFound('phone_number')
		],
		nickname: "unregister"
	},
	action: function(req, res, next) {
		var method = 'unregister';
		var api_result = {};
		var start = tools.getHrTime();
		tools.logDebug(method + ': request', {
			params: req.params,
			query: req.query,
			body: req.body
		});
		var reg_id = _.get(req, 'params.reg_id', null);

		tools.logInfo(`Delete registration (${reg_id})`);

		if(!reg_id)
			return next(swagger.errors.notFound('reg_id'));

		// When no phone numbers are stored at RegAPI then phone number must
		// be provided in request. If phone numbers are stored then use phone
		// number from database and ignore phone number in request as it is
		// not required.
		db.get_registration(reg_id)
			.then(function(db_result) {
				tools.logDebug(method + ': registration data',
					db_result);

				if(!db_result.did) {
					return Promise.resolve(db_result);
				}

				//if(_.get(config, 'api.v2.registration.verify_phone.delete_after_verify', false)) {
				if(!db_result.phone_number) {
					db_result.phone_number = _.get(req, "query.phone_number", null);
					if(!db_result.phone_number)
						throw new tools.ErrorEx('', {
							next: swagger.errors.notFound('phone_number')
						});
				}

				tools.logInfo(`Call DID API (revoke) for reg_id (${reg_id}) and ` +
					`phone (${db_result.phone_number})`);

				return oyd.request_token()
					.then(function(oyd_result) {
						tools.logDebug(method + ': result from (DID request token)',
							oyd_result);
						return oyd.revoke_user(oyd_result.token, db_result.phone_number);
					})
					.then(function(oyd_result) {
						tools.logDebug(method + ': result from (DID revoke user)',
						oyd_result);
						return Promise.resolve(db_result);
					})
					.catch(function(error) {
						tools.logError(method + ': DID API failed: ' + error);
					});
			})
			.then(function(db_result) {
				return db.delete_registration(reg_id);
			})
			.then(function(db_result) {
				api_result = {
					reg_id: db_result.reg_id
				};

				if(config.debug)
					api_result.runtime_ms = tools.elapsedHrTime(start);
				tools.logDebug(method + ': response',
					api_result);
				res.status(200).json(api_result);		
			})
			.catch(function(error) {
				if(error.code == 0)
					return next(swagger.errors.invalid('reg_id'));

				var app_next = _.get(error, 'data.next', null);
				if(app_next)
					return next(app_next);

				if(config.debug)
					return next(error);

				return next(new Error(method + ' error'));
			});
	}
};


var verify_phone = {
	spec: {
		method: "POST",
		path: "/register/verify/phone/{reg_id}",
		description: "Verify phone number for a registration",
		summary: "Verifies a registrations phone number",
		parameters: [
			swagger.pathParam("reg_id", "Unique registration ID", "string"),
			swagger.bodyParam("VerifyPhoneRequest",
				"JSON object of phone verification", "VerifyPhoneRequest",
				null, true)
		],
		produces: ['application/json'],
		type: "RegistrationState",
		errorResponses: [
			swagger.errors.notFound('reg_id'),
			swagger.errors.notFound('code'),
			swagger.errors.invalid('reg_id')
		],
		nickname: "verify_phone"
	},
	action: function(req, res, next) {
		tools.logInfo('Verify phone number of registration (' +
			_.get(req, 'params.reg_id', 'null') + ')');

		var reg_id = _.get(req, 'params.reg_id', null);
		if(!reg_id)
			return next(swagger.errors.notFound('reg_id'));

		var phone_token = _.get(req, 'body.code', null);
		if(!phone_token)
			return next(swagger.errors.notFound('code'));

		db.verify_phone(req, res, next, swagger);
	}
};


var verify_phone_resend = {
	spec: {
		method: "GET",
		path: "/register/verify/phone/{reg_id}/resend",
		description: "Resend phone number verification code for a registration",
		summary: "Resend phone number verification code for a registration",
		parameters: [
			swagger.pathParam("reg_id", "Unique registration ID", "string")
		],
		produces: ['application/json'],
		type: "EmptyResponse",
		errorResponses: [
			swagger.errors.notFound('reg_id'),
			swagger.errors.invalid('reg_id')
		],
		nickname: "verify_phone_resend"
	},
	action: function(req, res, next) {
		tools.logInfo('Resend phone verification code for registration (' +
			_.get(req, 'params.reg_id', 'null') + ')');

		var reg_id = _.get(req, "params.reg_id", null);
		if(!reg_id)
			return next(swagger.errors.notFound('reg_id'));

		if(!_.get(config, 'api.v2.registration.verify_phone.enabled', false))
			return next(swagger.errors.invalid('reg_id'));

		db.verify_phone_resend(req, res, next, swagger)
			.then(function(data) {
				tools.logDebug('Data', data);
				if(data.state >= 10)
					return Promise.resolve('do nothing');

				lang.loc.setLocale(data.lang);

				// send verification sms
				return new Promise(function(resolve, reject) {
					var sms_type = _.get(config,
						'api.v2.registration.verify_phone.type', 'code');

					return send_sms(data.reg_id, sms_type, data.lang,
							data.phone_number, data.phone_token)
						.then(function() {
							resolve('SMS sent');
						})
						.catch(function(error) {
							tools.logError('SMS error', error);
							reject(error);
						});
				});
			})
			.catch(function (error) {
				tools.logError('No SMS sent', error);
			});
	}
};


var store_data = {
	spec: {
		method: "POST",
		path: "/register/data/{reg_id}",
		description: "Store additional information for a registration",
		summary: "Store additional information for a registration",
		parameters: [
			swagger.pathParam("reg_id", "Unique registration ID", "string"),
			swagger.bodyParam("StoreDataRequest",
				"JSON object of arbitrary data", "StoreDataRequest",
				null, true)
		],
		produces: ['application/json'],
		type: "StoreDataResponse",
		errorResponses: [
			swagger.errors.notFound('reg_id'),
			swagger.errors.invalid('reg_id'),
			swagger.errors.notFound('phone_number')
		],
		nickname: "store_data"
	},
	action: function(req, res, next) {
		var method = 'store_data';
		var api_result = {};
		var start = tools.getHrTime();
		tools.logDebug(method + ': request', {
			params: req.params,
			body: req.body
		});
		var reg_id = _.get(req, 'params.reg_id', null);
		var data = _.get(req, 'body.data', {});

		tools.logInfo(`Store addition information for registration (${reg_id})`,
			data);

		if(!reg_id)
			return next(swagger.errors.notFound('reg_id'));

		var phone_number;

		// When no phone numbers are stored at RegAPI then phone number must
		// be provided in request. If phone numbers are stored then use phone
		// number from database and ignore phone number in request as it is
		// not required.
		db.get_registration(reg_id)
			.then(function(db_result) {
				tools.logDebug(method + ': registration data',
					db_result);

				if(db_result.state != 10)
					throw new Error('registration (' + reg_id + ') ' +
						'found but verification pending');

				if(db_result.did)
					throw new Error('registration (' + reg_id + ') already ' +
						'contains DID; use DID provider API to modify');

				//if(_.get(config, 'api.v2.registration.verify_phone.delete_after_verify', false)) {
				if(!db_result.phone_number) {
					phone_number = _.get(req, "body.phone_number", null);
					if(!phone_number)
						throw new tools.ErrorEx('', {
							next: swagger.errors.notFound('phone_number')
						});
				}
				else
					phone_number = db_result.phone_number;

				return phone_number;
			})
			.then(function(phone_number) {
				tools.logInfo(`Call DID API (register) for reg_id (${reg_id}) and ` +
					`phone (${phone_number})`);

				return oyd.request_token()
					.then(function(oyd_result) {
						tools.logDebug(method + ': result from (DID request token)',
							oyd_result);
						return oyd.register_user(oyd_result.token, phone_number, data);
					})
					.then(function(oyd_result) {
						tools.logDebug(method + ': result from (DID register user)',
							oyd_result);

						return db.set_did(reg_id, oyd_result.did);
					})
					.then(function(db_result) {
						tools.logDebug(method + ': result from (set DID)',
							db_result);

						api_result = {
							reg_id: reg_id,
							did: db_result.did
						};
		
						if(config.debug)
							api_result.runtime_ms = tools.elapsedHrTime(start);
						tools.logDebug(method + ': response',
							api_result);
						res.status(200).json(api_result);		
					});
			})
			.catch(function(error) {
				if(error.code == 0)
					return next(swagger.errors.invalid('reg_id'));

				var app_next = _.get(error, 'data.next', null);
				if(app_next)
					return next(app_next);

				if(config.debug)
					return next(error);

				return next(new Error(method + ' error'));
			});
	}
};


// ======================================================================
// Exports

module.exports = {
    check: check,
    register: register,
	unregister: unregister,
	verify_phone: verify_phone,
	verify_phone_resend: verify_phone_resend,
	store_data: store_data
};
