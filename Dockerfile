# 构建应用
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

# 运行服务（主页 + 后台 API）
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOME_DATA_DIR=/app/data
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
VOLUME /app/data

EXPOSE 12445
CMD ["node", "server/index.js"]
