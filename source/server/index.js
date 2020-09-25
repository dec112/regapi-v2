/// <reference path="../../typings/index.d.ts"/>
"use strict";

// ======================================================================
// Variables

// these modules are global as they are required in every module
global._ = require('lodash');
global.config = require("./config/config");
global.tools = require('./lib/tools');

var	colors = require('colors'),
	lang = require('./lang'),
	path = require('path'),
	fs = require('fs'),
	mkdirp = require('mkdirp'),
	http = require('http'),
	https = require('https'),
    express = require('express'),
	favicon = require('serve-favicon'),
	cons = require('consolidate'),
	serveIndex = require('serve-index'),
	FileStreamRotator = require('file-stream-rotator'),
	logger = require('morgan');

var app = express();


// ======================================================================
// Methods

// configure service
function configure() {
	configureServer();
	configureAPI();
	configureContent();
}

// initialize service/data (if any)
function initialize() {
	tools.logInfo('-'.repeat(79));
	try {
		var pjson = require('./package.json');
		global.APPLICATION = {
			name: pjson.name,
			description: pjson.description,
			version: pjson.version,
			copyright: `Copyright ${pjson.author} 2015-2021`
		}

		tools.logInfo(`${APPLICATION.description} started`);
		tools.logInfo(`${APPLICATION.name}, version ${APPLICATION.version}`);
		tools.logInfo(`${APPLICATION.copyright}`);
		tools.logInfo(`Current configuration (${process.env.NODE_ENV})`);
	}
	catch (err) {
		tools.logInfo('Deaf Emergency Call (DEC112) Registration and Configuration Service started');
		tools.logInfo(`Current configuration (${process.env.NODE_ENV})`);
	}

	//tools.logDebug('effective configuration', config);
}

// configure server parameters
function configureServer() {
	var msg;
	config._rt = _.get(config, '_rt', {});

	// in case of debug, pretty print json
	if(config.debug)
		app.set('json spaces', 2);

	// ----------------------------------------
	// remove express specific headers
	app.set('etag', false);
	app.use(function (req, res, next) {
		res.removeHeader("X-Powered-By");
		next();
	});

	// ----------------------------------------
	// Configure logging.
	if (config.server.log.target === 'file') {
		// File based logging

		// Ensure log directory exists.
		var logPath = _.get(config, 'server.log.path', path.join(__dirname, 'logs'));
		if (!path.isAbsolute(logPath))
			logPath = path.join(__dirname, logPath);
		fs.existsSync(logPath) || mkdirp.sync(logPath);

		// Create a rotating write stream.
		var logStream = FileStreamRotator.getStream({
			date_format: 'YYYYMM',
			filename: path.join(logPath, '/reg-api-%DATE%.log'),
			frequency: 'daily',
			verbose: true
		});

		config._rt['log_path'] = logPath;
		config._rt['log_stream'] = logStream;
	}
	else {
		// Console based logging
		config._rt['log_path'] = null;
		config._rt['log_stream'] = process.stdout;
	}

	if (_.get(config, 'server.log.express', false))
		app.use(logger('combined', { stream: config._rt.log_stream }));

	// ----------------------------------------
	// define favicon for this service/app
	app.use(favicon('favicon.ico'));

	// ----------------------------------------
	// configure http listener
	var http = _.get(config, 'server.http', null);
	if (http) {
		http.options = {}

		// http listen address
		if (!http.listen)
			app.set('http_listen', process.env.HTTP_LISTEN || '0.0.0.0');
		else
			app.set('http_listen', http.listen);

		// listen http TCP port
		if (!http.port)
			app.set('http_port', process.env.HTTP_PORT || 80);
		else
			app.set('http_port', http.port);

		tools.logInfo('http configured - ' +
			(config.server.log.color ? 'enabled'.green : 'enabled'));
	}
	else {
		tools.logInfo('http not configured - ' +
			(config.server.log.color ? 'disabled'.red : 'disabled'));
	}

	// ----------------------------------------
	// configure https listener
	var https = _.get(config, 'server.https', null);
	if (https) {
		if (https.key && https.cert) {
			if (!path.isAbsolute(https.key))
				https.key = path.join(__dirname, https.key);
			if (!fs.existsSync(https.key)) {
				tools.logError('https key ' +
					(config.server.log.color ? https.key.toString().cyan : https.key.toString()) +
					' not found');
				https.key = null;
			}

			if (https.ca) {
				if (!path.isAbsolute(https.ca))
					https.ca = path.join(__dirname, https.ca);
				if (!fs.existsSync(https.ca)) {
					tools.logWarning('https ca certificate ' +
						(config.server.log.color ? https.ca.toString().cyan : https.ca.toString()) +
						' not found');
					https.ca = null;
				}
			}

			if (!path.isAbsolute(https.cert))
				https.cert = path.join(__dirname, https.cert);
			if (!fs.existsSync(https.cert)) {
				tools.logError('https certificate ' +
					(config.server.log.color ? https.cert.toString().cyan : https.cert.toString()) +
					' not found');
				https.cert = null;
			}
		}

		if (https.key && https.cert) {
			https.options = {}
			https.options.key = fs.readFileSync(https.key);
			if (https.ca)
				https.options.ca = fs.readFileSync(https.ca);
			https.options.cert = fs.readFileSync(https.cert);

			// https listen address
			if (!https.listen)
				app.set('https_listen', process.env.HTTPS_LISTEN || '0.0.0.0');
			else
				app.set('https_listen', https.listen);

			// https listen TCP port
			if (!https.port)
				app.set('https_port', process.env.HTTPS_PORT || 443);
			else
				app.set('https_port', https.port);

			tools.logInfo('https configured - ' +
				(config.server.log.color ? 'enabled'.green : 'enabled'));
		}
		else {
			tools.logError('https not valid - ' +
				(config.server.log.color ? 'disabled'.red : 'disabled'));
		}
	}
	else {
		tools.logInfo('https not configured - ' +
			(config.server.log.color ? 'disabled'.red : 'disabled'));
	}
}

// setup service API's
function configureAPI() {
	if(_.get(config, 'api.v1.enabled', false)) {
		var api_v1 = require('./api-v1/index');
		api_v1.init(app, '/api/v1');
	}

	if(_.get(config, 'api.v2.enabled', false)) {
		var api_v2 = require('./api-v2/index');
		api_v2.init(app, '/api/v2');
	}
}

// static and generated content
function configureContent() {
	// template's
	app.engine('html', cons.lodash);
	app.set('view engine', 'html');
	app.set('views', path.join(__dirname, 'views'));

	// main template
	//app.get('/main', function(req, res, next) {
	//	res.render('main', { });
	//});
	// verify e-mail template
	app.get('/ve', function(req, res, next) {
		var email = _.get(req, 'query.e', '');
		var token = _.get(req, 'query.t', '');
		var lang_code = _.get(req, 'query.l', 'en');
		lang_code = (lang.available.includes(lang_code) ? lang_code : lang.available[0]);
		lang.lang.setLocale(lang_code);
		res.render('verify_e', {
			'email': email,
			'token': token,
			'verify_email_text': lang.lang.translate('verify_page_email_text'),
			'verify_email_button': lang.lang.translate('verify_page_email_button'),
			'verify_page_footer': lang.lang.translate('verify_page_footer'),
			'verify_page_email_field': lang.lang.translate('verify_page_email_field'),
			'verify_page_email_token': lang.lang.translate('verify_page_email_token'),
			'verify_page_email_token_placeholder': lang.lang.translate('verify_page_email_token_placeholder'),
			'verify_page_email_token_invalid': lang.lang.translate('verify_page_email_token_invalid')
		});
	});
	// verify phone template
	app.get('/vp', function(req, res, next) {
		var phone = _.get(req, 'query.p', '');
		var token = _.get(req, 'query.t', '');
		var lang_code = _.get(req, 'query.l', 'en');
		lang_code = (lang.available.includes(lang_code) ? lang_code : lang.available[0]);
		lang.lang.setLocale(lang_code);
		res.render('verify_p', {
			'phone': phone,
			'token': token,
			'verify_phone_text': lang.lang.translate('verify_page_phone_text'),
			'verify_phone_button': lang.lang.translate('verify_page_phone_button'),
			'verify_page_footer': lang.lang.translate('verify_page_footer'),
			'verify_page_phone_field': lang.lang.translate('verify_page_phone_field'),
			'verify_page_phone_token': lang.lang.translate('verify_page_phone_token'),
			'verify_page_phone_token_placeholder': lang.lang.translate('verify_page_phone_token_placeholder'),
			'verify_page_phone_token_invalid': lang.lang.translate('verify_page_phone_token_invalid')
		});
	});
	// verify OK template
	app.get('/vok', function(req, res, next) {
		var lang_code = _.get(req, 'query.l', 'en');
		lang_code = (lang.available.includes(lang_code) ? lang_code : lang.available[0]);
		lang.lang.setLocale(lang_code);
		res.render('verify_ok', {
			'verify_page_ok': lang.lang.translate('verify_page_ok')
		});
	});

	// default go to main page
	app.use('/', express.static(path.join(__dirname, 'docs')));

	// remove express specific headers
	app.use(function (req, res, next) {
		res.removeHeader("X-Powered-By");
		next();
	});
}

// start server
function startServer() {
	var https_server = null;
	var http_server = null;

	// start https server (if configured)
	if (_.get(config, 'server.https.options', false)) {
		https_server = https.createServer(config.server.https.options, app);
		var https_port = app.get('https_port');
		https_server.listen(https_port, app.get('https_listen'), function () {
			var addr = https_server.address();
			var addr_str = addr.address.toString() + ':' + addr.port;
			tools.logInfo('Https server listening on ' +
				(config.server.log.color ? addr_str.cyan : addr_str));
		});
	}

	// start http server(if configured)
	if (_.get(config, 'server.http.options', false)) {
		http_server = http.createServer(app);
		var http_port = app.get('http_port');
		http_server.listen(http_port, app.get('http_listen'), function () {
			var addr = http_server.address();
			var addr_str = addr.address.toString() + ':' + addr.port;
			tools.logInfo('Http server listening on ' +
				(config.server.log.color ? addr_str.cyan : addr_str));
		});
	}

	if (!https_server && !http_server)
			tools.logError('HTTP and HTTPS disabled - ' +
					'this server will not respond to any request');
	tools.listIPs();
}


// ======================================================================
// Main

// So the program will not close instantly.
process.stdin.resume();

async function exitHandler(options, err) {

	if(options.cleanup) {
		tools.logInfo('Cleanup ...');
	}

	if (err)
		tools.logError('Exit-Handler', err);

	if (options.exit) {
		tools.logWarning('Stopping server ...');
		process.exit();
	}
}

// Do something when app is closing.
process.on('exit', exitHandler.bind(null, { cleanup: true }));

// Catches ctrl+c event.
process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// Catches "kill pid" (for example: nodemon restart).
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

// Catches uncaught exceptions.
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));

configure();
initialize();
startServer();

