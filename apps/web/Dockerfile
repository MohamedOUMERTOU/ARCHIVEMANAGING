# À construire depuis la racine du dépôt : docker build -f apps/web/Dockerfile .

# ── Étape 1 : build Vite ──
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @ged/web
COPY apps/web apps/web
RUN pnpm --filter @ged/web build

# ── Étape 2 : fichiers statiques servis par nginx, /api transmis au serveur ──
FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/healthz || exit 1
