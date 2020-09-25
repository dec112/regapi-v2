'use strict';

var Localize = require('localize');

module.exports = {
    available: ['en', 'de'],
    lang: new Localize({
        'verify_phone': {
            'en':   'Please confirm your DEC112 registration: $[2]',
            'de':   'Beenden Sie bitte Ihre DEC112 Anmeldung: $[2]'
        },
        'verify_email_subject': {
            'en':   'DEC112 e-mail verification',
            'de':   'DEC112 E-Mail Überprüfung'
        },
        'verify_email': {
            'en':   'DEC112 needs to verify your e-mail ($[1]).\n\n' +
                    'Please click this link $[2] to continue registration.',
            'de':   'DEC112 muss ihre E-Mail verifizieren ($[1]).\n\n' +
                    'Bitte klicken sie folgenden link $[2] um mit der ' +
                    'Registrierung fortzufahren.'
        },
        'verify_email_html': {
            'en':   'DEC112 needs to verify your e-mail (<b>$[1]</b>).\n<p>' +
                    'Please click this link: <a href="$[2]">Verify e-mail</a> to ' +
                    'continue registration.',
            'de':   'DEC112 muss ihre E-Mail verifizieren (<b>$[1]</b>)\n<p>' +
                    'Bitte klicken sie folgenden link: <a href="$[2]">E-Mail ' +
                    'bestätigen</a> um mit der Registrierung fortzufahren.'
        }
    }, undefined, 'xx')
}
