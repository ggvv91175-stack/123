# 校园版咸鱼 — 前端镜像（Vite 构建静态资源 + Nginx 托管 + 反代后端/WebSocket）
# 构建：docker build -t campus-xianyu-web ./campus-xianyu-ui

# ---- 阶段1：构建 ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- 阶段2：Nginx 托管 ----
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ || exit 1
