# syntax=docker/dockerfile:1

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Compiles src/ to dist/ (CommonJS — see tsconfig.json's comment on why
# this service isn't ESM). No env vars needed at build time: nothing here
# constructs a Supabase client or otherwise touches an env var at module
# load — src/lib/supabase.ts's getEnv() calls run when the process starts
# (src/index.ts), not when tsc compiles it.
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 apiuser

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force
COPY --from=builder --chown=apiuser:nodejs /app/dist ./dist

USER apiuser

EXPOSE 4000
ENV PORT=4000

CMD ["node", "dist/src/index.js"]
