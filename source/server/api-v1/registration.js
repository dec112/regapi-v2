/// <reference path="../../../typings/index.d.ts"/>
"use strict";

var _ = require('lodash'),
	config = require('../config/config'),
	tools = require('../lib/tools'),
	lang = require('./lang').lang,
	swagger = require("swagger-node-express"),
	db = require("../data/queries_v1"),
	nodemailer = require('nodemailer'),
	firmensms = require('firmensms').default;


var mail = nodemailer.createTransport(config.mail);
var sms = new firmensms(config.sms.auth.user, config.sms.auth.pass);
var sms_low_threshold = null;


// ======================================================================
// Module Functions


// ======================================================================
// Swagger API Metadata


// -----------------------------------------------------------------------------
// Device Registry Methods
// -----------------------------------------------------------------------------
var v1_check = {
	spec: {
		method: "GET",
		path: "/devices/check/{device_id}",
		description: "Check state of a device",
		summary: "Returns the current registration state of a device",
		parameters: [
			swagger.pathParam("device_id", "Unique device ID", "string")
		],
		produces: ['application/json'],
		type: "DeviceState",
		errorResponses: [
			swagger.errors.notFound('device_id')
		],
		nickname: "v1_check"
	},
	action: function(req, res, next) {
		tools.logInfo('Check device (' + _.get(req, 'params.device_id', 'null') + ')');
		db.checkDevice(req, res, next, swagger);
	}
};


var v1_register_info = _.template(
	'Register device <%= device_id %>, ' +
	'<%= model %>, <%= owner_name %>, <%= phone_number %>, ' +
	'<%= owner_email %>, <%= lang %>');
var v1_register_sms = _.template(
	'Send verification SMS to (<%= phone_number %>)');
var v1_register_email = _.template(
	'Send verification e-mail to (<%= owner_email %>)');
var v1_normalized_phone = _.template(
	'Normalized phone from (<%= phone %>) to (<%= phone_norm %>)');
var v1_register = {
	spec: {
		method: "PUT",
		path: "/devices/registry",
		description: "Register a new device",
		summary: "Registers a new device",
		parameters: [
			swagger.bodyParam("device", "JSON object of new device", "Device", null, true)
		],
		produces: ['application/json'],
		type: "DeviceState",
		errorResponses: [
			swagger.errors.invalid('device')
		],
		nickname: "v1_register"
	},
	action: function(req, res, next) {
		tools.logInfo(v1_register_info(req.body));

		// check and ensure that some request values are conform
		var phone = _.get(req, 'body.phone_number', null);
		if(phone) {
			// remove all whitespaces and replace leading
			// international prefix '+' with 00
			var phone_norm = phone
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
						config.api.v1.int_phone_prefix);
				}
				// if we dont have a local prefix starting with 0
				else {
					// just prepend the configured intl. prefix
					phone_norm = config.api.v1.int_phone_prefix + phone_norm;
				}
			}
			// ensure that there are always two zeros prefix
			phone_norm = phone_norm.replace(/^0*/, '00');

			tools.logDebug(v1_normalized_phone({
				phone: phone,
				phone_norm: phone_norm
			}));

			req.body.phone_number = phone_norm;
		}

		db.registerDevice(req, res, next, swagger)
			.then(function(result) {

				tools.logDebug('result after DB registerDevice', result);
				if(result.state >= 10)
					return Promise.resolve('do nothing');

				lang.setLocale(req.body.lang);
				tools.logDebug('Request body after DB registration', req.body);

				// send verification sms
				return new Promise(function(resolve, reject) {
					if(_.get(config, 'api.v1.registration.verify_phone.enabled', false)) {
						tools.logInfo(v1_register_sms(req.body));

						var message = {
							to: req.body.phone_number,
							from: 'DEC112',
							text: lang.translate('verify_phone',
								req.body.phone_number,
								_.get(config, 'server.base_url', '') + 'vp?l=' + req.body.lang +
									'&p=' + req.body.phone_number +
									'&t=' + req.body.device_id + '-' +
											req.body.phone_token),
							route: 3
						};
						tools.logDebug('SMS message', message);

						sms.send(message)
							.then(function(response) {
								tools.logDebug('SMS sent', response);
								var low_check = _.get(config, 'sms.warn_below', 0);
								var credits = _.get(response, 'credits', null);
								if(credits && credits < low_check) {
									var low_msg = 'Firmensms credits (' + credits + ') ' +
										'below warning level of (' + low_check + ')';
									tools.logWarning(low_msg);

									// only send low sms credits warning once a day
									var low_warn_date = new Date();
									if(sms_low_threshold != low_warn_date.toDateString()) {
										sms_low_threshold = low_warn_date.toDateString();
										var message = {
											from: '"DEC112 registration service" <service@dec112.at>',
											to: _.get(config, 'sms.warn_email', 'info@dec112.at'),
											subject: 'SMS credits low',
											text: low_msg,
										};
										// fire and forget
										mail.sendMail(message, function(error, response) {
											// if (error) {
											// 	tools.logError('E-mail error', error);
											// 	reject(error);
											// }

											// tools.logDebug('E-mail sent', response);
											// resolve('e-mail sent');
										});
									}
								}
								resolve('sms sent');
							})
							.catch(function(error) {
								tools.logError('SMS error', error);
								reject(error);
							});
					}
					else
						resolve('no sms sent');
				})
				.then(function() {
					// send verification email
					if(_.get(config, 'api.v1.registration.verify_email.enabled', false)) {
						tools.logInfo(v1_register_email(req.body));

						var message = {
							from: '"DEC112 service" <service@dec112.at>',
							to: req.body.owner_email,
							subject: lang.translate('verify_email_subject'),
							text: lang.translate('verify_email',
								req.body.owner_email,
								_.get(config, 'server.base_url', '') + 've?l=' + req.body.lang +
									'&e=' + req.body.owner_email +
									'&t=' + req.body.device_id + '-' +
											req.body.email_token),
							html: lang.translate('verify_email_html',
								req.body.owner_email,
								_.get(config, 'server.base_url', '') + 've?l=' + req.body.lang +
									'&e=' + req.body.owner_email +
									'&t=' + req.body.device_id + '-' +
											req.body.email_token),
						};
						tools.logDebug('E-mail message', message);

						return new Promise(function(resolve, reject) {
							resolve(mail.sendMail(message, function(error, response) {
								if (error) {
									tools.logError('E-mail error', error);
									reject(error);
								}

								tools.logDebug('E-mail sent', response);
								resolve('e-mail sent');
							}));
						});
					}
					else
						return Promise.resolve('no email sent');
				});
			})
			.catch(function (error) {
				tools.logError('Unhandled SMS or e-mail error', error);
			})
	}
};


var v1_unregister = {
	spec: {
		method: "DELETE",
		path: "/devices/registry/{device_id}",
		description: "Unregister device",
		summary: "Unregisters a device from the device registry",
		parameters: [
			swagger.pathParam("device_id", "Unique device ID", "string")
		],
		produces: ['application/json'],
		type: "DeviceState",
		errorResponses: [
			swagger.errors.notFound('device_id')
		],
		nickname: "v1_unregister"
	},
	action: function(req, res, next) {
		tools.logInfo('Unregister device (' + _.get(req, 'params.device_id', 'null') + ')');
		db.unregisterDevice(req, res, next, swagger);
	}
};


// -----------------------------------------------------------------------------
// Configuration Methods
// -----------------------------------------------------------------------------
var v1_configure = {
	spec: {
		method: "GET",
		path: "/devices/configure/{device_id}",
		description: "Configure registered device",
		summary: "Provides configuration parameters for registered devices",
		parameters: [
			swagger.pathParam("device_id", "Unique device ID", "string")
		],
		produces: ['application/json'],
		type: "DeviceConfiguration",
		errorResponses: [
			swagger.errors.notFound('device_id'),
			swagger.errors.invalid('device_id')
		],
		nickname: "v1_configure"
	},
	action: function(req, res, next) {
		tools.logInfo('Configure device (' + _.get(req, 'params.device_id', 'null') + ')');
		db.configureDevice(req, res, next, swagger);
	}
};


// -----------------------------------------------------------------------------
// Verification Methods
// -----------------------------------------------------------------------------
var v1_verifyOwner = {
	spec: {
		method: "GET",
		path: "/v/o",
		description: "Verify owner",
		summary: "Verifies a phone owner token",
		parameters: [
			swagger.queryParam("d", "Unique device ID", "string", true),
			swagger.queryParam("o", "owner token to verify", "string", true)
		],
		produces: ['application/json'],
		type: "DeviceState",
		errorResponses: [
			swagger.errors.notFound('d'),
			swagger.errors.notFound('o'),
			swagger.errors.invalid('o')
		],
		nickname: "v1_verifyOwner"
	},
	action: function(req, res, next) {
		tools.logInfo('Verify owner of device (' + _.get(req, 'query.d', 'null') + ')');
		db.verifyOwner(req, res, next, swagger);
	}
};


var v1_verifyPhone = {
	spec: {
		method: "GET",
		path: "/v/p",
		description: "Verify phone",
		summary: "Verifies a phone number token",
		parameters: [
			swagger.queryParam("d", "Unique device ID", "string", true),
			swagger.queryParam("p", "phone token to verify", "string", true)
		],
		produces: ['application/json'],
		type: "DeviceState",
		errorResponses: [
			swagger.errors.notFound('d'),
			swagger.errors.notFound('p'),
			swagger.errors.invalid('p')
		],
		nickname: "v1_verifyPhone"
	},
	action: function(req, res, next) {
		tools.logInfo('Verify phone number of device (' + _.get(req, 'query.d', 'null') + ')');
		db.verifyPhone(req, res, next, swagger);
	}
};


var v1_verifyEmail = {
	spec: {
		method: "GET",
		path: "/v/e",
		description: "Verify e-mail",
		summary: "Verifies an e-mail token",
		parameters: [
			swagger.queryParam("d", "Unique device ID", "string", true),
			swagger.queryParam("e", "e-mail token to verify", "string", true)
		],
		produces: ['application/json'],
		type: "DeviceState",
		errorResponses: [
			swagger.errors.notFound('d'),
			swagger.errors.notFound('e'),
			swagger.errors.invalid('e')
		],
		nickname: "v1_verifyEmail"
	},
	action: function(req, res, next) {
		tools.logInfo('Verify owner e-mail for device (' + _.get(req, 'query.d', 'null') + ')');
		db.verifyEmail(req, res, next, swagger);
	}
};


// ======================================================================
// Exports

module.exports = {
    v1_check: v1_check,
    v1_register: v1_register,
    v1_unregister: v1_unregister,
    v1_configure: v1_configure,
    v1_verifyOwner: v1_verifyOwner,
    v1_verifyPhone: v1_verifyPhone,
    v1_verifyEmail: v1_verifyEmail
};
