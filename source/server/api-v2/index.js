/// <reference path="../../../typings/index.d.ts"/>
"use strict";

var url = require('url'),
	express = require('express'),
	bodyParser = require('body-parser'),
	swagger = require('swagger-node-express'),
	models = require('./models'),
	regApi = require('./registration'),
	confApi = require('./configuration');


// ======================================================================
// Module Functions

function init(app, apiPath) {
	var api = app;

	if(!apiPath)
		return;

	api = express();
	app.use(apiPath, api);

	// setup body parser
	api.use(bodyParser.json());
	api.use(bodyParser.urlencoded({
		extended: true
	}));

	// remove express specific headers
	api.set('etag', false);
	api.use(function (req, res, next) {
		res.removeHeader("X-Powered-By");
		next();
	});

	// CORS
	// This allows client applications from other domains use the API
	if(config.server.CORS) {
		api.use(function(req, res, next) {
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Headers",
				"Origin, X-Requested-With, Content-Type, Accept");
			//res.header("Access-Control-Allow-Methods", "*");
			res.header("Access-Control-Allow-Methods",
				"OPTIONS, GET, PUT, DELETE");
			next();
		});
	}
	else {
		api.use(function(req, res, next) {
			res.removeHeader("Access-Control-Allow-Origin");
			res.removeHeader("access-Control-Allow-Headers");
			res.removeHeader("Access-Control-Allow-Methods");
			next();
		});
	}

	// configure swagger
	swagger = swagger.createNew(api);
	swagger.addModels(models);
	swagger.configureSwaggerPaths("", "/api-docs", "");
	swagger.setApiInfo({
		title: "DEC112-API v2",
		description: "Backend services for the Deaf Emergency Call 112 service. " +
			"It uses node.js as platform. Requests and responses use HTTP REST "+
			"and are formated as JSON.",
		termsOfServiceUrl: "",
		contact: "richard.prinz@min.at",
		license: "GPLv3",
		licenseUrl: "https://www.gnu.org/licenses/gpl-3.0.en.html"
	});

	// configure 'registration' api
	if(_.get(config, 'api.v2.registration.enabled', false)) {
		swagger.addGet(regApi.check);
		swagger.addPut(regApi.register);
		swagger.addDelete(regApi.unregister);
		swagger.addPost(regApi.verify_phone);
		swagger.addGet(regApi.verify_phone_resend);
		swagger.addPost(regApi.store_data);

		swagger.configureDeclaration('register', {
			description: 'DEC112 registry',
			authorizations : ["none"],
			protocols : ["http"],
			consumes: ['application/json'],
			produces: ['application/json']
		});
	}

	// configure 'configuration' api
	if(_.get(config, 'api.v2.configuration.enabled', false)) {
		swagger.addGet(confApi.get_root);
		swagger.addGet(confApi.configure);

		swagger.configureDeclaration('config', {
			description: 'DEC112 configuration',
			authorizations : ["none"],
			protocols : ["http"],
			consumes: ['application/json'],
			produces: ['application/json']
		});
	}

	// API api_key validator
	swagger.addValidator(
		function validate(req, path, httpMethod) {
			var apiKey = req.headers["api_key"];

			if (!apiKey)
				apiKey = url.parse(req.url, true).query["api_key"];

			if (_.get(config, ['api_keys', apiKey, 'enabled'], false))
				return true;

			tools.logWarning('api_key (' + apiKey + ') rejected');
			return false;
		}
	);

	// must be last swagger config action
	swagger.configure(apiPath, "2.0");

	// configure API error handler
	app.use(apiPath, function(error, req, res, next) {
		if(error) {
			//res.status(500).send('error').end();

			// create response error object
			var e = {};

			if(error.message)
				e.msg = error.message;
			else
				e.msg = error.toString();

			if(config.debug) {
				if(error.stack)
					e.stack = error.stack;
				e.obj = error
			}

			if(error.tag)
				e.tag = error.tag;

			if(error.errorType)
				e.errorType = error.errorType;

			if(error.errorLanguage)
				e.errorLanguage = error.errorLanguage;

			var code = _.get(error, 'code', 500);

			tools.logError('Error: ' + e.msg, e);

			// send back as JSON
			//res.send(JSON.stringify({error: e}));
			//res.json({error: e});

			res.status(code).json({
				'message': e.msg
			});

			// send back as XML
			//res.set('Content-Type', 'text/xml');
			//res.send(tools.createError(e.errorType,
			//	e.msg, e.errorLanguage, false, 0));
		}
		else
			next();
	});
};


// ======================================================================
// Exports

module.exports = {
    init: init
};

