# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24.20.0

# ─── Base ─────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci

# ─── API build ────────────────────────────────────────────────────────────────
FROM deps AS build-api
COPY . .
# Prisma generate only needs a syntactically valid URL, not a live database.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npm run build:shared \
  && npm run build --workspace=@crochet-peakz/api \
  && npm prune --omit=dev

# ─── API runtime ──────────────────────────────────────────────────────────────
FROM base AS api
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000
COPY --from=build-api --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build-api --chown=node:node /app/node_modules ./node_modules
COPY --from=build-api --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build-api --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build-api --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=build-api --chown=node:node /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=build-api --chown=node:node /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build-api --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --chown=node:node deploy/api-entrypoint.sh /usr/local/bin/api-entrypoint
RUN chmod +x /usr/local/bin/api-entrypoint
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["api-entrypoint"]
CMD ["node", "apps/api/dist/index.js"]

# ─── Web build ────────────────────────────────────────────────────────────────
FROM deps AS build-web
COPY . .
# NEXT_PUBLIC_* values are inlined by Next.js at build time. Pass the public
# API URL as a build argument and rebuild the web image when it changes.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build:shared && npm run build --workspace=@crochet-peakz/web

# ─── Web runtime ──────────────────────────────────────────────────────────────
FROM base AS web
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build-web --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build-web --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build-web --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
