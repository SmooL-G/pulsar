FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json ./apps/server/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN cd apps/server && npm install --omit=dev

# Build
FROM base AS builder
COPY . .
RUN cd apps/server && npm install
RUN cd packages/shared && npx tsc
RUN cd apps/server && npx prisma generate --schema=src/db/schema.prisma
RUN cd apps/server && npm run build

# Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 pulsar

COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/src/db/schema.prisma ./prisma/schema.prisma
COPY --from=builder /app/apps/server/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/server/package.json ./package.json

USER pulsar
EXPOSE 3001

CMD ["node", "dist/index.js"]
