#!/bin/sh
# Pulsar deploy script — run on server
set -e

cd /home/pulsar/app

# Pull latest code
eval "$(ssh-agent -s)"
ssh-add /root/.ssh/github_deploy
git pull origin main

# Build and restart
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Run Prisma migrations
docker compose -f docker-compose.prod.yml exec server npx prisma migrate deploy --schema=prisma/schema.prisma

echo "=== Deploy complete ==="
docker compose -f docker-compose.prod.yml ps
