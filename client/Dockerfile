# À construire depuis la racine du dépôt : docker build -f client/Dockerfile .

# ── Étape 1 : build Vite ──
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json client/
RUN pnpm install --frozen-lockfile --filter @ged/client
COPY client client
RUN pnpm --filter @ged/client build

# ── Étape 2 : fichiers statiques servis par nginx, /api transmis au serveur ──
FROM nginx:1.27-alpine
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/client/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/healthz || exit 1
