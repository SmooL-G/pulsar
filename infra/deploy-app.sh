#!/bin/sh
# Pulsar deploy script for app servers (VPS 1 / VPS 2)
set -e

cd /home/pulsar/app

# Pull latest code
eval "$(ssh-agent -s)"
ssh-add /root/.ssh/github_deploy
git pull origin main

# Build and restart
docker compose -f docker-compose.app.yml build
docker compose -f docker-compose.app.yml up -d

# Run Prisma migrations (only needed on one app server)
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  docker compose -f docker-compose.app.yml exec server npx prisma migrate deploy --schema=prisma/schema.prisma
  echo "=== Migrations applied ==="
fi

echo "=== Deploy complete ==="
docker compose -f docker-compose.app.yml ps

# Health check
sleep 5
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
if [ "$STATUS" = "200" ]; then
  echo "=== Health check: OK ==="
else
  echo "=== Health check: FAILED (HTTP $STATUS) ==="
  exit 1
fi
