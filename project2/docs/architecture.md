# 校园版咸鱼 — 系统架构设计与技术选型（Task 1）

> 对应 tasks.md Task 1（SubTask 1.1 / 1.2 / 1.3）。
> 选型基线：**Java 8 + Spring Boot + SQLite**（用户指定约束，替代 tasks.md 中原推荐 MySQL + Redis 方案，理由见 3.1 关键决策 D1/D2）。
> 上游依据：`spec.md` 第 2/3/6 节；下游交付：`docs/database-design.md`（Task 2）、`docs/api.md`（Task 3）。

| 文档版本 | 日期 | 状态 |
| --- | --- | --- |
| v1.0 | 2026-10-18 | 待评审冻结 |

---

## 1. 总体架构

### 1.1 架构风格

前后端分离 B/S 架构、单体分层后端（Controller-Service-Mapper）。校园规模（≤500 并发在线、1 万级商品数据）下**单机部署即可满足 spec 6.1 性能指标**，不引入微服务。

```
┌──────────────────────────────────────────────────────────────┐
│  客户端：H5 移动端优先（iOS / Android / 微信内置浏览器 / 桌面浏览器）    │
│  Vue 3 + Vite + Vant 4 + Pinia + Axios                          │
└───────────────┬──────────────────────────────────────────────┘
                │ HTTPS (443)
┌───────────────▼──────────────────────────────────────────────┐
│  Nginx                                                         │
│  ├─ /            → 前端静态资源 dist/（gzip + 缓存）             │
│  ├─ /uploads/    → 本地磁盘图片静态托管（/data/uploads）           │
│  └─ /api/v1/**   → 反向代理 → Spring Boot :8080                 │
└───────────────┬──────────────────────────────────────────────┘
                │ HTTP (内网)
┌───────────────▼──────────────────────────────────────────────┐
│  Spring Boot 2.7.18 单体应用（Java 8）                          │
│  ├─ Filter/Interceptor 层：JWT 认证、RBAC 鉴权、限流、XSS 过滤     │
│  ├─ Controller 层：11 个业务模块 REST API（/api/v1）              │
│  ├─ Service 层：业务逻辑、状态机、AI 审核通道、事务边界              │
│  ├─ Mapper 层：MyBatis-Plus（参数化查询，防 SQL 注入）              │
│  └─ 基础设施：本地文件存储、Caffeine(Token黑名单/缓存)、Guava限流    │
└───────────────┬──────────────────────────────────────────────┘
                │ JDBC (WAL 模式)
┌───────────────▼──────────────────────────────────────────────┐
│  SQLite 单文件数据库 /data/campus.db                            │
│  11 张表；WAL 读写并发；每日文件级备份                            │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 请求处理链路（后端 Filter/Interceptor 顺序）

```
请求 → CorsFilter → XSS 过滤 Filter → JWT 认证 Interceptor（解析 Token → UserContext）
     → 限流 Interceptor（@RateLimit 注解，Guava RateLimiter，超限 429）
     → 角色/属主鉴权（@RequireRole + Service 内属主校验）
     → Controller（参数校验 @Validated）→ Service（业务 + 状态机 + 乐观锁）→ Mapper
异常统一由 GlobalExceptionHandler 转为 {code, message, data} 结构。
```

---

## 2. 模块划分

### 2.1 业务模块（与 spec 3.3~3.11 一一对应）

| 模块 | 职责 | spec 章节 |
| --- | --- | --- |
| auth 认证 | 注册、登录、退出（Token 黑名单）、JWT 签发 | 3.3 |
| user 用户与实名认证 | 个人信息、改密、实名认证提交/状态、他人主页脱敏 | 3.3 |
| goods 商品 | 商品 CRUD、上下架/已售出、我的发布、图片上传 | 3.4 / 3.9 |
| category 分类 | 公开列表、管理员增改停删（引用 409） | 3.5 |
| want 求购 | 求购 CRUD/关闭、卖家接单（自动建会话） | 3.6 |
| comment 留言 | 商品留言发表/分页/删除（本人或管理员） | 3.7 |
| chat 会话与消息 | 会话发起复用、会话列表+未读数、聊天记录、发送 | 3.7 |
| order 订单 | 创建订单、列表（买/卖）、状态机流转、取消、乐观锁 | 3.8 |
| report 举报 | 举报提交、待处理去重、管理员处理 | 3.9 / 3.10 |
| admin 平台管理 | 商品审核、认证审核、举报处理、用户禁用/启用、统计 | 3.10 |
| aiaudit AI 审核（可选） | 本地敏感词通道 + 外部 AI 预留、审核日志、人工复核 | 3.11 |

### 2.2 后端包结构（Java 8 + Spring Boot）

```
com.campus.xianyu
├── CampusXianyuApplication.java
├── config/                  # WebMvcConfig、MybatisPlusConfig(分页+乐观锁插件)、
│                            # OpenApiConfig、DataSourceProps(WAL pragma)
├── common/
│   ├── result/              # R<T> 统一响应、PageResult<T>、ErrorCode 枚举
│   ├── exception/           # BizException、GlobalExceptionHandler(@RestControllerAdvice)
│   ├── auth/                # JwtUtil(jjwt)、AuthInterceptor、@RequireLogin、@RequireRole、
│   │                        # UserContext(ThreadLocal 当前用户)、TokenBlacklist(Caffeine)
│   ├── ratelimit/           # @RateLimit、RateLimitInterceptor(Guava RateLimiter)
│   └── util/                # MaskUtil(学号脱敏)、SensitiveWordUtil、IdGen(订单号)
├── module/
│   ├── auth/  user/  goods/  category/  want/  comment/  chat/  order/  report/  admin/  aiaudit/
│   │                        # 每模块：*Controller、*Service(+Impl)、*Mapper、entity/*、dto/*
├── infrastructure/
│   ├── storage/             # FileStorage 接口 + LocalFileStorage 实现（预留 OSS）
│   └── init/                # DataInitializer(CommandLineRunner)：管理员密码 BCrypt 初始化
└── sql/（工程外）            # schema.sql、seed.sql（见 Task 2 交付）
```

分层规则：Controller 只做参数校验与组装，禁止写业务；Service 是事务与状态机唯一入口；Mapper 只做数据访问（MyBatis-Plus，全部参数化）。

---

## 3. 技术选型

### 3.1 选型清单（推荐方案）

| 层 | 技术 | 版本 | 选型理由 | 备选 |
| --- | --- | --- | --- | --- |
| 运行时 | Java | 8 | 用户指定约束 | — |
| 框架 | Spring Boot | **2.7.18** | 2.x 终版、完整支持 Java 8；**Spring Boot 3.x 要求 Java 17**，与约束冲突 | Spring Boot 2.7.13+ 任一 2.7 补丁版 |
| ORM | MyBatis-Plus | 3.5.3.2 | 内置 `DbType.SQLITE` 分页方言、乐观锁插件（`@Version`）、逻辑删除、全参数化防注入 | Spring Data JPA（Hibernate 方言不认 SQLite，需自配 dialect，成本更高） |
| 驱动 | org.xerial:sqlite-jdbc | 3.42.0.0 | 官方维护、URL 参数直接配置 WAL/busy_timeout/foreign_keys | — |
| 连接池 | HikariCP（Boot 自带） | 4.0.3 | SQLite 单写者，池上限收敛（maxPool=10）| — |
| 认证 | jjwt | 0.11.5 | JWT 签发/校验轻量成熟 | java-jwt |
| 密码 | spring-security-crypto | 5.7.11 | 仅引 `BCryptPasswordEncoder`，不引入整套 Spring Security（拦截器方案更简单可控） | 完整 Spring Security（对本项目过重） |
| Token 黑名单/缓存 | Caffeine | 2.9.3 | 2.x 兼容 Java 8（3.x 需 Java 11）；TTL 自动过期，替代 Redis 黑名单 | ConcurrentHashMap + 定时清理 |
| 限流 | Guava | 32.1.3-jre | `RateLimiter` 按用户/动作令牌桶，10 次/分钟 → 429 | Bucket4j |
| API 文档 | springdoc-openapi-ui | 1.7.1 | 兼容 Boot 2.7，自动生成 Swagger，前后端契约评审 | springfox（已停更） |
| 简化样板 | Lombok | 1.18.30 | — | — |
| 参数校验 | spring-boot-starter-validation | Boot 2.7 内置 | Hibernate Validator | — |
| 前端 | Vue 3 + Vite + Vant 4 + Pinia + Axios | — | H5 移动端优先（spec 6.3），Vant 为移动端组件库；**演示原型已按 Element Plus 搭建（campus-xianyu-ui），评审时可二选一** | Element Plus（原型在用） |
| 部署 | Nginx + systemd / Docker Compose | — | 单机部署；SQLite 无独立 DB 进程，Compose 仅 2 个服务（nginx + app） | — |

### 3.2 关键技术决策（ADR 摘要）

**D1 不引入 Redis，用 Caffeine 内存方案**
- SQLite 轻量单机定位下，Redis 仅服务两件事：Token 黑名单、限流计数。Caffeine（TTL=Token 剩余有效期）+ Guava RateLimiter 完全覆盖，少一个运维组件。
- 兜底：服务重启黑名单清空 → 依赖 JWT 短有效期（2h，spec 6.2）+ 每次请求实时校验用户状态（禁用用户即使 Token 未过期也立即 401），风险可接受。
- 预留：`TokenBlacklist`、`RateLimiterRegistry` 定义为接口，未来换 Redis 只换实现。

**D2 SQLite 并发策略（单写者多读者）**
- JDBC URL 携带连接级参数：`jdbc:sqlite:/data/campus.db?journal_mode=WAL&busy_timeout=5000&foreign_keys=true`（WAL 写入 DB 文件头持久生效；busy_timeout/foreign_keys 每连接生效，走 URL 参数最可靠）。
- WAL 允许读写并发；写事务在 Service 层保持短小（`@Transactional` 不包远程调用/文件 IO）。
- HikariCP `maximumPoolSize=10`；写热点仅订单状态流转，用乐观锁收敛（D3）。
- 500 并发浏览为读操作，WAL 下无锁阻塞；**AC-12 达标前提是本方案单机部署**，超预期量再演进 MySQL。

**D3 订单并发用乐观锁（spec 5.7）**
- `orders` 表加 `version` 字段；MyBatis-Plus `OptimisticLockerInnerInterceptor` + 状态条件 UPDATE（`WHERE status='待沟通'`），并发"同时确认完成"仅一次生效，失败方返回 409。

**D4 表名 `orders` 而非 `order`**
- `ORDER` 是 SQL 保留字，SQLite 中需引号转义且易踩坑，表名统一 `orders`（实体类仍叫 Order）。

**D5 管理员密码初始化走 DataInitializer**
- BCrypt 哈希含随机盐，无法离线预生成写入 seed.sql。`seed.sql` 插入管理员行时 `password_hash` 置占位符 `'INIT_ON_FIRST_BOOT'`，`DataInitializer`（CommandLineRunner）启动时检测占位符则生成默认密码（admin123）的 BCrypt 哈希并回写，首次登录后建议修改。满足 AC-13（库中零明文）。

**D6 文件上传：本地磁盘 + Nginx 托管，预留对象存储**
- 上传接口按 `uploads/yyyyMM/uuid.ext` 重命名落盘（禁止执行权限、校验 jpg/png/webp、单张 ≤5MB），Nginx `/uploads/` 静态托管。
- 幂等：客户端携带 `fileHash(MD5)`，服务端按 hash 查重返回同一 URL（spec 5.9 弱网重试）。
- `infrastructure/storage/FileStorage` 为接口，未来切 OSS 只加实现类。

**D7 权限模型：双角色 + 三层校验**
- 仅 `admin` / `student` 两种角色（spec 6.4 RBAC 预留扩展位，user.role 字段可直接扩 `String` 枚举）。
- 三层校验：①拦截器统一验 JWT 与 `/admin/**` 垂直权限（学生一律 403）；②`@RequireRole` 注解声明式控制；③Service 内属主/参与者校验（改他人商品、非会话参与者 → 403，水平越权）。

**D8 AI 审核为独立通道（SPI），可开关可替换（spec 2.7 / 6.4）**
```java
public interface AuditChannel {
    AuditResult auditText(String text);     // 通过 / 疑似违规 / 拒绝 + 命中词
    AuditResult auditImage(String url);     // 预留
}
// 实现①：LocalSensitiveWordChannel（DFA 敏感词库，默认开启，"拒绝"直接拦截发布/留言/私聊）
// 实现②：ExternalAiChannel（预留，疑似违规 → 人工复核队列 audit_log）
// ai.audit.enabled 开关；审核动作全部落 audit_log（保留 ≥180 天，spec 6.5）
```

**D9 会话去重（spec 3.7"存在则复用"）**
- 应用层按 (goodsId/wantId + buyerId) 查询复用；SQLite 部分唯一索引兜底（见 database-design.md 索引清单 I-12/I-13），并发发起也不会产生重复会话。

---

## 4. 部署拓扑

### 4.1 单机部署（推荐，满足 spec 6.1 指标）

```
校园服务器（Linux，≥2C4G）
├── Nginx :443 (HTTPS，Let's Encrypt 证书)
│   ├── location /          → /opt/campus-xianyu/web/dist   （前端静态，gzip）
│   ├── location /uploads/  → /data/uploads                 （图片，只读）
│   └── location /api/      → proxy_pass http://127.0.0.1:8080/api/
├── campus-xianyu.jar  (systemd 托管，-Xms512m -Xmx1024m，JVM 时区 Asia/Shanghai)
├── /data/campus.db    （SQLite 主库文件，WAL：campus.db-wal/-shm）
├── /data/uploads/     （图片目录）
└── /data/backup/      （cron 每日 03:00 备份：sqlite3 ".backup" 保留 30 份，spec 6.5）
```

### 4.2 Docker Compose（可选等价部署）

```yaml
services:
  app:
    image: eclipse-temurin:8-jre
    working_dir: /app
    command: java -jar campus-xianyu.jar
    volumes: [ "./data:/data" ]
    environment: [ "TZ=Asia/Shanghai", "SPRING_DATASOURCE_URL=jdbc:sqlite:/data/campus.db?journal_mode=WAL&busy_timeout=5000&foreign_keys=true" ]
  nginx:
    image: nginx:alpine
    ports: [ "443:443", "80:80" ]
    volumes: [ "./web/dist:/usr/share/nginx/html:ro", "./data/uploads:/data/uploads:ro", "./nginx.conf:/etc/nginx/conf.d/default.conf:ro" ]
    depends_on: [ app ]
```

> SQLite 数据库是**单文件**，务必将 `/data` 挂载为宿主卷；应用仅可单实例运行（D2），不可水平扩容后共享同一 db 文件挂载。

---

## 5. 权限模型

| 角色 | 能力范围 | 实现要点 |
| --- | --- | --- |
| student 学生 | 注册登录、认证、发布/求购/留言/私聊、下单、举报 | 默认角色 |
| admin 管理员 | student 全部能力 + 审核商品/认证、处理举报、禁用用户、分类管理、统计、AI 复核 | `/admin/**` 垂直拦截：非 admin 一律 403（AC-10） |

鉴权分层（详细矩阵见 `docs/api.md` 第 4 节）：
1. **公开**：注册/登录、商品列表/详情、留言列表、分类列表；
2. **登录**：其余业务接口（JWT 有效 + 用户状态=正常，禁用用户 401）；
3. **资源属主/参与者**：Service 层校验（发布者改删商品、会话参与者收发消息、订单参与方流转），失败 403；
4. **管理员**：`/admin/**` + 分类写接口，`@RequireRole(ADMIN)`。

---

## 6. 非功能性需求对照（spec 第 6 节 → 本方案）

| spec 条目 | 指标/要求 | 本方案落点 |
| --- | --- | --- |
| 6.1 性能 | P95 ≤ 800ms；1 万级商品列表 ≤1s；≥500 并发 | 单机单体 + SQLite WAL；goods 五维索引（Task 2）；分页 pageSize ≤50；列表图片缩略图由前端裁剪参数实现 |
| 6.2 安全 | HTTPS、bcrypt、JWT 2h+黑名单、防注入/XSS/CSRF、越权双校验、脱敏、限流、上传校验 | Nginx TLS；BCryptPasswordEncoder；jjwt+Caffeine 黑名单；MyBatis-Plus 全参数化；XSS 过滤 Filter + 前端转义/CSP；三层鉴权（D7）；MaskUtil 学号打码、手机号仅本人可见；Guava 限流 429；上传白名单+UUID 重命名（D6）；敏感操作写 audit_log |
| 6.3 兼容性 | H5 移动端优先、微信内置浏览器 | Vant 4 移动端组件、响应式布局；后端纯 REST 无浏览器耦合 |
| 6.4 可维护/扩展 | 双角色 RBAC 预留、置换/捐赠/教材专区预留、AI 可开关 | role 字段扩展位（D7）；模块化分包（2.2），新扩展=新增 module 包；AI SPI 通道（D8）；无支付无合规负担 |
| 6.5 数据 | 每日备份、逻辑删除优先、审核日志 ≥180 天 | cron `sqlite3 .backup`（4.1）；goods 逻辑删除、comment/report 状态标记；audit_log 只增不改 |

---

## 7. 扩展模块预留

| 预留点 | 设计 |
| --- | --- |
| 闲置置换 / 公益捐赠 / 教材专区 | 新增独立 `module/*` 包 + 复用 goods 表加业务标记列或新表；分类字典预留"教材"类目；不影响既有 11 张表结构 |
| AI 审核外部服务 | `AuditChannel` SPI（D8），`ExternalAiChannel` 实现 HTTP 调用外部审核 API；`疑似违规` 结果进 `audit_log` 人工复核队列，`/admin/ai-audit/*` 已在 api.md 预留 |
| 对象存储 | `FileStorage` 接口（D6），增加 `OssFileStorage` 实现即可切换，URL 结构不变 |
| 支付 | 明确不做（spec What Changes）；订单模型不涉及金额流转字段 |
| 微服务/多实例 | 当前单包单实例；模块化分包为未来拆分提供边界 |

---

## 8. 与下游任务的接口

- **Task 2（数据库）**：按本文 D2/D3/D4/D9 与 spec 3.2 完成 11 张表设计与 `sql/schema.sql`、`sql/seed.sql`，详见 `docs/database-design.md`。
- **Task 3（API）**：按本文 2.1 模块划分与 D7 权限模型输出 `docs/api.md`（接口契约、错误码、鉴权矩阵、限流）。
- **Task 4（工程初始化）**：按第 2.2 包结构与 3.1 版本清单搭建工程（Boot 2.7.18 + MP 3.5.3.2 + xerial 3.42 + jjwt + Caffeine + Guava）。

---

## 变更记录

| 日期 | 变更 | 依据 |
| --- | --- | --- |
| 2026-10-18 | v1.0 初稿：按用户约束将原 MySQL+Redis 方案调整为 SQLite+Caffeine/Guava，其余保持 tasks.md Task 1 范围 | 用户指定 Java 8 + Spring Boot + SQLite；spec 6 |
