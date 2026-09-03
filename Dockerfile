# ---------- Stage 1: install dependencies ----------
FROM node:24-alpine AS deps
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- Stage 2: build ----------
FROM node:24-alpine AS build
WORKDIR /app

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm run build
RUN pnpm prune --prod

# ---------- Stage 3: runtime ----------
FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
# V8 doesn't see the container memory limit; tell it explicitly (~75% of limit)
ENV NODE_OPTIONS="--max-old-space-size=768"

# Run as a non-root user
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -s /bin/sh -D nodejs

COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/package.json ./

USER nodejs

EXPOSE 3000

CMD ["node", "dist/src/main.js"]