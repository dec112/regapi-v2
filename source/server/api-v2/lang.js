'use strict';

var Localize = require('localize');

module.exports = {
    available: ['en', 'de'],
    loc: new Localize({
        'verify_phone_link': {
            'en':   'Please confirm your DEC112 registration: $[2]',
            'de':   'Beenden Sie bitte Ihre DEC112 Anmeldung: $[2]'
        },
        'verify_phone_code': {
            'en':   'Your DEC112 verification code: $[2]',
            'de':   'Ihr DEC112 Bestätigungs Code: $[2]'
        },
    }, undefined, 'xx')
}
