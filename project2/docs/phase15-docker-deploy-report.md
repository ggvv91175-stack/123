# 阶段 15 交付与验证报告

> 时间：2026-10-25 · 范围：Docker Compose 一键编排 + 线上部署文档

## 一、交付物清单

| 文件 | 说明 |
| --- | --- |
| `docker-compose.yml`（项目根） | 三容器编排：mysql:8.0 + server(NestJS) + web(Nginx)，网络互通、健康检查依赖、命名卷持久化 |
| `server/Dockerfile` | 三阶段构建：builder（含原生模块编译工具链）→ deps（生产依赖）→ runtime（最小化运行时，含健康检查） |
| `server/.dockerignore` | 排除 node_modules/dist/data/uploads/.env/test/sql/scripts 等 |
| `campus-xianyu-ui/Dockerfile` | 两阶段：node 构建 dist → nginx:alpine 托管 |
| `campus-xianyu-ui/nginx.conf` | 容器内 Nginx：SPA fallback、`/api` `/uploads` `/socket.io` 反代到 `server:8080`、gzip、静态缓存 |
| `campus-xianyu-ui/.dockerignore` | 排除 node_modules/dist/.env 等 |
| `server/sql/init.mysql.sql` | MySQL8 初始化脚本（10 张表 + 幂等种子账号），由 mysql 容器 `/docker-entrypoint-initdb.d/` 首次启动自动执行 |
| `.env.example`（项目根） | compose 插值变量模板（MYSQL_ROOT_PASSWORD / JWT_SECRET / CORS_ORIGIN / WEB_PORT 等） |
| `server/.env.example` | 后端本地开发变量模板（新增 DB_TYPE/DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME） |
| `README.md`（项目根） | 完整部署文档：本地一键启动、线上部署方案、环境变量、域名端口、图片存储扩展、测试账号 |

## 二、关键技术改造

### 1. 后端支持双数据库（SQLite / MySQL）

- `server/src/app.module.ts`：`DB_TYPE=mysql` 时切换 TypeORM 到 mysql 驱动，否则走 better-sqlite3
- `server/src/main.ts`：SQLite 建目录逻辑仅在非 mysql 模式下执行
- `server/src/common/filters/global-exception.filter.ts`：新增 MySQL 错误码映射（1062 唯一冲突→409、1451/1452 外键→409、3819 CHECK→400、1205/1213 锁→409）
- `server/package.json`：恢复 `mysql2` 依赖

### 2. MySQL8 初始化脚本

- 10 张表与 SQLite 版对齐（`order` 为保留字改名 `order_info`）
- MySQL 方言：`AUTO_INCREMENT`、`DATETIME ON UPDATE CURRENT_TIMESTAMP`、`CHECK`（8.0.16+）、`utf8mb4_unicode_ci`、InnoDB
- 种子数据幂等（`INSERT IGNORE`），bcrypt 哈希预计算（库中零明文密码）

## 三、验证结果

| 验证项 | 结果 | 说明 |
| --- | --- | --- |
| 后端 `npm run build` | ✅ 通过 | EXIT=0 |
| SQLite 模式全链路回归（phase14-smoke.mjs） | ✅ 21/21 PASS | 注册→实名→审核→发布→搜索→留言→私聊→订单→举报全流程不受影响 |
| Dockerfile 静态审查 | ✅ 通过 | 多阶段构建、lock 文件存在、.dockerignore 正确、健康检查可用 |
| nginx.conf 静态审查 | ✅ 通过 | upstream 服务名正确、`/api` `/uploads` `/socket.io` 反代与 Vite dev proxy 行为一致、WebSocket Upgrade 头完整 |
| docker-compose.yml 静态审查 | ✅ 通过 | mysql 健康检查 + server `depends_on: service_healthy`、init.sql bind mount 路径正确、命名卷持久化、环境变量插值完整 |
| **本机执行 `docker compose up`** | ⚠️ 未执行 | **本机国外 CDN（Microsoft Store / GitHub / Docker / Docker Hub）不可达，无法下载 Docker Desktop、WSL 离线包或 Ubuntu rootfs，故无法安装 Docker** |
| **本机等价验证（Nginx + Node）** | ✅ 通过 | 见下文 |

## 四、本机 Docker 安装受阻说明（2026-10-25）

### 已完成的准备工作

1. ✅ `dism` 提权启用 `VirtualMachinePlatform` 与 `Microsoft-Windows-Subsystem-Linux` 功能（已重启，`Get-WindowsOptionalFeature` 确认 `Enabled`）
2. ✅ 项目根 `.env` 已从模板创建
3. ✅ `resume-docker-setup.ps1` 已写好（WSL2+docker-ce 全自动脚本）

### 阻断原因

- Docker Desktop 官网 `desktop.docker.com`、`download.docker.com` → TLS 被重置（SNI 阻断）
- Microsoft Store 下载 CDN `tlu.dl.delivery.mp.microsoft.com`、`store.rg-adguard.net` → 连接失败
- GitHub `github.com` → 超时
- 国内镜像站（清华/阿里/华为云）**仅提供 docker-ce 的 apt/yum 包与 registry 镜像，不托管 Docker Desktop 安装包、WSL 离线包**

因此 WSL2 方案所需的 WSL 本体（Store）与 Ubuntu rootfs（Store）均无法下载，Docker Desktop 也无法下载。

### 替代等价验证（本机 Nginx + 后端 SQLite）

为证明编排逻辑与前后端联通正确，在本机复刻 compose 的网络拓扑：

| 组件 | 本机实现 | 对应 compose |
| --- | --- | --- |
| 前端静态托管 | winget 安装的 Nginx（监听 80）托管 `campus-xianyu-ui/dist` | `web` 容器（nginx:alpine） |
| 反代 `/api` `/uploads` `/socket.io` | Nginx `upstream backend 127.0.0.1:8080` | `nginx.conf` `upstream backend server:8080` |
| 后端 API | `npm run start`（SQLite 模式，端口 8080） | `server` 容器 |

验证结果（浏览器实测）：

- ✅ `http://localhost/` 首页正常渲染（导航栏、搜索框、商品列表）
- ✅ `admin/admin123` 登录管理后台成功，进入数据看板
- ✅ `http://localhost/api/v1/health` → `{"code":0,...,"status":"UP"}`
- ✅ Nginx 配置语法 `nginx -t` 通过，与容器内 `nginx.conf` 逻辑完全一致（仅 upstream 地址不同：本机 `127.0.0.1:8080` / 容器内 `server:8080`，后者由 compose 服务名 DNS 自动解析）

### 后续装 Docker 的路径

开启系统代理后（本机残留代理配置 `127.0.0.1:51081` 未运行），执行以下任一：

```bash
# 方案 A：Docker Desktop（需可访问 desktop.docker.com）
winget install -e --id Docker.DockerDesktop

# 方案 B：WSL2 + docker-ce（已写好全自动脚本）
powershell -ExecutionPolicy Bypass -File .trae\resume-docker-setup.ps1
```

任一方案成功后，在项目根执行：
```bash
cp .env.example .env
docker compose up -d --build
```

## 五、预置测试账号（与 README 一致）

| 账号 | 密码 | 角色 | 实名状态 |
| --- | --- | --- | --- |
| `admin` | `admin123` | 管理员 | 已认证 |
| `20211231245` | `abc12345` | 学生 | 已认证 |
| `20211231246` | `abc12345` | 学生 | 未认证 |

## 六、上线前 Checklist

- [ ] 修改 `.env` 中 `MYSQL_ROOT_PASSWORD`、`JWT_SECRET`（≥64 位随机字符串）
- [ ] 修改 `CORS_ORIGIN` 为正式域名
- [ ] 首次部署后立即修改 `admin` 账号密码
- [ ] 云上安全组仅放行 80/443，**不要**对公网开放 3306
- [ ] 图片量大后按 README 第五节扩展为对象存储（OSS/COS/S3）
