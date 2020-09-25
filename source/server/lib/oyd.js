/// <reference path="../../../typings/index.d.ts"/>
"use strict";

// ============================================================================
// Variables

const rp = require('request-promise');

var client_id = _.get(config, 'oyd.client_id', '');
var client_secret = _.get(config, 'oyd.client_secret', '');


// ============================================================================
// Public Methods

function request_token() {
	const method = 'request_token';
	var options = {
		url: _.get(config, 'oyd.url.oauth', ''),
		method: 'POST',
		json: true,
		form: {
			grant_type: 'client_credentials',
			client_id: client_id,
			client_secret: client_secret
		},
		resolveWithFullResponse: true
	};

	tools.logDebug(method + ': request', options);
	return rp(options)
		.then(function(result) {
			var body = _.get(result, 'body', null);
			tools.logDebug(method + ': result',	body);

			if(result.statusCode != 200)
				throw new Error(`Invalid result code (${result.statusCode})`);

			if(!_.isObjectLike(body))
				throw new Error('Invalid API result');

			if(!body.access_token)
				throw new Error('Invalid or missing access token');

			return {
				token: body.access_token,
				status: result.statusCode
			};
		})
		.catch(function(error) {
			throw new Error(`${method}: ${error.message}`);
		});
}


function register_user(token, phone_number, data) {
	const method = 'register_user';
	var options = {
		url: _.get(config, 'oyd.url.register', ''),
		method: 'POST',
		json: true,
		headers: {
			'Authorization': `Bearer ${token}`
		},
		body: {
			phone_number: phone_number,
			payload: data
		},
		resolveWithFullResponse: true
	};

	tools.logDebug(method + ': request', options);
	return rp(options)
		.then(function(result) {
			var body = _.get(result, 'body', null);
			tools.logDebug(method + ': result',	body);

			if(result.statusCode != 200)
				throw new Error(`Invalid result code (${result.statusCode})`);

			if(!_.isObjectLike(body))
				throw new Error('Invalid API result');

			if(!body.did)
				throw new Error('Invalid or missing DID');

			return {
				token: token,
				phone_number: phone_number,
				data: data,
				did: body.did,
				status: result.statusCode
			}
		})
		.catch(function(error) {
			throw new Error(`${method}: ${error.message}`);
		});
}


function revoke_user(token, phone_number) {
	const method = 'revoke_user';
	var options = {
		url: _.get(config, 'oyd.url.revoke', ''),
		method: 'DELETE',
		json: true,
		headers: {
			'Authorization': `Bearer ${token}`
		},
		body: {
			phone_number: phone_number
		},
		resolveWithFullResponse: true
	};

	tools.logDebug(method + ': request', options);
	return rp(options)
		.then(function(result) {
			var body = _.get(result, 'body', null);
			tools.logDebug(method + ': result',	body);

			// no body content expected
			if(result.statusCode != 204)
				throw new Error(`Invalid result code (${result.statusCode})`);

			return {
				token: token,
				phone_number: phone_number,
				status: result.statusCode
			}
		})
		.catch(function(error) {
			throw new Error(`${method}: ${error.message}`);
		});
}


// ======================================================================
// Exports

module.exports = {
	request_token: request_token,
	register_user: register_user,
	revoke_user: revoke_user
};
