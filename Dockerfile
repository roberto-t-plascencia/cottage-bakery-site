# syntax=docker/dockerfile:1

# --- deps: install dependencies in their own layer so `docker build` only
# re-runs `npm ci` when package*.json actually changes, not on every source
# edit. ---
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# --- builder: compile the app. ---
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No DATABASE_PATH is set here on purpose: the build only needs to
# typecheck and bundle the app, not talk to a real database. /menu and
# /admin are marked `export const dynamic = "force-dynamic"` specifically
# so they're never prerendered with build-time data (see the comment in
# those files) — so the build touches no database at all. If a future
# page did read the DB during static generation, this stage would create
# a throwaway db file at the default path, which is harmless: the real
# ./data volume is mounted fresh at runtime (see docker-compose.yml).
RUN npm run build

# --- runner: the actual production image. Only what's needed to run the
# already-built app — no source, no devDependencies, no build tooling. ---
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Next's standalone output already contains a minimal node_modules with
# only the production dependencies actually used at runtime.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# schema.sql is read from disk at startup (see src/lib/db.ts) — the
# standalone output doesn't include it since it's not a JS import.
COPY --from=builder /app/db/schema.sql ./db/schema.sql

RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV DATABASE_PATH=/app/data/dev.db

CMD ["node", "server.js"]
