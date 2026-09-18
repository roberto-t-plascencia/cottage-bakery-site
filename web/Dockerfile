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

# Unlike the pre-split app, nothing this service imports at build time
# touches a secret or makes a network call — apiClient.ts (src/lib/
# apiClient.ts) reads API_URL lazily, inside each function, not at module
# load. So `next build`'s page-data-collection step (which imports every
# route module, even ones marked force-dynamic) needs no placeholder env
# vars here at all. Compare this to the pre-microservices-split Dockerfile
# in git history, which needed SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
# build args specifically because src/lib/supabase.ts built its client
# eagerly at import time — that whole class of problem left with the
# Supabase client when it moved to api/.
RUN npm run build

# --- runner: the actual production image. Only what's needed to run the
# already-built app — no source, no devDependencies, no build tooling. ---
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Next's standalone output already contains a minimal node_modules with
# only the production dependencies actually used at runtime. API_URL
# (pointing at the api/ service) is supplied at container start — see
# docker-compose.yml.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
