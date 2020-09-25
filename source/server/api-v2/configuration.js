/// <reference path="../../../typings/index.d.ts"/>
"use strict";

var swagger = require("swagger-node-express"),
	db = require("../data/queries_v2");


// ======================================================================
// Module Functions


// ======================================================================
// Swagger API Metadata

var get_root = {
	spec: {
		method: "GET",
		path: "/config/root",
		description: "Get DEC112 root configuration",
		summary: "Returns the global root configuration to reach local registries",
		parameters: [
		],
		produces: ['application/json'],
		type: "RootConfig",
		errorResponses: [
		],
		nickname: "get_root"
	},
	action: function(req, res, next) {
        var method = 'getRoot';
        var result = {};
        var start = tools.getHrTime();
        tools.logDebug(method + ' request', req.params);

        var rc = _.get(config, 'api.v2.configuration.root', {});

        result = {
            root: rc
        };
        tools.logDebug(method + ' response', result);
        if(config.debug)
            result.runtime_ms = tools.elapsedHrTime(start);
        res.status(200).json(result);
	}
};


var configure = {
	spec: {
		method: "GET",
		path: "/config/{reg_id}",
		description: "Get configuration for a registration",
		summary: "Provides configuration parameters (e.g. SIP) for a registration",
		parameters: [
			swagger.pathParam("reg_id", "Unique registration ID", "string")
		],
		produces: ['application/json'],
		type: "Configuration",
		errorResponses: [
			swagger.errors.notFound('reg_id'),
			swagger.errors.invalid('reg_id')
		],
		nickname: "configure"
	},
	action: function(req, res, next) {
		tools.logInfo('Configure registration (' + _.get(req, 'params.reg_id', 'null') + ')');

		var reg_id = _.get(req, 'params.reg_id', null);
		if(!reg_id)
			return next(swagger.errors.notFound('reg_id'));
				
		db.configure(req, res, next, swagger);
	}
};


// ======================================================================
// Exports

module.exports = {
	get_root: get_root,
	configure: configure
};

