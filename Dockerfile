# syntax=docker/dockerfile:1

# ── deps ──────────────────────────────────────────────────────────────────
# Installed once, cached separately from source so editing app code doesn't
# invalidate the (slow) dependency install layer.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── builder ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Disables the Next.js telemetry ping during the build in CI/Docker.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── runner ────────────────────────────────────────────────────────────────
# `output: "standalone"` in next.config.ts traces only the files each route
# actually needs, so this final image ships without the full node_modules
# tree or the build toolchain.
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
