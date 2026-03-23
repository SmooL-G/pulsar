FROM node:20-alpine AS builder
WORKDIR /app

COPY . .
RUN cd apps/server && npm install
RUN cd packages/shared && npx tsc || true
RUN cd apps/server && npx prisma generate --schema=src/db/schema.prisma
RUN cd apps/server && npm run build

# Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 pulsar

# Copy built server and dependencies
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/src/db/schema.prisma ./prisma/schema.prisma
COPY --from=builder /app/apps/server/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

USER pulsar
EXPOSE 3001

CMD ["node", "dist/index.js"]
