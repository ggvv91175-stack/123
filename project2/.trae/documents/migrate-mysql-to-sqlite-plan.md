# 数据库迁移：MySQL → SQLite — 实施计划

## Context

项目后端（server/，NestJS 10 + TypeORM 0.3）当前使用 MySQL 8，用户要求改为 SQLite（单机文件库，免部署 MySQL 服务）。已确认决策：
1. 驱动用 **better-sqlite3**（TypeORM 标准 sqlite 驱动，Windows 预编译二进制）
2. 全文检索 **回退 LIKE 模糊匹配**（SQLite 无 ngram 全文索引；项目数据量级小）
3. **重写 `server/sql/init.sql` 为 SQLite 方言**，删除 MySQL 专用 migration-001~004.sql

现状要点（已探查确认）：
- TypeORM 配置在 [app.module.ts](file:///c:/Users/yzh/Desktop/Trae_projects/project2/server/src/app.module.ts#L29-L42)：`type:'mysql'` + host/port/timezone/charset，`synchronize:false`（表结构由 init.sql 管理）
- 6 个实体文件使用 MySQL 特有类型：`bigint unsigned`/`enum`/`tinyint(1)`/`decimal`/`json`，及 transformer（`bigintToNumber`/`tinyintToBoolean` 定义在 user.entity.ts，`decimalToNumber` 在 goods.entity.ts）：user.entity.ts、real-auth.entity.ts、goods.entity.ts、category.entity.ts、want-buy.entity.ts、chat-session.entity.ts
- [global-exception.filter.ts](file:///c:/Users/yzh/Desktop/Trae_projects/project2/server/src/common/filters/global-exception.filter.ts#L38-L59) 翻译 MySQL 错误码（ER_DUP_ENTRY/FK/CHECK/锁）
- 商品/求购搜索使用 `MATCH ... AGAINST (ngram)`：goods.service.ts L168-L186、want.service.ts L85-L101
- `mysql2` 在 dependencies；种子脚本 scripts/seed-test-accounts.js 用 mysql2/promise + `ON DUPLICATE KEY UPDATE`/`JSON_ARRAY()`/`NOW()`
- `.env`/`.env.example` 用 DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_DATABASE
- 根目录 `sql/schema.sql`、`sql/seed.sql` 是早期 Java 版的历史 SQLite 脚本（JDBC 注释），结构与当前 server 不同步（无 token_version 等）——**不动，server 以 server/sql/init.sql 为准**

## 改动清单

### 1. 依赖与配置
- `npm rm mysql2`；`npm i better-sqlite3` + `npm i -D @types/better-sqlite3`（若预编译下载失败，如实回报并改用 sql.js 方案）
- `.env` / `.env.example`：删除 DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD，将 `DB_DATABASE=campus_xianyu` 改为 `DB_FILE=./data/campus_xianyu.db`；`.gitignore` 增加 `server/data/`（若未忽略）
- [app.module.ts](file:///c:/Users/yzh/Desktop/Trae_projects/project2/server/src/app.module.ts)：TypeOrmModule 配置改为
  ```ts
  type: 'better-sqlite3',
  database: path.resolve(config.get<string>('DB_FILE', './data/campus_xianyu.db')),
  autoLoadEntities: true,
  synchronize: false,  // 表结构仍由 sql/init.sql 管理
  ```
  删除 host/port/username/password/timezone/charset（TypeORM sqlite 驱动默认开启 `PRAGMA foreign_keys=ON`）
- [main.ts](file:///c:/Users/yzh/Desktop/Trae_projects/project2/server/src/main.ts)：bootstrap 中 `fs.mkdirSync(path.dirname(dbFile), { recursive: true })` 确保数据目录存在；Swagger 描述更新为「SQLite」

### 2. 实体改造（6 个文件，统一映射规则）

| MySQL 写法 | SQLite 写法 |
|---|---|
| `@PrimaryGeneratedColumn({type:'bigint',unsigned:true})` | `@PrimaryGeneratedColumn()`（INTEGER PRIMARY KEY AUTOINCREMENT） |
| 普通 `bigint unsigned` 列 + `bigintToNumber` | `type:'integer'`，去 transformer（驱动读出即 number） |
| `tinyint(1)` + `tinyintToBoolean` | `type:'boolean'`（TypeORM 自动 0/1 ↔ boolean） |
| `decimal(10,2)` + `decimalToNumber` | `type:'real'`，去 transformer |
| `type:'enum', enum:[...]` | `type:'text'`（SQLite 无 ENUM；取值由 init.sql CHECK 约束 + class-validator 双层保证，TS 字面量联合类型保留） |
| `type:'json'` | `type:'simple-json'`（TypeORM 序列化为 TEXT） |
| 列选项 `comment/unsigned/width/precision/scale` | 全部移除（SQLite 不支持） |

- 删除 user.entity.ts 中 `bigintToNumber`/`tinyintToBoolean`、goods.entity.ts 中 `decimalToNumber` 定义及全部引用点（goods/category/want-buy/chat-session/real-auth 实体 import 同步清理）
- `datetime`/`CreateDateColumn`/`UpdateDateColumn` 保持不变（SQLite 以 TEXT 存 ISO 时间，TypeORM 驱动处理）
- 实体 `images: string[]`（goods）、`proofImages`（real_auth）改 `simple-json`

### 3. 重写 server/sql/init.sql（SQLite 方言，幂等）
- 头部：`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;`（WAL 提升读写并发）
- 按现有 init.sql 的 10 张表（user/real_auth/category/goods/want_buy/chat_session/chat_message/orders/comment/report，执行时读取完整文件逐表平移）应用第 2 节类型映射：
  - `BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT` → `INTEGER PRIMARY KEY AUTOINCREMENT`
  - `ENUM(...)` → `TEXT CHECK (col IN (...))`（取值固化在 DB 层）
  - `DECIMAL(10,2)` → `REAL`；`JSON` → `TEXT`；`TINYINT(1)` → `INTEGER DEFAULT 0`
  - `UNIQUE KEY uk_x(col)` → `UNIQUE(col)` 或 `CREATE UNIQUE INDEX IF NOT EXISTS`
  - `KEY idx_x(...)` → 独立 `CREATE INDEX IF NOT EXISTS idx_x ON t(col)`；**删除两个 FULLTEXT ngram 索引**
  - `ON UPDATE CURRENT_TIMESTAMP` → 删（由 ORM UpdateDateColumn 维护）；`COMMENT` → `--` 行注释；`ENGINE=InnoDB` → 删
  - 保留 CHECK 约束（如 price>=0.01 等，若有）；外键 `FOREIGN KEY ... REFERENCES ... ON DELETE RESTRICT` SQLite 原生支持
- 内容直接包含此前 migration-001~003 的终态（user.token_version、want_buy 三值枚举等）
- 删除 `server/sql/migration-001.sql` ~ `migration-004.sql`

### 4. 新增 scripts/init-db.js
用 better-sqlite3 读取 `sql/init.sql` 并 `db.exec()` 执行，输出建表结果；`package.json` 增加 `"db:init": "node scripts/init-db.js"`。首次使用流程：`npm run db:init` → `npm run seed:accounts`。

### 5. 重写 scripts/seed-test-accounts.js
- `mysql2/promise` → `better-sqlite3`（同步 API）；连接改为读 `DB_FILE`
- `INSERT ... ON DUPLICATE KEY UPDATE` → `INSERT ... ON CONFLICT(student_no) DO UPDATE SET ...`
- `JSON_ARRAY('...')` → 直接存 JSON 字符串 `'["..."]'`；`NOW()` → `datetime('now','localtime')`
- 账号与逻辑不变（admin/admin123、20211231245/abc12345 已认证、20211231246/abc12345 未认证）

### 6. 异常过滤器
[global-exception.filter.ts](file:///c:/Users/yzh/Desktop/Trae_projects/project2/server/src/common/filters/global-exception.filter.ts)：QueryFailedError 分支的 MySQL 错误码替换为 better-sqlite3 的 `err.driverError.code`（SQLite 扩展错误码）：
- `SQLITE_CONSTRAINT_UNIQUE` / `SQLITE_CONSTRAINT_PRIMARYKEY` → 409「数据冲突：记录已存在或违反唯一约束」
- `SQLITE_CONSTRAINT_FOREIGNKEY` → 409「数据冲突：存在关联数据，无法执行该操作」
- `SQLITE_CONSTRAINT_CHECK` → 400「参数错误：取值不合法」
- `SQLITE_BUSY` → 409「操作冲突，请重试」

### 7. 搜索回退 LIKE
- [goods.service.ts](file:///c:/Users/yzh/Desktop/Trae_projects/project2/server/src/modules/goods/goods.service.ts#L168-L186)、[want.service.ts](file:///c:/Users/yzh/Desktop/Trae_projects/project2/server/src/modules/want/want.service.ts#L85-L101)：删除 `MATCH AGAINST` 分支与「≥2字全文索引」注释，统一为参数化 `LIKE '%kw%'`（keyword 已 trim/空值归一，DTO 描述同步去掉「全文索引」字样）
- phase5.http 末尾 EXPLAIN 示例段删除或改为说明「SQLite 无全文索引，LIKE 扫描；数据量级小可接受」

### 8. 不改动的部分
- 业务服务逻辑（事务、条件更新防并发、守卫链）均为 TypeORM 方言无关代码，不改
- 根目录 `sql/schema.sql` / `sql/seed.sql`（早期 Java 版历史产物）不动
- test/phase2~4.http 用例不改（接口行为不变）

## 验证

1. `npm run build` 编译通过
2. `npm run db:init` 建库成功（生成 `server/data/campus_xianyu.db`）
3. `npm run seed:accounts` 三个账号落库
4. `npm run start:dev` 启动无报错（此前 MySQL 未启动导致连库失败的问题消失）
5. 冒烟：`GET /api/v1/health` 200；登录拿 token；`POST /goods` 发布 → `GET /goods?keyword=教材` 命中；`POST /wants` → `POST /wants/:id/accept` 接单建会话；上传图片正常
6. 抽查唯一约束冲突返回 409（重复注册同学号）

## 风险

- better-sqlite3 预编译下载失败（本机曾有 bcrypt 原生编译失败记录）→ 失败则回报并切换 sql.js
- SQLite 单文件写并发有限，但教学项目量级无影响
