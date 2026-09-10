# syntax=docker/dockerfile:1.7
#
# Máquina Nerd portal — production image (Next.js standalone).
#
# Built on the same kind of host as Kal El (docker-compose.prod.yml in the CMS repo): a
# container behind the platform's reverse proxy, TLS terminated there.
#
#   docker build \
#     --secret id=portal_env,src=.env.production \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://www.maquinanerd.com.br \
#     -t maquinanerd-portal .
#
# Why a build secret: `next build` prerenders the home, the editorias and the newest
# articles, so it reads Kal El — with the service token. A BuildKit secret is mounted for
# that one RUN and never lands in a layer or in `docker history`; a build-arg would.
# The runtime reads the same variables from the environment (env_file in compose).

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# ---- dependencies, cached on the manifests alone
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/content/package.json packages/content/package.json
COPY packages/seo/package.json packages/seo/package.json
COPY packages/tokens/package.json packages/tokens/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

# ---- build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} NEXT_OUTPUT=standalone NODE_ENV=production
# `node --env-file`, not `. file` in a shell: a secret containing `$` or a backtick is
# read literally instead of being expanded. Variables already set above (NODE_ENV,
# NEXT_OUTPUT, NEXT_PUBLIC_SITE_URL) take precedence over the file.
RUN --mount=type=secret,id=portal_env,required=true \
    node --env-file=/run/secrets/portal_env node_modules/next/dist/bin/next build

# ---- runtime: only the traced server, the static assets and /public
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
# Liveness only: readiness (`?ready=1`) also checks Kal El, and a CMS blip must not get
# this container killed and restarted into the same blip.
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
