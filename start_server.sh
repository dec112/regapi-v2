#!/bin/bash

S=`basename $0`
#P=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
P="$( dirname "$( readlink -f "$0" )" )"

if (( $EUID != 0 )); then
	if whereis sudo &>/dev/null; then
		sudo $0 $*
		exit
	else
		echo "'sudo' utility not found."
		echo "You will need to run this script as root."
		exit
	fi
fi

cd "${P}/dist"

# Select configuration
export NODE_ENV=development
#export NODE_ENV=production

# Disable self-signed cert check
#export NODE_TLS_REJECT_UNAUTHORIZED=0

# Additional debugging output
#export DEBUG=express:*

node index.js

