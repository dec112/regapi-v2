FROM ubuntu:bionic
WORKDIR /srv/www/

COPY ./dist ./api/dist
COPY ./install ./api/install
COPY ./docker/start.sh ./

RUN apt-get update
RUN apt-get install -y xz-utils nano iputils-ping net-tools wget
RUN apt-get install -y postgresql-client
RUN apt-get clean

RUN wget https://nodejs.org/dist/v12.16.1/node-v12.16.1-linux-x64.tar.xz
RUN /bin/mkdir -p /opt/node
RUN tar -x -f node-v12.16.1-linux-x64.tar.xz -C /opt/node --strip-components=1
RUN /bin/rm -f node-v12.16.1-linux-x64.tar.xz
RUN echo "export PATH=/opt/node/bin:${PATH}" > /etc/profile.d/node-js.sh
ENV PATH="/opt/node/bin:${PATH}"

RUN /bin/bash -c 'cd ./api/dist; /opt/node/bin/npm install --only=production'

LABEL provider="dec112" \
      service="regapi"

EXPOSE 80 443
CMD [ "/bin/bash", "./start.sh" ]

