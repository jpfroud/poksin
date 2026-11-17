FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS base

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
# Le groupe racine permet l’écriture avec l’UID attribué par OpenShift.
RUN mkdir -p /var/lib/poksin && chmod 0770 /var/lib/poksin
COPY package.json ./
COPY --from=build /app/dist/ dist/
USER 1000:0
EXPOSE 8080
CMD ["node", "dist/server/main.js"]
