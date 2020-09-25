/// <reference path="../../../typings/index.d.ts"/>
"use strict";

exports.models = {

    // =========================================================================
    // Configuration Models

    "RegApi": {
        "id": "RegApi",
        "description": "DEC112 Registration API endpoint",
        "required": ["type", "url"],
        "properties": {
            "type": {
                "type": "string",
                "description": "Type identifier for API endpoint"
            },
            "url": {
                "type": "string",
                "description": "Base URL of endpoint"
            }
        }
    },

    "CountryRegistry": {
        "id": "CountryRegistry",
        "description": "DEC112 App country registry",
        "required": ["name"],
        "properties": {
            "name": {
                "type": "string",
                "description": "ISO-3166 two character, upper-case id of country"
            },
            "registration_api": {
                "type": "array",
                "items": {
                    "$ref": "RegApi"
                },
                "description": "Endpoint description of a country registry"
            }
        }
    },

    "CountryRegistries": {
        "id": "CountryRegistries",
        "description": "DEC112 App country registries",
        "required": ["country_registries"],
        "properties": {
            "country_registries": {
                "type": "array",
                "items": {
                    "$ref": "CountryRegistry"
                },
                "description": "Country registries"
            }
        }
    },

    // GET api/v2/config/root
    "RootConfig": {
        "id": "RootConfig",
        "description": "DEC112 App root configuration",
        "required": ["root"],
        "properties": {
            "root": {
                "$ref": "CountryRegistries",
                "description": "Country registries"
            },
            "runtime_ms": {
                "type": "double",
                "description": "Time needed to process this request in milliseconds " +
                    "(only available when debug mode is enabled)"
            }
        }
    },

    "Service": {
        "id": "Service",
        "description": "Represents an emergency service",
        "required": ["urn"],
        "properties": {
            "urn": {
                "type": "string",
                "description": "A service URN"
            },
            "enabled": {
                "type": "boolean",
                "description": "A flag indicating if service should be available on client GUI"
            }
        }
    },
    
    // GET api/v2/config/<reg_id>
    "Configuration": {
        "id": "Configuration",
        "description": "Represents a registration's configuration",
        "required": [
            "reg_id", "server", "publicId",
            "privateId", "password", "realm"
        ],
        "properties": {
            "reg_id": {
                "type": "string",
                "description": "Unique ID of registration to check"
            },
            "server": {
                "type": "string",
                "description": "URL of SIP server"
            },
            "publicId": {
                "type": "string",
                "description": "Public SIP ID of registration"
            },
            "privateID": {
                "type": "string",
                "description": "Private ID of registration"
            },
            "password": {
                "type": "string",
                "description": "SIP password of registration"
            },
            "realm": {
                "type": "string",
                "description": "SIP realm"
            },
            "services": {
                "type": "array",
                "description": "List of available services",
                "items": {
                    "$ref": "Service"
                }
            },
            "runtime_ms": {
                "type": "double",
                "description": "Time needed to process this request in milliseconds " +
                    "(only available when debug mode is enabled)"
            }
        }
    },

    // =========================================================================
    // Registration Models

    "AnyData": {
        "id": "AnyData",
        "description": "Any JSON data",
        "required": [            
        ],
        "properties": {
        }
    },

    "EmptyResponse": {
        "id": "EmptyResponse",
        "description": "Default, empty response to some API calls",
        "required": [            
        ],
        "properties": {
            "reg_id": {
                "type": "string",
                "description": "Unique ID of registration"
            },
            "runtime_ms": {
                "type": "double",
                "description": "Time needed to process this request in milliseconds " +
                    "(only available when debug mode is enabled)"
            }
        }
    },

    "RegistrationState": {
        "id": "RegistrationState",
        "description": "Current state of a registration",
        "required": [            
            "reg_id", "lang", "state", "phone_verified_ts", "registered_ts"
        ],
        "properties": {
            "reg_id": {
                "type": "string",
                "description": "Unique ID of registration"
            },
            "lang": {
                "type": "string",
                "description": "Language ID (optional)"
            },
            "state": {
                "type": "integer",
                "description": "Current state of registration"
            },
            "phone_verified_ts": {
                "type": "date",
                "description": "UTC date/time of positive phone number verification or null if missing"
            },
            "phone_privacy": {
                "type": "boolean",
                "description": "Indicates if server stores a registrations phone number"
            },
            "registered_ts": {
                "type": "date",
                "description": "UTC date/time when registered or null if unregistered"
            },
            "runtime_ms": {
                "type": "double",
                "description": "Time needed to process this request in milliseconds " +
                    "(only available when debug mode is enabled)"
            }
        }
    },

    // GET api/v2/register/check/<reg_id>

    // POST api/v2/register
    "RegistrationRequest": {
        "id": "RegistrationRequest",
        "description": "Registers a new DEC112 user",
        "required": [
            "phone_number"
        ],
        "properties": {
            "model": {
                "type": "string",
                "description": "Device model name used for registration (optional)"
            },
            "lang": {
                "type": "string",
                "description": "Language ID (optional)"
            },
            "phone_number": {
                "type": "string",
                "description": "Phone number"
            },
        }
    },

    // DELETE api/v2/register/<reg_id>
    "UnregisterRequest": {
        "id": "UnregisterRequest",
        "description": "Delete a registration",
        "required": [
        ],
        "properties": {
            "phone_number": {
                "type": "string",
                "description": "Phone number (optional)"
            }
        }
    },

    // POST api/v2/register/verify/phone/<reg_id>
    "VerifyPhoneRequest": {
        "id": "VerifyPhoneRequest",
        "description": "Verify a registrations phone number",
        "required": [
            "code"
        ],
        "properties": {
            "code": {
                "type": "string",
                "description": "Validation code"
            }
        }
    },

    // GET  api/v2/register/verify/phone/resend/<reg_id>

    // POST api/v2/register/data/<reg_id>
    "StoreDataRequest": {
        "id": "StoreDataRequest",
        "description": "Store arbitrary data for a registration",
        "required": [
            "data"
        ],
        "properties": {
            "phone_number": {
                "type": "string",
                "description": "Phone number (optional)"
            },
            "data": {
                "type": "AnyData",
                "description": "Data to store"
            }
        }
    },
    "StoreDataResponse": {
        "id": "StoreDataResponse",
        "description": "API response to storing arbitrary data for a registration",
        "required": [
            "reg_id", "did"
        ],
        "properties": {
            "reg_id": {
                "type": "string",
                "description": "Unique ID of registration"
            },
            "did": {
                "type": "string",
                "description": "Decentralized Identifier (DID)"
            },
            "runtime_ms": {
                "type": "double",
                "description": "Time needed to process this request in milliseconds " +
                    "(only available when debug mode is enabled)"
            }
        }
    }
};
