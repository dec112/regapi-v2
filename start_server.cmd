@echo off
cls

cd dist

rem Select configuration
set NODE_ENV=development
rem set NODE_ENV=production

rem Disable self-signed cert check
rem set NODE_TLS_REJECT_UNAUTHORIZED=0

rem Additional debugging output
rem set DEBUG=express:*

start node.exe index.js

