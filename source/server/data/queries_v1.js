/// <reference path="../../../typings/index.d.ts"/>
"use strict";

var database = require('./database'),
    moment = require('moment'),
	lang = require('../api-v1/lang');

var db = database.db;
var SCHEMA = database.SCHEMA;


// ======================================================================
// Query Functions

// Check state for a device
function checkDevice(req, res, next, swagger) {
    var method = 'checkDevice';
    var result = {};
    var start = tools.getHrTime();
    tools.logDebug(method + ' request', req.params);

    var device_id = _.get(req, "params.device_id", null);
    if(!device_id)
        return next(swagger.errors.notFound('device_id'));
    return db.one('SELECT * FROM ' + SCHEMA + 'devices ' +
            'WHERE device_id = $1', device_id)
        .then(function (data) {
            tools.logDebug(method + ' data', data);
            result = {
                code: 200,
                device_id: device_id,
                //device_did: data.id,
                lang: data.lang,
                state: data.state,
                owner_verified: data.owner_verified_ts,
                phone_verified: data.phone_verified_ts,
                email_verified: data.email_verified_ts,
                device_registered: data.registration_ts
            };
            tools.logDebug(method + ' response', result);
            if(config.debug)
                result.runtime_ms = tools.elapsedHrTime(start);
            res.status(200).json(result);
            return result;
        })
        .catch(function(error) {
            // If no device entry found respond with OK and state 0 for
            // possible new device
            if(error.code == 0) {
                result = {
                    code: 200,
                    device_id: device_id,
                    state: 0,
                    owner_verified: null,
                    phone_verified: null,
                    email_verified: null,
                    device_registered: null
                };
                tools.logDebug(method + ' response', result);
                if(config.debug)
                    result.runtime_ms = tools.elapsedHrTime(start);
                res.status(200).json(result);
                return result;
            }
            else {
                tools.logError(method + ' error ' + error, error);
                if(config.debug)
                    return next(error);
                else
                    return next(new Error(method + ' error'));
            }
        });
}


// Register a new device
function registerDevice(req, res, next, swagger) {
    var method = 'registerDevice';
    var result = {};
    var start = tools.getHrTime();
    tools.logDebug(method + ' request', req.body);

    var device = req.body;
    if(!device.model)
        device.model = 'unknown';
    device.lang = (lang.available.includes(device.lang) ? device.lang : lang.available[0]);
    device.owner_token = (config.api.v1.registration.verify_owner.enabled ? tools.strRandom(8) : 'IGNORED');
    device.phone_token = (config.api.v1.registration.verify_phone.enabled ? tools.strRandom(8) : 'IGNORED');
    device.email_token = (config.api.v1.registration.verify_email.enabled ? tools.strRandom(8) : 'IGNORED');
    device.registration_ts = moment();


    return db.oneOrNone('SELECT * FROM ' + SCHEMA + 'devices ' +
            'WHERE device_id = $1', device.device_id)
        .then(function (data) {
            if(data && data.state >= 10) {
                // if already at state 10 (= fully registered) do nothing
                tools.logInfo('Device (' + data.device_id + ') already fully ' +
                    'registered - do nothing', data);
                req.params['device_id'] = data.device_id;
                return checkDevice(req, res, next, swagger);
            }
            else {
                // otherwise register or re-register device
                if(data && data.state > 0)
                   tools.logInfo('Device (' + data.device_id + ') registration ' +
                       'pending - reregister', data);
                return db.none('INSERT INTO ' + SCHEMA + 'devices ' +
                        '(device_id, model, lang, state, phone_number, ' +
                            'owner_name, owner_address, owner_email, ' +
                            'owner_token, phone_token, email_token, ' +
                            'registration_ts, kamailio_id)' +
                        'VALUES (${device_id}, ${model}, ${lang}, 1, ' +
                            '${phone_number}, ' +
                            '${owner_name}, ${owner_address}, ${owner_email}, ' +
                            '${owner_token}, ${phone_token}, ${email_token}, ' +
                            '${registration_ts}, NULL) ' +
                        'ON CONFLICT (device_id) DO UPDATE ' +
                            'SET device_id = EXCLUDED.device_id, ' +
                                'model = EXCLUDED.model,' +
                                'lang = EXCLUDED.lang,' +
                                'state = EXCLUDED.state,' +
                                'phone_number = EXCLUDED.phone_number,' +
                                'owner_name = EXCLUDED.owner_name,' +
                                'owner_address = EXCLUDED.owner_address,' +
                                'owner_email = EXCLUDED.owner_email,' +
                                'owner_token = EXCLUDED.owner_token,' +
                                'owner_verified_ts = NULL,' +
                                'phone_token = EXCLUDED.phone_token,' +
                                'phone_verified_ts = NULL,' +
                                'email_token = EXCLUDED.email_token,' +
                                'email_verified_ts = NULL,' +
                                'registration_ts = EXCLUDED.registration_ts, ' +
                                'kamailio_id = NULL',
                                device)
                    .then(function () {
                        // call standard checkDevice method to return
                        // DeviceSate object
                        req.params['device_id'] = device.device_id;
                        return checkDevice(req, res, next, swagger);
                    })
                    .catch(function(error) {
                        if(error.code == 23505)
                            return next(swagger.errors.invalid('device'));
                        else {
                            tools.logError(method + ' error ' + error, error);
                            if(config.debug)
                                return next(error);
                            else
                                return next(new Error(method + ' error'));
                        }
                    });
            }
        });
}


// Unregisters a device (sets its state to 0)
function unregisterDevice(req, res, next, swagger) {
    var method = 'unregisterDevice';
    var result = {};
    var start = tools.getHrTime();
    var sql = '';
    tools.logDebug(method + ' request', req.params);

    var device_id = _.get(req, 'params.device_id', null);
    if(!device_id)
        return next(swagger.errors.notFound('device_id'));
    if(config.api.v1.registration.delete_unregistered)
        sql = 'DELETE FROM ' + SCHEMA + 'devices ' +
            'WHERE device_id = $1';
    else
        sql = 'UPDATE ' + SCHEMA + 'devices ' +
            'SET state = 0, ' +
                'owner_token = NULL, owner_verified_ts = NULL, ' +
                'phone_token = NULL, phone_verified_ts = NULL, ' +
                'email_token = NULL, email_verified_ts = NULL, ' +
                'registration_ts = NULL, ' +
                'kamailio_id = NULL ' +
            'WHERE device_id = $1';
    db.none(sql, device_id)
        .then(function () {
            result = {
                code: 200,
                device_id: device_id,
                state: 0,
                owner_verified: null,
                phone_verified: null,
                email_verified: null,
                device_registered: null
            };
            tools.logDebug(method + ' response', result);
            if(config.debug)
                result.runtime_ms = tools.elapsedHrTime(start);
            res.status(200)
                .json(result);
        })
        .catch(function(error) {
            // If no device found just answer with OK, state = 0
            if(error.code == 0) {
                result = {
                    code: 200,
                    device_id: device_id,
                    state: 0,
                    owner_verified: null,
                    phone_verified: null,
                    email_verified: null,
                    device_registered: null
                };
                tools.logDebug(method + ' response', result);
                if(config.debug)
                    result.runtime_ms = tools.elapsedHrTime(start);
                res.status(200)
                    .json(result);
            }
            else {
                tools.logError(method + ' error ' + error, error);
                if(config.debug)
                    return next(error);
                else
                    return next(new Error(method + ' error'));
            }
        });
}


// Provides device configuration parameters
function configureDevice(req, res, next, swagger) {
    var method = 'configureDevice';
    var result = {};
    var start = tools.getHrTime();
    var sql = '';
    tools.logDebug(method + ' request', req.params);

    var device_id = _.get(req, 'params.device_id', null);
    if(!device_id)
        //return next(swagger.errors.notFound('device_id'));
        return next(new Error(method + ' device_id missing in request'));

    return db.one('SELECT * FROM ' + SCHEMA + 'devices ' +
            'WHERE device_id = $1', device_id)
        .then(function (data) {
            tools.logDebug(method + ' data', data);
            if(data.state != 10)
                //return next(swagger.errors.invalid('device_id'));
                return next(new Error(method + ' device (' + device_id + ') ' +
                    'registered but verification pending'));

            return db.one('SELECT * FROM ' + SCHEMA + 'subscriber ' +
                    'WHERE id = $1', data.kamailio_id)
                .then(function (data) {
                    tools.logDebug(method + ' subscriber data', data);

                    result = {
                        code: 200,
                        device_id: device_id,
                        server: config.api.v1.configuration.kamailio.ws,
                        publicId: "sip:" + data.username + "@" + config.api.v1.configuration.kamailio.domain,
                        privateId: data.username,
                        password: data.password,
                        realm: data.domain,
                        services: config.api.v1.configuration.kamailio.services
                    };
                    tools.logDebug(method + ' response', result);
                    if(config.debug)
                        result.runtime_ms = tools.elapsedHrTime(start);
                    res.status(200)
                        .json(result);
                });
        })
        .catch(function(error) {
            tools.logError(method + ' error ' + error, error);
            if(error.code == 0) {
                return next(new Error(
                    method + ' device (' + device_id + ') ' +
                        'not registered'));
            }
            else {
                if(config.debug)
                    return next(error);
                else
                    return next(new Error(method + ' error'));
            }
        });
}


// Verify owner token
function verifyOwner(req, res, next, swagger) {
    var method = 'verifyOwner';
    var result = {};
    var start = tools.getHrTime();
    var sql = '';
    tools.logDebug(method + ' request', req.query);

    // get device_id parameter
    var device_id = _.get(req, 'query.d', null);
    if(!device_id)
        return next(swagger.errors.notFound('d'));

    // get owner_token parameter
    var owner_token = _.get(req, 'query.p', null);
    if(!owner_token)
        return next(swagger.errors.notFound('o'));

    db.result('UPDATE ' + SCHEMA + 'devices ' +
            'SET owner_verified_ts = $3 ' +
            'WHERE device_id = $1 AND owner_token = $2',
            [device_id, owner_token, moment()])
        .then(function (data) {
            if(data.rowCount < 1)
                return next(swagger.errors.invalid('o'));

            // call standard checkDevice method to return DeviceSate object
            req.params['device_id'] = device_id;
            return new Promise(function(resolve) {
                resolve(checkDevice(req, res, next, swagger));
                return null;
            });
        })
        .catch(function(error) {
            tools.logError(method + ' error', error);
            if(config.debug)
                return next(error);
            else
                return next(new Error(method + ' error'));
        });
}


// Verify phone token
function verifyPhone(req, res, next, swagger) {
    var method = 'verifyPhone';
    var result = {};
    var start = tools.getHrTime();
    var sql = '';
    tools.logDebug(method + ' request', req.query);

    // get device_id parameter
    var device_id = _.get(req, 'query.d', null);
    if(!device_id)
        return next(swagger.errors.notFound('d'));

    // get phone_token parameter
    var phone_token = _.get(req, 'query.p', null);
    if(!phone_token)
        return next(swagger.errors.notFound('p'));

    db.result('UPDATE ' + SCHEMA + 'devices ' +
            'SET phone_verified_ts = $3 ' +
            'WHERE device_id = $1 AND phone_token = $2',
            [device_id, phone_token, moment()])
        .then(function (data) {
            if(data.rowCount < 1)
                return next(swagger.errors.invalid('p'));

            // call standard checkDevice method to return DeviceSate object
            req.params['device_id'] = device_id;
            return new Promise(function(resolve) {
                resolve(checkDevice(req, res, next, swagger));
                return null;
            });
        })
        .catch(function(error) {
            tools.logError(method + ' error', error);
            if(config.debug)
                return next(error);
            else
                return next(new Error(method + ' error'));
        });
}


// Verify e-mail token
function verifyEmail(req, res, next, swagger) {
    var method = 'verifyEmail';
    var result = {};
    var start = tools.getHrTime();
    var sql = '';
    tools.logDebug(method + ' request', req.query);

    // get device_id parameter
    var device_id = _.get(req, 'query.d', null);
    if(!device_id)
        return next(swagger.errors.notFound('d'));

    // get email_token parameter
    var email_token = _.get(req, 'query.e', null);
    if(!email_token)
        return next(swagger.errors.notFound('e'));

    db.result('UPDATE ' + SCHEMA + 'devices ' +
            'SET email_verified_ts = $3 ' +
            'WHERE device_id = $1 AND email_token = $2',
            [device_id, email_token, moment()])
        .then(function (data) {
            if(data.rowCount < 1)
                return next(swagger.errors.invalid('e'));

            // call standard checkDevice method to return DeviceSate object
            req.params['device_id'] = device_id;
            return new Promise(function(resolve) {
                resolve(checkDevice(req, res, next, swagger));
                return null;
            });
        })
        .catch(function(error) {
            tools.logError(method + ' error', error);
            if(config.debug)
                return next(error);
            else
                return next(new Error(method + ' error'));
        });
}



// ======================================================================
// Exports

module.exports = {
    checkDevice: checkDevice,
    registerDevice: registerDevice,
    unregisterDevice: unregisterDevice,
    configureDevice: configureDevice,
    verifyOwner: verifyOwner,
    verifyPhone: verifyPhone,
    verifyEmail: verifyEmail
};
