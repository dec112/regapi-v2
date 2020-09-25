#!/bin/bash

if (( $EUID != 0 )); then
	if whereis sudo &>/dev/null; then
		sudo -u postgres $0 $*
		exit
	else
		echo "'sudo' utility not found."
		echo "You will need to run this script as root / postgres user."
		exit
	fi
fi

psql \
	-h sql-server \
	-d postgres \
	-U postgres \
	< ./dec112.sql

