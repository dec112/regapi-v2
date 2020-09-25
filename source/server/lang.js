'use strict';

var Localize = require('localize');

module.exports = {
    available: ['en', 'de'],
    lang: new Localize({
        'verify_page_phone_text': {
            'en':   'Please verify your phone number to continue the DEC112 registration.',
            'de':   'Bitte verifizieren Sie ihre Telefonnummer um die DEC112 Anmeldung fortzusetzen.'
        },
        'verify_page_phone_field': {
            'en':   'Phone number',
            'de':   'Telefonnummer'
        },
        'verify_page_phone_token': {
            'en':   'Verification token',
            'de':   'Überprüfungs Code'
        },
        'verify_page_phone_token_placeholder': {
            'en':   'Enter verification token',
            'de':   'Überprüfungs Code eingeben'
        },
        'verify_page_phone_button': {
            'en':   'Verify phone',
            'de':   'Verifizieren'
        },
        'verify_page_phone_token_invalid': {
            'en':   'Invalid phone verification token',
            'de':   'Ungültiger Telefon überprüfungs Code'
        },


        'verify_page_email_text': {
            'en':   'Please verify your e-mail address to continue the DEC112 registration.',
            'de':   'Bitte verifizieren Sie ihre E-Mail adresse um die DEC112 Anmeldung fortzusetzen.'
        },
        'verify_page_email_field': {
            'en':   'E-mail address',
            'de':   'E-Mail Adresse'
        },
        'verify_page_email_token': {
            'en':   'Verification token',
            'de':   'Überprüfungs Code'
        },
        'verify_page_email_token_placeholder': {
            'en':   'Enter verification token',
            'de':   'Überprüfungs Code eingeben'
        },
        'verify_page_email_button': {
            'en':   'Verify e-mail',
            'de':   'Verifizieren'
        },
        'verify_page_email_token_invalid': {
            'en':   'Invalid e-mail verification token',
            'de':   'Ungültiger E-Mail überprüfungs Code'
        },


        'verify_page_footer': {
            'en':   'If you received this validation request by mistake, simply ' +
                    'ignore it. You won\'t be subscribed to DEC112 if you don\'t ' +
                    'click the confirmation button above.',
            'de':   'Wenn Sie diese verifizierungs Aufforderung irrtümlich erhalten ' +
                    'haben ignorieren Sie sie bitte. Sie werden nicht bei DEC112 ' +
                    'angemeldet wenn Sie nicht auf die Bestätigungs Schaltfläche ' +
                    'klicken.'
        },
        'verify_page_ok': {
            'en':   '<div class="alert alert-success" role="alert">' +
                    '<h2 class="alert-heading">Well done!</h2>' +
                    '<h4>Verification was successful.</h4>' +
                    '<hr>' +
                    '<p class="mb-0">Whenever you need to, be sure to ' +
                    'check DEC112 channels on the ' +
                    '<a href="http://www.dec112.at">Web</a>, ' +
                    '<a href="https://twitter.com/DEC112_Project">Twitter</a> or ' +
                    '<a href="https://www.facebook.com/dec112/">Facebook</a> ' +
                    'for news and information\'s.</p>' +
                    '</div>',
            'de':   '<div class="alert alert-success" role="alert">' +
                    '<h2 class="alert-heading">Sehr Gut!</h2>' +
                    '<h4>Die Verifizierung war erfolgreich.</h4>' +
                    '<hr>' +
                    '<p class="mb-0">Wenn notwendig prüfen Sie bitte die ' +
                    'DEC112 Seiten im ' +
                    '<a href="http://www.dec112.at">Web</a>, und auf ' +
                    '<a href="https://twitter.com/DEC112_Project">Twitter</a> oder ' +
                    '<a href="https://www.facebook.com/dec112/">Facebook</a> ' +
                    'für Neuigkeiten und Informationen.</p>' +
                    '</div>'
        }
    }, undefined, 'xx')
}
