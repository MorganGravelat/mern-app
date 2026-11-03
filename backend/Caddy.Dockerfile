# Caddy image for the server: builds the React website and serves it next to the API.
# Built from the repository root (see docker-compose.prod.yml) because it needs web/.

# Stage 1: build the website into static files (web/dist).
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web ./
# Where the website sends API requests. Built into the page, so never a secret.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# Stage 2: Caddy with the built website. Node is not needed at run time.
FROM docker.io/caddy:2
COPY backend/Caddyfile /etc/caddy/Caddyfile
COPY --from=web /web/dist /srv
