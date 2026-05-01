#!/bin/sh
# Render TURN_AUTH_SECRET into the config (coturn doesn't expand env vars
# itself), then exec the real coturn binary.
set -e
: "${TURN_AUTH_SECRET:?TURN_AUTH_SECRET must be set}"
sed "s|\${TURN_AUTH_SECRET}|$TURN_AUTH_SECRET|g" /etc/coturn/turnserver.conf.template > /etc/coturn/turnserver.conf
exec turnserver -c /etc/coturn/turnserver.conf
