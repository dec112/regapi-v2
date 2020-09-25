/// <reference path="../../../../typings/index.d.ts"/>
"use strict";

var App;

require([
    'app'
], function(app) {
    App = app;

    if(typeof pageInit === 'function') {
        pageInit(App);
    }
    else {
        if(typeof App.initialize === 'function') {
            App.initialize();
        }
    }
});
