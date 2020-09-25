/// <reference path="../../../typings/index.d.ts"/>
"use strict";

var _ = require('lodash'),
	config = require('../config/config'),
	tools = require('../lib/tools');


// ======================================================================
// Module Functions


// ======================================================================
// Swagger API Metadata


// -----------------------------------------------------------------------------
// Configuration Methods
// -----------------------------------------------------------------------------
var v1_get_root = {
	spec: {
		method: "GET",
		path: "/config/root",
		description: "Get DEC112 root configuration",
		summary: "Returns the current registration state of a device",
		parameters: [
		],
		produces: ['application/json'],
		type: "RootConfig",
		errorResponses: [
		],
		nickname: "v1_get_root"
	},
	action: function(req, res, next) {
        var method = 'getRoot';
        var result = {};
        var start = tools.getHrTime();
        tools.logDebug(method + ' request', req.params);

        var rc = _.get(config, 'api.v1.configuration.root', {});

        result = {
            code: 200,
            root: rc
        };
        tools.logDebug(method + ' response', result);
        if(config.debug)
            result.runtime_ms = tools.elapsedHrTime(start);
        res.status(200)
            .json(result);
	}
};


// ======================================================================
// Exports

module.exports = {
    v1_get_root: v1_get_root,
};

