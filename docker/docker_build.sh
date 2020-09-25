#!/bin/bash

S=`basename $0`
P="$( dirname "$( readlink -f "$0" )" )"

docker build -f ./Dockerfile -t dec112/regapi "${P}/.."

