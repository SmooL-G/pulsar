FROM node:20 AS builder
WORKDIR /app

# Full node:20 image already has build tools (python3, make, g++)

COPY . .
RUN cd packages/shared && npm install && npx tsc || true
RUN cd packages/ui && npm install
RUN cd apps/web && npm install
ARG VITE_PLATFORM_WALLET
ENV VITE_PLATFORM_WALLET=${VITE_PLATFORM_WALLET}
RUN cd apps/web && npx vite build

# Serve with nginx
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
