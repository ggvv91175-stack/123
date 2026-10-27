# 校园版咸鱼 · 二手交易平台

前后端分离的校园二手交易平台。后端 NestJS + TypeORM，前端 Vue3 + Vite + Element Plus，支持本地 SQLite 快速开发与 Docker Compose + MySQL 一键编排部署。

- 后端代码：`server/`
- 前端代码：`campus-xianyu-ui/`
- 文档：`docs/`（需求、架构、数据库设计、API、评审、测试报告）
- 编排：`docker-compose.yml`（项目根）

---

## 一、本地一键启动（Docker Compose）

### 前置条件

- 已安装 Docker Desktop（Windows / macOS）或 Docker Engine + Compose 插件（Linux）
- 项目根目录存在 `docker-compose.yml`

### 步骤

```bash
# 1. 复制环境变量模板（首次启动需要）
cp .env.example .env
# 按需要修改 MYSQL_ROOT_PASSWORD / JWT_SECRET / CORS_ORIGIN

# 2. 构建并启动全部容器
docker compose up -d --build

# 3. 查看启动状态
docker compose ps
docker compose logs -f server
```

启动完成后访问：

| 入口 | 地址 |
| --- | --- |
| 前端页面 | http://localhost/ （或 `http://localhost:${WEB_PORT}`） |
| 后端健康检查 | http://localhost/api/v1/health |
| 后端 Swagger 文档 | http://localhost/api-docs |

MySQL 首次启动会自动执行 `server/sql/init.mysql.sql` 完成建表与种子数据；后续重启不会重复执行。

### 停止 / 重置

```bash
# 停止（保留数据卷）
docker compose down

# 停止并清空数据库与上传文件（完全重置，慎用）
docker compose down -v
```

---

## 二、线上部署方案

### 方案 A：单机服务器 + Docker Compose（推荐，最简单）

适用于一台云服务器（阿里云 / 腾讯云 / 华为云等）承载全部服务。

```bash
# 1. 服务器安装 Docker 与 Compose 插件
curl -fsSL https://get.docker.com | bash
sudo systemctl enable --now docker

# 2. 拉取代码
git clone <your-repo-url> campus-xianyu
cd campus-xianyu

# 3. 配置环境变量（务必修改密码与密钥）
cp .env.example .env
vim .env
#   MYSQL_ROOT_PASSWORD=<强密码>
#   JWT_SECRET=<64 位以上随机字符串>
#   CORS_ORIGIN=https://你的域名
#   WEB_PORT=80

# 4. 启动
docker compose up -d --build
```

#### 公网访问地址获取

1. **服务器公网 IP**：在云服务商控制台查看实例的弹性公网 IP（EIP）/ 公网 IP
2. **开放安全组端口**：放行 `80`（HTTP）/ `443`（HTTPS）；如需要远程连数据库再开 `3306`（不建议对公网开放）
3. **直接使用 IP 访问**：`http://<公网IP>/` 即可，无需额外配置
4. **绑定域名（推荐）**：
   - 在域名服务商处添加 `A 记录` 指向服务器公网 IP
   - 修改 `.env` 的 `CORS_ORIGIN=https://你的域名`
   - 重新启动：`docker compose up -d`

#### HTTPS（可选，推荐生产开启）

最简单做法：在 `web` 容器前再加一层网关（如 Caddy / Nginx + Let's Encrypt，或云厂商 SLB/CDN 自带证书）：

- Caddy 示例（`Caddyfile`）：
  ```
  xianyu.example.com {
      reverse_proxy localhost:80
  }
  ```
  Caddy 会自动签发并续期证书。
- 或在云厂商购买 / 申请免费证书，配置到负载均衡 / CDN。

### 方案 B：拆分到不同主机

- 前端静态资源：构建后放到对象存储 + CDN（见"图片存储方案"）
- 后端：单台服务器 `docker compose up -d server mysql`（或只用云数据库 RDS）
- 数据库：云 RDS MySQL8，环境变量改为 RDS 地址，删除 compose 中的 `mysql` 服务

---

## 三、环境变量说明

### 项目根 `.env`（供 docker-compose 插值）

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MYSQL_ROOT_PASSWORD` | `root123456` | MySQL root 密码，server 容器复用 |
| `JWT_SECRET` | `please-change-me-...` | JWT 签名密钥，生产必须改 |
| `JWT_EXPIRES_IN` | `2h` | JWT 过期时间 |
| `CORS_ORIGIN` | `http://localhost` | 允许跨域来源，逗号分隔多个 |
| `WEB_PORT` | `80` | 前端对外端口 |
| `MYSQL_PORT` | `3306` | MySQL 对外端口（调试用） |

### 后端 `server/.env`（本地开发，非 Docker）

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `APP_PORT` | `8080` | 后端监听端口 |
| `DB_TYPE` | `sqlite` | `sqlite` 本地开发 / `mysql` Docker & 生产 |
| `DB_FILE` | `./data/campus_xianyu.db` | SQLite 文件路径 |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASS` / `DB_NAME` | — | MySQL 连接（`DB_TYPE=mysql` 时生效） |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | — | 同上 |
| `CORS_ORIGIN` | `http://localhost:5173` | 同上 |
| `UPLOAD_DIR` | `./uploads` | 上传文件存储目录 |

---

## 四、域名 / 端口配置说明

| 场景 | 前端访问入口 | 后端实际地址 | 需要修改的配置 |
| --- | --- | --- | --- |
| 本地 Docker | `http://localhost/` | 容器内 `server:8080`（nginx 反代） | 无 |
| 本地 Docker 改端口 | `http://localhost:8088/` | 同上 | `.env` 的 `WEB_PORT=8088` |
| 服务器 + IP 直连 | `http://<公网IP>/` | 同上 | 安全组放行 80 |
| 服务器 + 域名 | `https://xianyu.example.com/` | 同上 | 域名解析 + `CORS_ORIGIN=https://xianyu.example.com` |
| 服务器 + 域名 + CDN | 同上 | 同上 | CDN 回源到服务器 80 端口 |

前端容器内 Nginx 已将以下路径反向代理到后端，无需修改前端代码：

- `/api/**` → `http://server:8080/api/**`
- `/uploads/**` → `http://server:8080/uploads/**`
- `/socket.io/**` → `http://server:8080/socket.io/**`（WebSocket）

因此前端代码中的接口地址写相对路径 `/api/v1/...` 即可，与开发环境通过 Vite 代理的行为一致。

---

## 五、图片存储方案

### 当前默认方案（本地磁盘 + 命名卷）

- 后端接收上传后存入容器内 `/app/uploads`
- `docker-compose.yml` 将该目录挂载到命名卷 `uploads-data`，容器重建不丢数据
- 前端通过 Nginx 反代 `/uploads/**` 访问图片

### 扩展为对象存储（OSS / COS / S3）

当图片量大或需要 CDN 加速时，建议替换为对象存储：

1. 安装 SDK：`npm i ali-oss`（或 `@cos-nodejs-sdk-v5` / `aws-sdk`）
2. 改造 `server/src/modules/upload/upload.service.ts`：把"写本地磁盘"改为"上传到 OSS 并返回 URL"
3. 前端无需改动：接口返回值中带上完整 URL，`<img src>` 直接引用
4. 环境变量新增：
   ```
   OSS_REGION=
   OSS_BUCKET=
   OSS_ACCESS_KEY_ID=
   OSS_ACCESS_KEY_SECRET=
   OSS_PUBLIC_DOMAIN=https://cdn.example.com
   ```
5. 删除 `docker-compose.yml` 中的 `uploads-data` 卷与 Nginx 的 `/uploads/` 反代（改为走 OSS 域名）

---

## 六、预置测试账号

`init.mysql.sql` / `init.sql` 会自动写入以下账号（密码已 bcrypt 哈希，库中零明文）：

| 账号（学号） | 密码 | 角色 | 实名状态 | 用途 |
| --- | --- | --- | --- | --- |
| `admin` | `admin123` | 管理员 | 已认证 | 管理后台登录：用户/实名/商品/举报/分类管理、数据看板 |
| `20211231245` | `abc12345` | 学生 | **已认证**（含审核通过记录） | 普通用户全流程：发布商品/求购、接单、私聊、下单 |
| `20211231246` | `abc12345` | 学生 | **未认证** | 验证未实名拦截、提交实名审核流程 |

> 首次部署完成后请立即修改 `admin` 密码。

---

## 七、常用命令速查

```bash
# 查看运行状态
docker compose ps

# 查看后端日志
docker compose logs -f server

# 进入 MySQL 容器
docker compose exec mysql mysql -uroot -p$MYSQL_ROOT_PASSWORD campus_xianyu

# 重启单个服务
docker compose restart server

# 重新构建并启动（代码变更后）
docker compose up -d --build

# 清理未使用镜像
docker image prune
```

---

## 八、目录结构

```
project2/
├── docker-compose.yml        # 一键编排（web + server + mysql）
├── .env.example              # compose 环境变量模板
├── server/                   # 后端 NestJS
│   ├── Dockerfile            # 后端多阶段构建
│   ├── .dockerignore
│   ├── .env.example          # 本地开发环境变量模板
│   ├── sql/
│   │   ├── init.sql          # SQLite 初始化
│   │   └── init.mysql.sql    # MySQL 初始化（Docker 自动执行）
│   └── src/
├── campus-xianyu-ui/         # 前端 Vue3 + Vite
│   ├── Dockerfile            # 前端构建 + Nginx 托管
│   ├── nginx.conf            # 容器内反代配置
│   └── .dockerignore
└── docs/                     # 需求 / 架构 / 数据库 / API / 评审 / 测试报告
```
