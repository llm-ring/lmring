# syntax=docker/dockerfile:1

# ================================
# Stage 1: Dependencies
# ================================
FROM node:24.12.0-alpine AS deps

# Install dependencies required for native modules
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/database/package.json ./packages/database/
COPY packages/auth/package.json ./packages/auth/
COPY packages/ui/package.json ./packages/ui/
COPY packages/ai-hub/package.json ./packages/ai-hub/
COPY packages/i18n/package.json ./packages/i18n/
COPY packages/env/package.json ./packages/env/
COPY packages/config/biome-config/package.json ./packages/config/biome-config/
COPY packages/config/tailwind-config/package.json ./packages/config/tailwind-config/
COPY packages/config/typescript-config/package.json ./packages/config/typescript-config/
COPY packages/model-depot/package.json ./packages/model-depot/

# Configure npm registry (optional)
# CN users can use: --build-arg NPM_REGISTRY=https://registry.npmmirror.com
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN pnpm config set registry ${NPM_REGISTRY}

# Install all dependencies with retry
RUN pnpm install --frozen-lockfile

# ================================
# Stage 2: Builder
# ================================
FROM node:24.12.0-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages

# Copy source code
COPY . .

# Set build environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build arguments for environment variables needed at build time
ARG DEPLOYMENT_MODE=selfhost
ARG NEXT_PUBLIC_DEPLOYMENT_MODE=selfhost
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000

ENV DEPLOYMENT_MODE=$DEPLOYMENT_MODE
ENV NEXT_PUBLIC_DEPLOYMENT_MODE=$NEXT_PUBLIC_DEPLOYMENT_MODE
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Build the application
RUN pnpm --filter @lmring/web build

# ================================
# Stage 3: Runner
# ================================
FROM node:24.12.0-alpine AS runner

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache libc6-compat

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/apps/web/public ./public

# Set correct permissions for prerender cache
RUN mkdir -p .next
RUN chown nextjs:nodejs .next

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Copy database migrations for Drizzle
COPY --from=builder --chown=nextjs:nodejs /app/packages/database/migrations ./packages/database/migrations
COPY --from=builder --chown=nextjs:nodejs /app/packages/database/drizzle.config.ts ./packages/database/

# Copy pnpm for running migrations
RUN corepack enable && corepack prepare pnpm@10.25.0 --activate
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/database/package.json ./packages/database/

# Configure npm registry (optional)
# CN users can use: --build-arg NPM_REGISTRY=https://registry.npmmirror.com
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN pnpm config set registry ${NPM_REGISTRY}

# Install only database dependencies for migrations
RUN pnpm install --filter @lmring/database --prod --frozen-lockfile

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check (using Node.js wget is not available in Alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the server
CMD ["node", "apps/web/server.js"]