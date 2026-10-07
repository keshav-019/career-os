# CareerOS mobile backend. Build from the repo root, since this app bundles code from apps/web/src and
# packages/shared:
#
#   docker build -f apps/mobile-backend/Dockerfile -t careeros-mobile-backend .
#
# The image holds no secrets; pass the server-side keys from .env.local.example at runtime (see deploy/).

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps/mobile-backend/package.json apps/mobile-backend/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @careeros/mobile-backend --workspace @careeros/shared --include-workspace-root=false --ignore-scripts --no-audit --no-fund
COPY packages/shared packages/shared
COPY apps/web/src apps/web/src
COPY apps/mobile-backend apps/mobile-backend
RUN npm run build --workspace @careeros/mobile-backend

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps/mobile-backend/package.json apps/mobile-backend/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @careeros/mobile-backend --include-workspace-root=false --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/mobile-backend/node_modules apps/mobile-backend/node_modules
COPY --from=build /app/apps/mobile-backend/dist apps/mobile-backend/dist
COPY package.json ./
COPY scripts/register-env.cjs scripts/load-careeros-env.cjs scripts/
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "-r", "./scripts/register-env.cjs", "apps/mobile-backend/dist/server.js"]
