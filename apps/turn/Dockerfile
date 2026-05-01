FROM coturn/coturn:latest

USER root
COPY apps/turn/turnserver.conf /etc/coturn/turnserver.conf.template
COPY apps/turn/entrypoint.sh /usr/local/bin/pulsar-turn-entrypoint.sh
RUN chmod +x /usr/local/bin/pulsar-turn-entrypoint.sh

EXPOSE 3478/udp 3478/tcp 5349/udp 5349/tcp 49152-49200/udp

ENTRYPOINT ["/usr/local/bin/pulsar-turn-entrypoint.sh"]
