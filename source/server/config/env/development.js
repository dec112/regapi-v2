'use strict';

module.exports = {
    // When true minimize log output, overrules 'debug'
    quiet: false,

    // When true enable additional log output
    debug: true,

    // Defines on which ip's and with which protocolls
    // the regapi will listen
    server: {
        // Enable cross origin support
        CORS: true,

        log: {
            // 'console' or ' file' specifies where to put log output
            target: 'console',
            // Absolute or relative (to regapi home dir) path where
            // server logs should be places
            path: 'logs',
            // Enable or disable colored log output.
            color: true,
            // If enabled, log http requests
            express: false
        },

		// Base URL part used for constructing dynmic URL's
        base_url: 'http://my-regapi.domain.tld/',

        // http listen address and port. Defaults to 0.0.0.0 (any
        // address and TCP port 80)
        http: {
            listen: '0.0.0.0',
            port: 80
        },

        // https listen address and port. Defaults to 0.0.0.0 (any
        // address and TCP port 443)
        https: {
            listen: '0.0.0.0',
            port: 443,

            // Defines where to find server certificate and optionally
            // Certificate Authority roots
            key: 'certs/domain.tld.key',
            ca: 'certs/domain.tld.intermediate.crt',
            cert: 'certs/domain.tld.primary.crt'
        }
    },

    api: {
		// Configuration section for API version 1.
        v1: {
			// Enable or disable this API
            enabled: true,
			// Default international phone prefix this regapi is reponsible for.
            int_phone_prefix: '0043',
			// Define which type of registration verification to use.
            registration: {
                enabled: true,
                verify_owner: { enabled: false },
                verify_phone: { enabled: true },
                verify_email: { enabled: true },
				// If true, delete unregistered users else keep them and only
				// flag them unregistered.
                delete_unregistered: true
            },
			// Enable client configuration API methods.
            configuration: {
                enabled: true,
                // root configuration is delivered to client 'as is' configured below.
				// Client must know how to interprete this. Samples show configuration
				// for Android/IOS DEC112 app.
                root: {
                    country_registries: [
                        // ISO3166 alpha-2 country codes
                        {
                            name: 'AT',
                            registration_api: [
                                { type: 'dec112_v1', url: 'http://regapi-at.domain.tld' }
                            ]
                        },
                        {
                            name: 'IT',
                            registration_api: [
                                { type: 'dec112_v1', url: 'http://regapi-it.domain.tld' },
                                { type: 'dec112_v1', url: 'http://regapi-it.domain.tld' }
                            ]
                        },
                        {
                            name: 'DK',
                            registration_api: [
                                { type: 'dec112_v1', url: 'http://regapi-dk.domain.tld' }
                            ]
                        }
                    ]
                },
				// SIP proxy configuration
                kamailio: {
					ws: 'ws://sip.domain.tld:1234',
                    domain: 'domain.tld',
                    services: [
                        { enabled: true, urn: 'urn:service:sos' },
                        { enabled: true, urn: 'urn:service:police' },
                        { enabled: true, urn: 'urn:service:fire' },
                        { enabled: true, urn: 'urn:service:ambulance' }
                    ]
                }
            }
        },

		// Configuration section for API version 2.
        v2: {
			// Enable or disable this API
            enabled: true,
			// Default international phone prefix this regapi is reponsible for.
            int_phone_prefix: '0043',
			// Define which type of registration verification to use.
            registration: {
                enabled: true,
                verify_phone: {
                    enabled: true,
                    type: 'code',
                    delete_after_verify: true
                },
				// If true, delete unregistered users else keep them and only
				// flag them unregistered.
                delete_unregistered: true
            },
			// Enable client configuration API methods.
            configuration: {
                enabled: true,
                // root configuration is delivered to client 'as is' configured below.
				// Client must know how to interprete this. Samples show configuration
				// for Android/IOS DEC112 app.
                root: {
                    country_registries: [
                        // ISO3166 alpha-2 country codes
                        {
                            name: 'AT',
                            registration_api: [
                                { type: 'dec112_v1', url: 'http://regapi-at.domain.tld' }
                            ]
                        },
                        {
                            name: 'IT',
                            registration_api: [
                                { type: 'dec112_v1', url: 'http://regapi-it.domain.tld' },
                                { type: 'dec112_v1', url: 'http://regapi-it.domain.tld' }
                            ]
                        },
                        {
                            name: 'DK',
                            registration_api: [
                                { type: 'dec112_v1', url: 'http://regapi.domain.tld' }
                            ]
                        }
                    ]
                },
				// SIP proxy configuration
                kamailio: {
                    ws: 'ws://sip.domain.tld',
                    domain: 'domain.tld',
                    services: [
                        { enabled: true, urn: 'urn:service:sos' },
                        { enabled: true, urn: 'urn:service:police' },
                        { enabled: true, urn: 'urn:service:fire' },
                        { enabled: true, urn: 'urn:service:ambulance' }
                    ]
                }
            }
        }
    },

	// Postgres connection information
    database: {
        host: 'sql-server.domain.tld',
        port: 5432,
        database: 'my-database',
        user: 'my-sql-user',
        password: 'password',
        schema: "dec112"
    },

    // SMTP mail server configuration
    mail: {
        host: 'smtp.domain.tld',
        port: 587,
        secure: false,
        auth: {
            user: 'my-smtp-user',
            pass: 'password'
        }
    },

    // SMS configuration for firmensms.at
    sms: {
        host: 'http://www.firmensms.at',
        auth: {
            user: 'my-sms-user',
            pass: 'password'
        },
        warn_below: 5,
        warn_email: 'info@domain.tld'
    },

    // Own Your Data DID provider
    oyd: {
        client_id: 'my-client-id',
        client_secret: 'my-client-secret',
        url: {
            oauth: 'https://data-vault.eu/oauth/token',
            register: 'https://data-vault.eu/api/dec112/register',
            revoke: 'https://data-vault.eu/api/dec112/revoke'
        }
    },

	// At the moment only a handful api keys are required so this
	// configuration is enough. Later place them into the db
    api_keys: {
        'my-api-key': {
            enabled: true,
            description: 'Api-key description'
        }
    }
}

