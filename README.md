# Sahi

FSSAI registration for Bangalore home bakers — from *"do I even need a licence?"* to a real, ready-to-submit registration.

This repo is the production build. Product spec and tickets live in the case-study workspace (`21-Build-Spec.md`, `tickets/`).

## Stack

- **apps/web** — React 19 + Vite + React Router 7 + TypeScript (the baker PWA)
- **apps/api** — Express 5 + TypeScript (modular monolith; serves the built SPA in production)
- **packages/shared** — Zod schemas + TS types shared by web & api
- **packages/db** — Prisma schema + client (added in ticket 02)
- One multi-stage **Dockerfile**, deployed on **Railway** (staging + prod)

## Prerequisites

- Node.js >= 20 (developed on 24)
- npm >= 10

## Develop

```bash
npm install
cp .env.example .env      # then fill in local values
npm run dev               # api on :3001, web on :5173 (proxies /api -> :3001)
```

## Verify (the gate — run before every push)

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Production build (what Railway runs)

The Dockerfile builds every workspace, then the Express API serves the built SPA
and exposes `GET /api/health` (Railway's health check).

```bash
docker build -t sahi .
docker run -p 3001:3001 -e NODE_ENV=production sahi
```

## Environments

Copy `.env.example` to `.env` (local) and `.env.prod` (Railway). Never commit either —
both are gitignored via the `.env*` pattern. See `21-Build-Spec.md` §6 for the per-env values.
