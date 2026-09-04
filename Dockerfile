# syntax=docker/dockerfile:1

# ---- Builder: install all deps and build every workspace ----
FROM node:24-slim AS builder
WORKDIR /app

# openssl is required by Prisma's engines.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy manifests first for better layer caching.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/

RUN npm ci

# Copy the rest and build (prisma generate + packages -> web -> api).
COPY . .
RUN npm run build

# ---- Runner: run the Express API, which serves the built SPA ----
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# node_modules (with workspace symlinks + generated Prisma client) + built artifacts.
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/dist ./apps/web/dist

EXPOSE 3001
# Apply pending migrations (non-destructive), then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma && node apps/api/dist/index.js"]
