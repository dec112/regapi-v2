/// <reference path="../../../typings/index.d.ts"/>
"use strict";

exports.models = {
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


    "RootConfig": {
        "id": "RootConfig",
        "description": "DEC112 App root configuration",
        "required": ["code", "root"],
        "properties": {
            "code": {
                "type": "integer",
                "description": "API response code"
            },
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


    "Device": {
        "id": "Device",
        "description": "Represents a Device",
        "required": ["device_id", "phone_number", "lang", "owner_name", "owner_address"],
        "properties": {
            "device_id": {
                "type": "string",
                "description": "A device's unique ID"
            },
            "model": {
                "type": "string",
                "description": "Device maker/model information"
            },
            "lang": {
                "type": "string",
                "description": "Language of device (ISO code, defaults to 'en')"
            },
            "phone_number": {
                "type": "string",
                "description": "The phone number associated with this device"
            },
            "owner_name": {
                "type": "string",
                "description": "Name of device owner"
            },
            "owner_address": {
                "type": "string",
                "description": "Address of device owner"
            },
            "owner_email": {
                "type": "string",
                "description": "E-Mail address of device owner"
            }
        }
    },


    "DeviceState": {
        "id": "DeviceState",
        "description": "Represents a Device's registration state",
        "required": ["code", "device_id", "state"],
        "properties": {
            "code": {
                "type": "integer",
                "description": "API response code"
            },
            "device_id": {
                "type": "string",
                "description": "Unique ID of device to check"
            },
            "device_did": {
                "type": "integer",
                "description": "Unique internal ID of device"
            },
            "lang": {
                "type": "string",
                "description": "Language of device (ISO code, defaults to 'en')"
            },
            "state": {
                "type": "integer",
                "description": "Current state of the device"
            },
            "phone_verified": {
                "type": "date",
                "description": "UTC date/time of positive phone number verification or null if missing"
            },
            "email_verified": {
                "type": "date",
                "description": "UTC date/time of positive email verification or null if missing"
            },
            "device_registered": {
                "type": "date",
                "description": "UTC date/time when device was registered or null if unregistered"
            },
            "runtime_ms": {
                "type": "double",
                "description": "Time needed to process this request in milliseconds " +
                    "(only available when debug mode is enabled)"
            }
        }
    },

    
    "DeviceConfiguration": {
        "id": "DeviceConfiguration",
        "description": "Represents a Device's configuration",
        "required": [
            "code", "device_id", "server", "publicId",
            "privateId", "password", "realm"
        ],
        "properties": {
            "code": {
                "type": "integer",
                "description": "API response code"
            },
            "device_id": {
                "type": "string",
                "description": "Unique ID of device to check"
            },
            "server": {
                "type": "string",
                "description": "URL of SIP server"
            },
            "publicId": {
                "type": "string",
                "description": "Public SIP ID of device owner"
            },
            "privateID": {
                "type": "string",
                "description": "Private ID of device owner"
            },
            "password": {
                "type": "string",
                "description": "SIP password of device owner"
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
    }
};
