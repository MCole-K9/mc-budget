# ---- Build stage ----
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# PUBLIC_POCKETBASE_URL is baked in at build time.
# The app only accesses PocketBase server-side, so the internal
# Docker network hostname is correct here.
ARG PUBLIC_POCKETBASE_URL=http://pocketbase:8090
ENV PUBLIC_POCKETBASE_URL=$PUBLIC_POCKETBASE_URL

COPY . .
RUN bun run build

# ---- Production stage ----
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./

# Install only production dependencies
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "build"]
