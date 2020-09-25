/// <reference path="../../../typings/index.d.ts"/>
"use strict";

var promise = require('bluebird');

var pg_options = {
    promiseLib: promise
};

var pgp = require('pg-promise')(pg_options);
// ensure that postgres timestamps without TZ information
// are correctly handled
pgp.pg.types.setTypeParser(1114, function (stringValue) {
    return new Date(Date.parse(stringValue + "+0000"));
});

var db = pgp(config.database);
var SCHEMA = (config.database.schema ? config.database.schema + '.' : '');


// ======================================================================
// Exports

module.exports = {
    SCHEMA: SCHEMA,
    db: db
};
