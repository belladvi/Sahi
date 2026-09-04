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

# Copy the whole built tree: this includes node_modules at every level
# (root + nested workspace deps like better-auth in apps/api/node_modules),
# the generated Prisma client, and all dist output. Robust against npm's
# hoisting decisions. (Image size trimmed in the M6 hardening pass.)
COPY --from=builder /app ./

EXPOSE 3001
# Apply pending migrations (non-destructive), then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma && node apps/api/dist/index.js"]
