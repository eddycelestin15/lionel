# syntax=docker/dockerfile:1
#
# Image de production du rapport TTMR.
# Trois étapes : dépendances, compilation, exécution. Seul le résultat de
# `output: "standalone"` arrive dans l'image finale — pas de node_modules.

# ── dépendances ───────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── compilation ───────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `npm run build` extrait d'abord les classeurs source ; l'image n'en contient
# aucun : les cycles sont importés à chaud depuis /import. On compile donc seul.
RUN npx next build

# ── exécution ─────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs \
 && adduser -u 1001 -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Les cycles importés s'écrivent ici : à monter en volume pour survivre au
# remplacement du conteneur.
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data
VOLUME ["/app/data"]

USER nextjs
EXPOSE 3000

# /import est la seule page qui rend sans cycle chargé : elle atteste que le
# serveur répond même sur une instance vierge.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3000/import || exit 1

CMD ["node", "server.js"]
