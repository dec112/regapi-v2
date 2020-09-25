#!/bin/bash

# Start script of services inside docker container.

S=`basename $0`
P="$( dirname "$( readlink -f "$0" )" )"

# start DEC112 RegApi
cd "${P}/api/dist"
/opt/node/bin/node index.js

