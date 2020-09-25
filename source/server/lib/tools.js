/// <reference path="../../../typings/index.d.ts"/>
"use strict";

// ============================================================================
// Variables

var os = require('os'),
	util = require('util'),
	fs = require('fs'),
	http = require('http'),
	sprintf = require('sprintf').sprintf,
	basicAuth = require('basic-auth'),
	nodemailer = require('nodemailer'),
	firmensms = require('firmensms').default;

var mail = nodemailer.createTransport(config.mail);
var sms = new firmensms(config.sms.auth.user, config.sms.auth.pass);
var sms_low_threshold = null;

var LOG_DEBUG = 0;
var LOG_INFO = 1;
var LOG_OK = 2;
var LOG_WARNING = 3;
var LOG_ERROR = 4;

exports.LOG_DEBUG = LOG_DEBUG;
exports.LOG_INFO = LOG_INFO;
exports.LOG_OK = LOG_OK;
exports.LOG_WARNING = LOG_WARNING;
exports.LOG_ERROR = LOG_ERROR;

//var logMode = 0;

var errorTypes = {
	locationValidationUnavailable: 300,

	badRequest: 500,
	internalError: 501,
	serviceSubstitution: 502,
	defaultMappingReturned: 503,
	forbidden: 504,
	notFound: 505,
	loop: 506,
	serviceNotImplemented: 507,
	serverTimeout: 508,
	serverError: 509,
	locationInvalid: 510,
	locationProfileUnrecognized: 511
};

var errorNumbers = {};

// ============================================================================
// Public Methods

function ErrorEx(message, data, fileName, lineNumber) {
	var instance = new Error(message, fileName, lineNumber);
	instance.data = data;

	Object.setPrototypeOf(instance, Object.getPrototypeOf(this));
	if(Error.captureStackTrace) {
		Error.captureStackTrace(instance, ErrorEx);
	}

	return instance;
}
  
ErrorEx.prototype = Object.create(Error.prototype, {
	constructor: {
		value: Error,
		enumerable: false,
		writable: true,
		configurable: true
	}
});

if(typeof Object.setPrototypeOf != 'undefined') {
	Object.setPrototypeOf(ErrorEx, Error);
} else {
	ErrorEx.__proto__ = Error;
}

exports.ErrorEx = ErrorEx;

function quoteXML(value) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
};

/**
 * Simple basic auth middleware for use with Express 4.x.
 *
 * @example
 * app.use('/api-requiring-auth', utils.basicAuth('username', 'password'));
 *
 * @param   {string}   username Expected username
 * @param   {string}   password Expected password
 * @returns {function} Express 4 middleware requiring the given credentials
 */
exports.basicAuth = function(username, password) {
  return function(req, res, next) {
    var user = basicAuth(req);

    if (!user || user.name !== username || user.pass !== password) {
      res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
      return res.sendStatus(401);
    }

    next();
  };
};

/*
exports.setLogMode = function(mode) {
	var self = this;

	// 0 - normal, 1 - debug, 2 - quiet
	self.logMode = (mode ? mode : 0);
	if(!self.isInt(self.logMode))
		self.logMode = 0;
	self.logMode = Math.abs(self.logMode);
	if(self.logMode < 0 || self.logMode > 2)
		self.logMode = 0;
};
*/

exports.callOrThrow = function(message, tag, callback) {
	var error = new Error(message);
	error.tag = tag;
	if(callback)
		callback(error);
	else
		throw error;
};

exports.get = function(obj, key) {
    return key.split('.').reduce(function(o, x) {
        return (typeof o == 'undefined' || o === null) ? o : o[x];
    }, obj);
};

exports.has = function(obj, key) {
    return key.split('.').every(function(x) {
        if(typeof obj != 'object' || obj === null || ! x in obj)
            return false;
        obj = obj[x];
        return true;
    });
};

exports.inspect = function(obj, depth) {
	var self = this;
	if(!self.isInt(depth))
		depth = 2;
	console.log(util.inspect(obj, { showHidden: true, depth: depth, colors: true }));
};

// list all available network interfaces on console
exports.listIPs = function() {
	var ifaces = os.networkInterfaces();

	Object.keys(ifaces).forEach(function(ifname) {
		var alias = 0;

		ifaces[ifname].forEach(function(iface) {
			exports.logInfo(sprintf('%-40s %6s   %s',
				sprintf('%s:%d%s', ifname, alias, (iface.internal ? '*' : '')),
				iface.family,
				(config.server.log.color ? iface.address.cyan : iface.address)));

			alias++;
		});
	});
};

exports.getHrTime = function() {
	return process.hrtime();
};

exports.elapsedHrTime = function(startedAt) {
    var diff = process.hrtime(startedAt);
	var elapsedMs = (diff[0] * 1e9 + diff[1]) / 1000000;

	return elapsedMs.toFixed(5);
};

/**
 * Downloads content via http request
 *
 * @param {String} url The url of the resource to download.
 * @param {String} dest The destination where to write the content to.
 * @param {Integer} timeOut Timeout in milliseconds after which to abort the
 *        download in case of inactivity.
 * @param {Function} cb Callback in case of error or success. Parameter are:
 *        error: undefined if success otherwise contains additional
 *        error informations.
 *        duration: the duration in seconds it took to download the resource.
 *        contentLength: the length of the downloaded content in bytes.
 */
exports.download = function(url, dest, timeOut, cb) {
	var self = this;
	var timing = new Date();
	var contentLength = 0;

	var req = http.get(url, function(res) {
		if(res.headers['transfer-encoding'] === 'chunked') {
			res.on('data', function(chunk) {
				contentLength += chunk.length;
			})
		}
		else
			contentLength = res.headers['content-length'];

		if(res.statusCode === 200) {
			var file = fs.createWriteStream(dest);
			res.pipe(file);
			file
				.on('finish', function() {
					file.close();

					var duration = (new Date() - timing) / 1000;

					if(cb)
						cb(undefined, duration, contentLength)
				})
				.on('error', function(error) {
					if(cb)
						cb(error);
				});
		}
		else {
			if(cb)
				cb(res.statusCode);
		}
	})
	.on('error', function(error) {
		fs.unlink(dest);
		if(cb)
			cb(error);
	});

    // timeout.
	if(timeOut === undefined)
		timeOut = 12000;
	if(timeOut > 0)
		req.setTimeout(timeOut, function() {
			req.abort();
		});
};

/**
 * Logs text to the console using a [DBG] prefix in dark grey colour and
 * optionally an objects properties
 *
 * @param {String} message Optional message to display on console
 * @param {Object} object Optional object who's properties should be
 *        displayed under the message text
 * @param {Boolean} logTime Optional Whether or not to display a time stamp
 *        in the log entry
 */
exports.logDebug = function(message, object, logTime, eolMode) {
	var self = this;
	if(typeof logTime === 'undefined')
		logTime = true;
	self.log(LOG_DEBUG, logTime, message, object, eolMode);
}

/**
 * Logs text to the console using a [INF] prefix in white and
 * optionally an objects properties
 *
 * @param {String} message Optional message to display on console
 * @param {Object} object Optional object who's properties should be
 *        displayed under the message text
 * @param {Boolean} logTime Optional Whether or not to display a time stamp
 *        in the log entry
 */
exports.logInfo = function(message, object, logTime, eolMode) {
	var self = this;
	if(typeof logTime === 'undefined')
		logTime = true;
	self.log(LOG_INFO, logTime, message, object, eolMode);
}

/**
 * Logs text to the console using a [OK ] prefix in green colour and
 * optionally an objects properties
 *
 * @param {String} message Optional message to display on console
 * @param {Object} object Optional object who's properties should be
 *        displayed under the message text
 * @param {Boolean} logTime Optional Whether or not to display a time stamp
 *        in the log entry
 */
exports.logOK = function(message, object, logTime, eolMode) {
	var self = this;
	if(typeof logTime === 'undefined')
		logTime = true;
	self.log(LOG_OK, logTime, message, object, eolMode);
}

/**
 * Logs text to the console using a [WRN] prefix in yellow and
 * optionally an objects properties
 *
 * @param {String} message Optional message to display on console
 * @param {Object} object Optional object who's properties should be
 *        displayed under the message text
 * @param {Boolean} logTime Optional Whether or not to display a time stamp
 *        in the log entry
 */
exports.logWarning = function(message, object, logTime, eolMode) {
	var self = this;
	if(typeof logTime === 'undefined')
		logTime = true;
	self.log(LOG_WARNING, logTime, message, object, eolMode);
}

/**
 * Logs text to the console using a [ERR] prefix in red colour and
 * optionally an objects properties
 *
 * @param {String} message Optional message to display on console
 * @param {Object} object Optional object who's properties should be
 *        displayed under the message text
 * @param {Boolean} logTime Optional Whether or not to display a time stamp
 *        in the log entry
 */
exports.logError = function(message, object, logTime, eolMode) {
	var self = this;
	if(typeof logTime === 'undefined')
		logTime = true;
	self.log(LOG_ERROR, logTime, message, object, eolMode);
}

/**
 * Logs text to the console using a selectable prefix and colour and
 * optionally an objects properties
 *
 * @param {Integer} severity Selects how a message should be displayed.
 *        See also the LOG_* constants.
 *              LOG_DEBUG = 0
 *              LOG_INFO = 1
 *              LOG_OK = 2
 *              LOG_WARNING = 3
 *              LOG_ERROR = 4
 * @param {Boolean} logTime Optional Whether or not to display a time stamp
 *        in the log entry
 * @param {String} message Optional message to display on console
 * @param {Object} object Optional object who's properties should be
 *        displayed under the message text
 * @param {Integer} eolMode Specifies the end of line type after printing
 *        the message.
 *              0 - normal, new line
 *              1 - stay on same line, no new line
 *              2 - stay on same line, go back to beginning of line
 */
exports.log = function(severity, logTime, message, object, eolMode) {
	//var self = this;
	var ts = '';
	var w;
	var eol;
	var msg = '';
	var stream = process.stdout;

	if (config.quiet)
		return;

	var cfg_ls = _.get(config, '_rt.log_stream', null);
	if (cfg_ls)
		stream = cfg_ls;

	switch(eolMode) {
		case 1:
			eol = '';
			break;
		case 2:
			eol = (process.platform == 'win32' || process.platform == 'win64' ?
					'\u001B[0G' : '\r');
			break;
		default:
			eol = os.EOL;
			break;
	}

	if(logTime === true) {
		var now = new Date();
		ts = sprintf(' %04d%02d%02d %02d%02d%02d.%03d',
			now.getFullYear(),
			now.getMonth() + 1,
			now.getDate(),
			now.getHours(),
			now.getMinutes(),
			now.getSeconds(),
			now.getMilliseconds());
	}

	switch(severity) {
		case LOG_DEBUG:
			if(config.debug) {
				w = '[DBG' + ts + '] ';
				msg = (config.server.log.color ? w.grey : w) + message + eol;
			}
			break;
		case LOG_OK:
			w = '[OK ' + ts + '] ';
			msg = (config.server.log.color ? w.green : w) + message + eol;
			break;
		case LOG_WARNING:
			w = '[WRN' + ts + '] ';
			msg = (config.server.log.color ? w.yellow : w) + message + eol;
			break;
		case LOG_ERROR:
			w = '[ERR' + ts + '] ';
			msg = (config.server.log.color ? w.red : w) + message + eol;
			break;
		default:
			w = '[INF' + ts + '] ';
			msg = (config.server.log.color ? w.white : w) + message + eol;
			break;
	}
	stream.write(msg);

	if(object && (severity != LOG_DEBUG || (severity == LOG_DEBUG && config.debug))) {
		var obj;
		if(exports.isString(object)) {
			obj = '     ' + object;
		}
		else {
			// Use a custom replacer to handle circular references
			// Note: cache should not be re-used by repeated calls to
			// JSON.stringify.
			var cache = [];
			obj = '     ' + JSON.stringify(object, function(key, value) {
				if (typeof value === 'object' && value !== null) {
					if (cache.indexOf(value) !== -1) {
						// Circular reference found, discard key
						return;
					}
					// Store value in our collection
					cache.push(value);
				}
				return value;
			}, 2);
			// Enable garbage collection
			cache = null;
		}
		obj = obj.replace(/\n/g, eol + '     ');
		obj = obj + eol;

		stream.write(obj);
	}
}

exports.isInt = function(i_int) {
	var i = parseInt(i_int);
	if (isNaN(i))
		return false;
	return i_int == i && i_int.toString() == i.toString();
}

/**
 * Returns the javascript object type of the given object as string.
 *
 * @param {object} obj The object to get the typeinfo from.
 * @return {string} Objects type as string.
 */
exports.realTypeOf = function(obj) {
	return Object.prototype.toString.call(obj).slice(8, -1);
}

/**
 * Returns the class name of the argument or undefined if
 * it's not a valid JavaScript object.
 *
 * @param {object} obj The object to get the classname from.
 * @return {string} Objects class name as string.
*/
exports.getObjectClass = function(obj) {
	if (obj && obj.constructor && obj.constructor.toString) {
		var arr = obj.constructor.toString().match(/function\s*(\w+)/);

		if (arr && arr.length == 2) {
			return arr[1];
		}
	}

	return undefined;
}

/**
 * Checks if the given string is null/undefined or empty ''.
 *
 * @param {string} s_str String to check.
 * @return {boolean} True if string is undefined or has length 0
 */
exports.isNullOrEmpty = function(s_str) {
	return !s_str || s_str == '';
}

/**
 * Checks if the given object is empty ie. {}
 *
 * @param {object} obj The object to check.
 * @return {boolean} True if object is {} has no own properties
 */
exports.isEmptyObject = function(obj) {
    return Object.keys(obj).length === 0;
}

/**
 * Checks if the given object is of type string.
 *
 * @param {object} o_str Object to check.
 * @return {boolean} True if object was a string object.
 */
exports.isString = function(o_str) {
	return (o_str instanceof String || typeof o_str == 'string');
}

/**
 * Check if the given object is an integer.
 *
 * @param {number} i_int Object to check.
 * @return {boolean} True if object was an integer object.
 */
exports.isInt = function(i_int) {
	var i = parseInt(i_int);
	if(isNaN(i))
		return false;
	return i_int == i && i_int.toString() == i.toString();
}

/**
 * Finds a string inside another string before a given position and returns
 * the position where it was found or -1 otherwise.
 *
 * @param {string} s_str String which should be searched inside.
 * @param {number} i_len Position after which schould not be searched.
 * @param {string} s_substr String which should be found.
 * @return {number} Character Position of found string or -1 if not found.
 */
exports.indexOf = function(s_str, i_len, s_substr) {
	var i_ret = -1;

	if(s_str && s_substr)
		i_ret = s_str.indexOf(s_substr);

	return i_ret < i_len ? i_ret : -1;
}

/**
 * Check if a given string ends with another string.
 *
 * @param {string} s_str String to test.
 * @param {string} s_suffix String with other string must end.
 * @return {boolean} True if s_str ends with s_suffix.
 */
exports.endsWith = function(s_str, s_suffix) {
	return s_str.indexOf(s_suffix, s_str.length - s_suffix.length) !== -1;
}

/**
 * Removes html tags from string.
 *
 * @param {string} s_str String to clear.
 */
exports.clearHtml = function(s_str) {
	if(this.isNullOrEmpty(s_str))
		return '';
	//return $(s_str).text();
	return s_str.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>?/gi, '');
}

/**
 * Check if a string contains another string.
 *
 * @param {string} s_str
 * @param {number} i_len
 * @param {string} s_substr
 * @return {boolean}
 */
exports.contains = function(s_str, i_len, s_substr) {
	return this.indexOf(s_str, i_len, s_substr) >= 0;
}

/**
 * @param {string} s_str
 * @param {string} c_lquote
 * @param {string} c_rquote
 * @return {string}
 */
exports.unquote = function(s_str, c_lquote, c_rquote) {
	var s_ret = s_str;

	if(s_ret) {
		var i_len = s_ret.length;

		if(i_len >= 2 && s_ret[0] == c_lquote && s_ret[i_len - 1] == c_rquote)
			s_ret = s_str.substring(1, i_len - 1);
	}

	return s_ret;
}

/**
 * @param {string} s_str
 * @return {string}
 */
exports.unquote2 = function(s_str) {
	return this.unquote(s_str, "\"", "\"");
}

/**
 * @param {string} s_str
 * @return {string}
 */
exports.strdup = function(s_str) {
	if(s_str)
		return new String(s_str).toString();

	return s_str;
}

// this.strformat(s_format, ...)
/**
 * @param {string} s_str
 * @param {object=} o_params
 * @return {string}
 */
exports.strformat = function(s_str) {
	for(var i = 1; i < arguments.length; i++) {
		var regexp = new RegExp('\\{' + (i - 1) + '\\}', 'gi');
		s_str = s_str.replace(regexp, arguments[i]);
	}

	return s_str;
}

/**
 * @param {string} template A template string containing zero or more <%=xyz%>
						placeholders.
 * @param {object=} values An optional object providing values for placeholders.
 * @param {boolean=} keepUnknown True to keep unknown placeholders,
 *						False to replace them with the empty string ''
 * @return {string} A string in which all placeholders are replaced with their
						corresponding values from the values object.
 */
exports.strTemplate = function(template, values, keepUnknown) {
	if(this.isNullOrEmpty(template))
		return '';

	if(values) {
		template = template.replace(/<%\s*=\s*(\w[\w\d]*)\s*%>/g, function(g0, g1) {
			return values[g1] || (keepUnknown == true ? g0 : '');
		});
	}

	return template;
}

/**
 * @param {string} s_1
 * @param {string} s_2
 * @return {boolean}
 */
exports.streq = function(s_1, s_2) {
	return (s_1 == s_2);
}

/**
 * @param {string} s_1
 * @param {string} s_2
 * @return {boolean}
 */
exports.strieq = function(s_1, s_2) {
	if (s_1 && s_2)
		return s_1.toLowerCase() == s_2.toLowerCase();

	return (s_1 == s_2);
}

/**
 * @param {number} i_length
 * @param {string} s_dict
 * @return {string}
 */
exports.strRandomFromDict = function(i_length, s_dict) {
	var s_ret = "";

	for (var i = 0; i < i_length; i++)
		s_ret += s_dict[Math.floor(Math.random() * s_dict.length)];

	return s_ret;
}

/**
 * @param {number} i_length
 * @return {string}
 */
exports.strRandom = function(i_length) {
	var s_dict = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";

	return this.strRandomFromDict(i_length, s_dict);
}

/**
 * @return {string}
 */
exports.strRandomUUID = function() {
	// e.g. 6ba7b810-9dad-11d1-80b4-00c04fd430c8
	var s_dict = "0123456789abcdef";
	return this.strformat("{0}-{1}-{2}-{3}-{4}",
			this.strRandomFromDict(8, s_dict),
			this.strRandomFromDict(4, s_dict),
			this.strRandomFromDict(4, s_dict),
			this.strRandomFromDict(4, s_dict),
			this.strRandomFromDict(12, s_dict));
}

exports.strRandomCode = function(i_length) {
	// e.g. 4711-0816
	if(!i_length)
		i_length = 3;
	var s_dict = "0123456789";
	return this.strformat("{0}-{1}",
			this.strRandomFromDict(i_length, s_dict),
			this.strRandomFromDict(i_length, s_dict));
}

/**
 * s_url: <scheme>://<host>:<port>/<dir>
 * <dir> is optional
 * s_url: udp://192.168.0.10:8545/ws
 * @param {string} s_url
 * @return {?array} array is succeed or null otherwise
 */
exports.strParseUrl = function(s_url) {
	if (!s_url)
		return null;

	var i_0 = s_url.indexOf("://");
	var i_1 = s_url.lastIndexOf(":");
	if (i_0 == -1 || i_1 == -1)
		return null;

	var ao_params = new Array();
	ao_params.push(s_url.substring(0, i_0));
	ao_params.push(s_url.substring((i_0 + 3), i_1));

	try {
		var i_3 = s_url.substring(i_0 + 3).indexOf("/");
		if (i_3 == -1) {
			ao_params.push(parseInt(s_url.substring(i_1 + 1), 10));
		}
		else {
			ao_params.push(parseInt(s_url.substring(i_1 + 1, i_3 + i_0 + 3), 10));
			ao_params.push(s_url.substring(i_3 + i_0 + 3 + 1));
		}
	}
	catch (e) {
		return null;
	}

	return ao_params;
}

exports.send_sms = function(message) {
	tools.logDebug('SMS message', message);

	return sms.send(message)
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
			return response;
		});
}
