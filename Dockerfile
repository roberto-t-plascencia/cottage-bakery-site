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

# next build's "Collecting page data" step imports every route module
# (including src/lib/supabase.ts, transitively) to inspect its exports —
# even for routes marked force-dynamic that never execute at build time —
# and that module builds its Supabase client eagerly at import time (see
# its own comment for why). So the build needs *some* value here, but not
# a real one: constructing a Supabase client never makes a network call,
# it just needs a syntactically valid URL and a non-empty key. Real
# credentials are supplied at container start (docker-compose.yml), not
# baked into the image — these placeholders only get the build past that
# import.
ARG SUPABASE_URL=https://placeholder.supabase.co
ARG SUPABASE_SERVICE_ROLE_KEY=placeholder-build-time-key
ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
RUN npm run build

# --- runner: the actual production image. Only what's needed to run the
# already-built app — no source, no devDependencies, no build tooling. ---
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Next's standalone output already contains a minimal node_modules with
# only the production dependencies actually used at runtime. There's no
# local database file to seed or mount — Supabase is an external service,
# reached over the network with the SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
# supplied at container start (see docker-compose.yml).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
