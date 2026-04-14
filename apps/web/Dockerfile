FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies for native modules (usb, etc.) with retry
RUN for i in 1 2 3; do \
      apk add --no-cache python3 make g++ linux-headers libusb-dev eudev-dev && break || \
      (echo "apk failed, retry $i..." && sleep 10); \
    done

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
