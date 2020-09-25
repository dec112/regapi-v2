/// <reference path="../../../typings/index.d.ts"/>
"use strict";

var database = require('./database'),
    moment = require('moment');

var db = database.db;
var SCHEMA = database.SCHEMA;


// ======================================================================
// Database Functions

function get_registration(reg_id) {
    return db.one('SELECT * FROM ' + SCHEMA + 'registrations ' +
            'WHERE reg_id = $1', reg_id);
}


function delete_registration(reg_id) {
    var sql;
    if(_.get(config, 'api.v2.registration.delete_unregistered', true))
        sql = 'DELETE FROM ' + SCHEMA + 'registrations ' +
            'WHERE reg_id = $1 ' +
            'RETURNING *';
    else
        sql = 'UPDATE ' + SCHEMA + 'registrations ' +
            'SET state = 0, ' +
                'phone_token = NULL, phone_verified_ts = NULL, phone_vcnt = 0, ' +
                'did = NULL, ' +
                'registration_ts = NULL, ' +
                'kamailio_id = NULL ' +
            'WHERE reg_id = $1 ' +
            'RETURNING *';
    return db.one(sql, [reg_id]);
}


function set_did(reg_id, did) {
    return db.one('UPDATE ' + SCHEMA + 'registrations ' +
            'SET did = $2 ' +
            'WHERE reg_id = $1 ' +
            'RETURNING reg_id, did',
            [reg_id, did]);
}


// Check registration state
function check(req, res, next, swagger) {
    var method = 'check';
    var result = {};
    var start = tools.getHrTime();
    tools.logDebug(method + ' request', req.params);

    var reg_id = req.params.reg_id;

    return db.one('SELECT * FROM ' + SCHEMA + 'registrations ' +
            'WHERE reg_id = $1', reg_id)
        .then(function (data) {
            tools.logDebug(method + ' data', data);

            result = {
                reg_id: reg_id,
                lang: data.lang,
                state: data.state,
                phone_verified_ts: data.phone_verified_ts,
                phone_privacy: _.get(config, 'api.v2.registration.verify_phone.delete_after_verify', false),
                registered_ts: data.registration_ts
            };

            tools.logDebug(method + ' response', result);
            if(config.debug)
                result.runtime_ms = tools.elapsedHrTime(start);
            res.status(200).json(result);

            return result;
        })
        .catch(function(error) {
            if(error.code == 0)
                return next(swagger.errors.invalid('reg_id'));

            tools.logError(method + ' error ' + error, error);
            if(config.debug)
                return next(error);

            return next(new Error(method + ' error'));
        });
}


// Create a new registration
function register(req, res, next, swagger) {
    var method = 'register';
    tools.logDebug(method + ' request', req.body);

    var bd = req.body;
    if(_.get(config, 'api.v2.registration.verify_phone.enabled', false)) {
        var sms_type = _.get(config, 'api.v2.registration.verify_phone.type', 'code');

        switch(sms_type) {

            //case 'link': 
            //    bd.phone_token = tools.strRandom(8);
            //    break;

            //case 'code':
            default:
                bd.phone_token = tools.strRandomCode(4);
                break;
        }
    }
    else {
        bd.phone_token = 'IGNORED';
    }

    bd.registration_ts = moment();

    return db.oneOrNone('SELECT * FROM ' + SCHEMA + 'registrations ' +
            'WHERE reg_id = $1', bd.reg_id)
        .then(function (data) {
            if(data && data.state >= 10) {
                // if already at state 10 (= fully registered) do nothing
                tools.logInfo('User (' + data.reg_id + ') already fully ' +
                    'registered - do nothing', data);
                req.params['reg_id'] = data.reg_id;
                return check(req, res, next, swagger);
            }
            else {
                // otherwise register or re-register
                if(data && data.state > 0)
                   tools.logInfo('User (' + data.reg_id + ') registration ' +
                       'pending - reregister', data);
                return db.none('INSERT INTO ' + SCHEMA + 'registrations ' +
                        '(reg_id, model, lang, state, ' +
                            'phone_number, phone_token, phone_vcnt, ' +
                            'registration_ts, kamailio_id)' +
                        'VALUES (${reg_id}, ${model}, ${lang}, 1, ' +
                            '${phone_number}, ${phone_token}, 1, ' +
                            '${registration_ts}, NULL) ' +
                        'ON CONFLICT (reg_id) DO UPDATE ' +
                            'SET reg_id = EXCLUDED.reg_id, ' +
                                'model = EXCLUDED.model,' +
                                'lang = EXCLUDED.lang,' +
                                'state = EXCLUDED.state,' +
                                'phone_number = EXCLUDED.phone_number,' +
                                'phone_token = EXCLUDED.phone_token,' +
                                'phone_vcnt = 1,' +
                                'phone_verified_ts = NULL,' +
                                'registration_ts = EXCLUDED.registration_ts, ' +
                                'kamailio_id = NULL',
                                bd)
                    .then(function () {
                        // call standard check method to return
                        // RegistrationSate object
                        req.params['reg_id'] = bd.reg_id;
                        return check(req, res, next, swagger);
                    })
                    .catch(function(error) {
                        if(error.code == 23505)
                            return next(swagger.errors.invalid('RegistrationRequest'));

                        tools.logError(method + ' error ' + error, error);
                        if(config.debug)
                            return next(error);

                        return next(new Error(method + ' error'));
                    });
            }
        });
}


// Provides registration configuration parameters
function configure(req, res, next, swagger) {
    var method = 'configure';
    var result = {};
    var start = tools.getHrTime();
    tools.logDebug(method + ' request', req.params);

    var reg_id = req.params.reg_id;

    return db.one('SELECT * FROM ' + SCHEMA + 'registrations ' +
            'WHERE reg_id = $1', [reg_id])
        .then(function (data) {
            tools.logDebug(method + ' data', data);
            if(data.state != 10)
                return next(new Error(method + ' registration (' + reg_id + ') ' +
                    'found but verification pending'));

            return db.one('SELECT * FROM ' + SCHEMA + 'subscriber ' +
                    'WHERE id = $1', data.kamailio_id)
                .then(function (data) {
                    tools.logDebug(method + ' subscriber data', data);

                    result = {
                        reg_id: reg_id,
                        server: config.api.v2.configuration.kamailio.ws,
                        publicId: "sip:" + data.username + "@" + config.api.v2.configuration.kamailio.domain,
                        privateId: data.username,
                        password: data.password,
                        realm: data.domain,
                        services: config.api.v2.configuration.kamailio.services
                    };

                    tools.logDebug(method + ' response', result);
                    if(config.debug)
                        result.runtime_ms = tools.elapsedHrTime(start);
                    res.status(200).json(result);

                    return result;
                });
        })
        .catch(function(error) {
            if(error.code == 0)
                return next(swagger.errors.invalid('reg_id'));

            tools.logError(method + ' error ' + error, error);
            if(config.debug)
                return next(error);

            return next(new Error(method + ' error'));
        });
}


// Verify phone token
function verify_phone(req, res, next, swagger) {
    var method = 'verify_phone';
    var sql = '';
    tools.logDebug(method + ' request', {
        params: req.params,
        body: req.body
    });

    var reg_id = req.params.reg_id;
    var phone_token = req.body.code;

    if(_.get(config, 'api.v2.registration.verify_phone.delete_after_verify', false)) {
        sql = 'UPDATE ' + SCHEMA + 'registrations SET ' +
            'phone_verified_ts = $3, ' +
            'phone_number = NULL ' +
            'WHERE reg_id = $1 AND phone_token = $2 AND phone_verified_ts IS NULL';
    }
    else {
        sql = 'UPDATE ' + SCHEMA + 'registrations SET ' +
            'phone_verified_ts = $3 ' +
            'WHERE reg_id = $1 AND phone_token = $2 AND phone_verified_ts IS NULL';
    }

    db.result(sql, [reg_id, phone_token, moment()])
        .then(function (data) {
            if(data.rowCount < 1)
                return next(swagger.errors.invalid('reg_id'));

            // call standard check method to return RegistrationSate object
            req.params['reg_id'] = reg_id;
            return new Promise(function(resolve) {
                resolve(check(req, res, next, swagger));
                return null;
            });
        })
        .catch(function(error) {
            tools.logError(method + ' error', error);
            if(config.debug)
                return next(error);

            return next(new Error(method + ' error'));
        });
}


function verify_phone_resend(req, res, next, swagger) {
    var method = 'verify_phone_resend';
    var result = {};
    var start = tools.getHrTime();
    tools.logDebug(method + ' request', req.params);

    var reg_id = req.params.reg_id;

    return db.one('UPDATE ' + SCHEMA + 'registrations ' +
            'SET phone_vcnt = phone_vcnt + 1 ' +
            'WHERE reg_id = $1 ' +
            'AND state < 10 ' +
            'AND phone_vcnt < 3 ' +
            'RETURNING reg_id, state, lang, phone_number, phone_token, phone_vcnt',
            [reg_id])
        .then(function (data) {
            result = {
                reg_id: data.reg_id
            };

            tools.logDebug(method + ' response', result);
            if(config.debug)
                result.runtime_ms = tools.elapsedHrTime(start);
            res.status(200).json(result);

            return data;
        })
        .catch(function(error) {
            if(error.code == 0)
                return next(swagger.errors.invalid('reg_id'));

            tools.logError(method + ' error ' + error, error);
            if(config.debug)
                return next(error);

            return next(new Error(method + ' error'));
        });
}


// ======================================================================
// Exports

module.exports = {
    get_registration: get_registration,
    delete_registration: delete_registration,
    set_did: set_did,
    check: check,
    register: register,
    configure: configure,
    verify_phone: verify_phone,
    verify_phone_resend: verify_phone_resend
};
