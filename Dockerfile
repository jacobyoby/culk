# Production multi-stage Dockerfile with BuildKit optimizations
# syntax=docker/dockerfile:1

# Base stage
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN pnpm build

# Production stage
FROM node:20-alpine AS production
RUN apk add --no-cache curl
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]

# Test stage
FROM base AS test
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm install --frozen-lockfile
RUN npx playwright install --with-deps chromium
ENV CI true
CMD ["pnpm", "test:all"]