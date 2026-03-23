FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies for native modules (usb, etc.)
RUN apk add --no-cache python3 make g++ linux-headers libusb-dev eudev-dev

COPY . .
RUN cd packages/shared && npm install && npx tsc || true
RUN cd packages/ui && npm install
RUN cd apps/web && npm install
RUN cd apps/web && npm run build

# Serve with nginx
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
