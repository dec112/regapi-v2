'use strict';

module.exports = {
    hostname: process.env.HOST || process.env.HOSTNAME,
    environment: process.env.NODE_ENV
};
