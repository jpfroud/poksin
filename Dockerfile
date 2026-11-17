FROM node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS base

FROM base AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=npm_ca \
    if [ -s /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci --no-audit --no-fund
COPY index.html tsconfig.json tsconfig.server.json vite.config.ts ./
COPY public/ public/
COPY src/ src/
RUN npm run build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    POKSIN_DB=/var/lib/poksin/poksin.sqlite
# Seul Node est nécessaire pour exécuter le build. Garder npm dans l’étape de construction.
RUN rm -rf /usr/local/lib/node_modules /opt/yarn-* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg /usr/local/bin/corepack \
    && mkdir -p /var/lib/poksin \
    && chmod 0770 /var/lib/poksin
COPY package.json ./
COPY --from=build /app/dist/ dist/
USER 1000:0
EXPOSE 8080
CMD ["node", "dist/server/main.js"]
