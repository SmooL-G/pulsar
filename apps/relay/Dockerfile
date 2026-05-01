FROM node:20-alpine AS builder
WORKDIR /app
COPY apps/relay/package.json apps/relay/tsconfig.json ./
RUN npm install --no-audit --no-fund
COPY apps/relay/src ./src
RUN npx tsc

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S relay && adduser -S -G relay relay
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
USER relay
EXPOSE 3030
CMD ["node", "dist/index.js"]
