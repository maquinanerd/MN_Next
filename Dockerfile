# syntax=docker/dockerfile:1.7
#
# Máquina Nerd portal — production image (Next.js standalone).
#
# A container behind the platform's reverse proxy, TLS terminated there. `next build`
# prerenders the home, the editorias and the newest articles — so it reads Kal El with the
# service token — and validates the whole environment when APP_ENV is staging or
# production. It gets that environment one of two ways:
#
#   # a BuildKit secret (docker-compose.prod.yml): mounted for the one RUN that needs it,
#   # it never lands in a layer, in `docker history` or in a build argument
#   docker build \
#     --secret id=portal_env,src=.env.production \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://www.maquinanerd.com.br \
#     -t maquinanerd-portal .
#
#   # build arguments (docker-compose.coolify.yml), where the platform cannot mount a
#   # secret. This file declares them in the build stage only, but Coolify injects an ARG
#   # for every resource variable into every stage, so there they do reach the image's
#   # build metadata (`docker history` on that server)
#   docker build --build-arg APP_ENV=staging --build-arg CONTENT_SOURCE=kalel ... .
#
# The runtime reads the same variables from the container's environment.

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
# Declared, never copied into ENV. An argument nobody passes is simply absent from the
# build's environment; `ENV X=${X}` would define it as an empty string instead, and a
# defined variable — even an empty one — wins over the same name in the secret file.
ARG NEXT_PUBLIC_SITE_URL
ARG APP_ENV
ARG CONTENT_SOURCE
ARG KAL_EL_BASE_URL
ARG KAL_EL_SITE_ID
ARG KAL_EL_SERVICE_TOKEN
ARG KAL_EL_WEBHOOK_SECRET
ARG KAL_EL_PREVIEW_SECRET
ARG TRUST_PROXY
# The CSP and the image loader's allowlist are fixed at build time (next.config.ts).
ARG MEDIA_ALLOWED_HOSTS
# Publicidade: público por natureza e lido no build (next inlines NEXT_PUBLIC_*).
ARG NEXT_PUBLIC_ADSENSE_CLIENT
ARG NEXT_PUBLIC_ADSENSE_TEST
ARG NEXT_PUBLIC_ADSENSE_SLOT_728X90
ARG NEXT_PUBLIC_ADSENSE_SLOT_300X250
ARG NEXT_PUBLIC_ADSENSE_SLOT_300X600
ARG NEXT_PUBLIC_ADSENSE_SLOT_970X250
ENV NEXT_OUTPUT=standalone NODE_ENV=production
# `node --env-file`, not `. file` in a shell: a secret containing `$` or a backtick is
# read literally instead of being expanded. Variables already in the environment (the
# arguments passed above, NODE_ENV, NEXT_OUTPUT) take precedence over the file.
RUN --mount=type=secret,id=portal_env,required=false \
    if [ -f /run/secrets/portal_env ]; then \
      node --env-file=/run/secrets/portal_env node_modules/next/dist/bin/next build; \
    else \
      node node_modules/next/dist/bin/next build; \
    fi

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
