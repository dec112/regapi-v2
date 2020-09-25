#!/bin/bash

# Uncomment to mount certificates
#MOUNT=--mount type=bind,source="/etc/letsencrypt/live/border.domain.tld",target="/etc/letsencrypt/live/border.domain.tld"

# Uncomment to set restart policy
#RESTART=--restart always

docker run \
	-d --name my_dec112_regapi \
	-e NODE_ENV=development \
	${MOUNT} \
	-p 80:80 -p 443:443 \
	--add-host=sql-server:<ip-address-of-sql-server>  \
	${RESTART} \
	dec112/regapi

