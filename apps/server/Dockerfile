FROM node:20-alpine AS builder
WORKDIR /app

COPY . .
# Устанавливаем зависимости из корня — это правильно для npm workspaces
RUN npm install --workspace=apps/server --workspace=packages/shared --include-workspace-root
RUN cd packages/shared && npx tsc || true
# Prisma generate — теперь @prisma/client в root node_modules, типы обновятся
RUN cd apps/server && npx prisma generate --schema=src/db/schema.prisma
RUN cd apps/server && npm run build

# Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 pulsar

# Copy entire monorepo structure needed at runtime
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/apps/server/src/db/schema.prisma ./apps/server/prisma/schema.prisma
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/src ./packages/shared/src
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER pulsar
EXPOSE 3001
WORKDIR /app/apps/server

CMD ["node", "dist/index.js"]
