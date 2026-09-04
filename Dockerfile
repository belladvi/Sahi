# syntax=docker/dockerfile:1

# ---- Builder: install all deps and build every workspace ----
FROM node:24-alpine AS builder
WORKDIR /app

# Copy manifests first for better layer caching.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/

RUN npm ci

# Copy the rest and build (packages -> web -> api).
COPY . .
RUN npm run build

# ---- Runner: run the Express API, which serves the built SPA ----
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# node_modules (with workspace symlinks) + built artifacts only.
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/dist ./apps/web/dist

EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
