# 校园版咸鱼 — 后端镜像（NestJS + TypeORM，双数据库：SQLite/MySQL）
# 构建：docker build -t campus-xianyu-server ./server
# 说明：better-sqlite3 为原生模块，alpine(musl) 需编译工具链（仅构建/依赖阶段需要，运行时不带）

# ---- 阶段1：完整依赖 + TypeScript 构建 ----
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- 阶段2：生产依赖（原生模块编译产物随 node_modules 一起复制，运行时免工具链） ----
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---- 阶段3：运行时 ----
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
# 上传目录（compose 挂卷持久化）；SQLite 模式数据目录 ./data 同理
RUN mkdir -p /app/uploads /app/data
EXPOSE 8080
# 健康检查（busybox wget，无需额外安装）
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/v1/health || exit 1
CMD ["node", "dist/main.js"]
