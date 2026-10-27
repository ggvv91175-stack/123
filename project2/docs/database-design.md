# 校园版咸鱼 — 数据库设计与初始化（Task 2）

> 对应 tasks.md Task 2（SubTask 2.1 / 2.2 / 2.3），依赖 `docs/architecture.md`（Task 1）。
> 数据库：**SQLite**（单文件，WAL 模式）；交付物：本文档 + `sql/schema.sql`（幂等建表）+ `sql/seed.sql`（种子数据）。
> 字段基线：spec 3.2 数据模型概要，无删减。

| 文档版本 | 日期 | 状态 |
| --- | --- | --- |
| v1.0 | 2026-10-18 | 待评审冻结 |

---

## 1. 设计约定

| 项 | 约定 | 依据 |
| --- | --- | --- |
| 命名 | 表/列小写下划线；主键 `id INTEGER PRIMARY KEY AUTOINCREMENT` | SQLite 惯例 |
| 订单表名 | **`orders`**（`order` 是 SQL 保留字，实体类仍为 Order） | architecture.md D4 |
| 主键/外键 | `foreign_keys=ON`（JDBC URL 参数，每连接生效）；FK 均建索引 | D2 |
| 枚举 | 用 `TEXT` + `CHECK` 约束存中文枚举值（与 API/前端展示一致，避免映射层） | SQLite TEXT 可含中文 |
| 时间 | `TEXT`，格式 `yyyy-MM-dd HH:mm:ss`（东八区）；默认值 `datetime('now','localtime')` 仅兜底，**统一由应用层（MyBatis-Plus 自动填充，Asia/Shanghai）写入** | spec 3.1 |
| 金额 | `REAL`（元），应用层校验 `0.01~999999.99` 两位小数；预算同 | 简化校园场景 |
| 图片 | 存 URL 数组的 JSON 字符串（`images TEXT`），上限 9 张由应用层校验 | spec 2.2 |
| 逻辑删除 | goods 用 `is_deleted`（0/1）；comment/report 用状态列（正常/已删除、待处理/已处理/已驳回） | spec 6.5 |
| 乐观锁 | `orders.version INTEGER DEFAULT 0`，MyBatis-Plus `@Version` + 状态条件 UPDATE | spec 5.7、D3 |
| 密码 | `password_hash TEXT` 存 BCrypt；**无明文列**（AC-13） | spec 6.2 |
| 幂等建表 | 全部 `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`，脚本可重复执行 | tasks.md 2.2 |

---

## 2. ER 关系总览

```
user 1──N goods N──1 category
user 1──N certification            （同一时刻至多一条"待审核/已通过"有效认证）
user 1──N want_buy
user 1──N comment N──1 goods
user 1──N report                   （多态目标：商品/用户/留言/求购 → target_type+target_id，不建 FK）
conversation: user(buyer_id) N──1 / user(seller_id) N──1；goods 1──N（可空）；want_buy 1──N（可空）
message N──1 conversation
orders: user(buyer_id) N──1 / user(seller_id) N──1；goods 1──N（可空）；want_buy 1──N（可空）
audit_log：多态（object_type+object_id），不建 FK
```

> 会话与订单的 `goods_id`、`want_id` 互斥可空：由商品发起 → 填 goods_id；由求购接单发起 → 填 want_id。

---

## 3. 表结构定义（11 张表）

### 3.1 user 用户

| 列 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | PK AUTOINCREMENT | 用户 ID |
| student_no | TEXT | NOT NULL UNIQUE | 学号（登录账号），如 `20211231245` |
| password_hash | TEXT | NOT NULL | BCrypt 哈希（含盐） |
| nickname | TEXT | NOT NULL | 昵称 |
| college | TEXT | | 学院（认证后展示） |
| phone | TEXT | | 手机号，仅本人可见（spec 6.2） |
| role | TEXT | NOT NULL DEFAULT 'student' CHECK(role IN('admin','student')) | 角色 |
| status | TEXT | NOT NULL DEFAULT '正常' CHECK(status IN('正常','禁用')) | 禁用后拒绝登录/发布/收发消息 |
| avatar | TEXT | | 头像 URL |
| is_certified | INTEGER | NOT NULL DEFAULT 0 | 0/1，认证通过后置 1 |
| created_at / updated_at | TEXT | NOT NULL | 时间（东八区） |

### 3.2 certification 实名认证

| 列 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | PK | |
| user_id | INTEGER | NOT NULL FK→user(id) | 申请人 |
| student_no | TEXT | NOT NULL | 认证学号 |
| college | TEXT | NOT NULL | 学院 |
| proof_images | TEXT | | 证明材料图片 URL JSON 数组（校园卡/学生证） |
| status | TEXT | NOT NULL DEFAULT '待审核' CHECK(status IN('待审核','已通过','已驳回')) | |
| reject_reason | TEXT | | 驳回理由（驳回必填，回显给用户，spec 5.2） |
| reviewer_id | INTEGER | FK→user(id) | 审核人（管理员） |
| review_time | TEXT | | 审核时间 |
| created_at | TEXT | NOT NULL | |

去重规则（spec 5.2 重复提交 409）：应用层校验"该用户存在待审核或已通过的认证记录则 409"；**已驳回的记录保留（留痕），重新提交插入新行**。

### 3.3 category 分类

| 列 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | PK | |
| name | TEXT | NOT NULL UNIQUE | 分类名（教材书籍…） |
| sort_order | INTEGER | NOT NULL DEFAULT 0 | 展示排序 |
| status | TEXT | NOT NULL DEFAULT '启用' CHECK(status IN('启用','停用')) | 停用=不再可选，历史商品不受影响 |
| created_at | TEXT | NOT NULL | |

删除被引用校验（spec 5.8）：应用层 `SELECT COUNT(*) FROM goods WHERE category_id=? AND is_deleted=0`，>0 返回 409。

### 3.4 goods 商品

| 列 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | PK | |
| user_id | INTEGER | NOT NULL FK→user(id) | 发布者 |
| title | TEXT | NOT NULL | 标题（≤50 字符，应用层校验） |
| price | REAL | NOT NULL CHECK(price >= 0.01 AND price <= 999999.99) | 价格（元） |
| category_id | INTEGER | NOT NULL FK→category(id) | 分类 |
| condition_level | TEXT | NOT NULL CHECK(condition_level IN('全新','几乎全新','轻微使用','明显使用痕迹')) | 新旧程度 4 级 |
| campus | TEXT | NOT NULL CHECK(campus IN('东区','西区','南区','北区')) | 校区 |
| trade_method | TEXT | NOT NULL CHECK(trade_method IN('当面交易','宿舍自提','校内其他')) | 交易方式 |
| description | TEXT | NOT NULL | 图文描述（文本部分） |
| images | TEXT | DEFAULT '[]' | 图片 URL JSON 数组，≤9 张（应用层校验） |
| status | TEXT | NOT NULL DEFAULT '待审核' CHECK(status IN('待审核','已驳回','在售','已下架','已售出','违规下架')) | 见下注 |
| reject_reason | TEXT | | 审核驳回理由 |
| is_deleted | INTEGER | NOT NULL DEFAULT 0 | 逻辑删除（删除后既有订单保留，spec 5.3） |
| created_at / updated_at | TEXT | NOT NULL | |

> **注（状态枚举补充）**：spec 3.2 列出 5 种状态（待审核/在售/已下架/已售出/违规下架）；为支撑 spec 2.2"修改被驳回商品重新进入待审核"与 2.6"驳回后重新提交"的闭环，增加 **`已驳回`** 状态（驳回商品对外不可见，编辑提交后回 `待审核`）。此为对 spec 的实现级补充，评审确认。

### 3.5 want_buy 求购

| 列 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | PK | |
| user_id | INTEGER | NOT NULL FK→user(id) | 求购者 |
| item_name | TEXT | NOT NULL | 物品名称 |
| budget | REAL | NOT NULL CHECK(budget >= 0.01 AND budget <= 999999.99) | 预算（元，0/负数被 CHECK 拦截） |
| expected_condition | TEXT | CHECK(expected_condition IN('全新','几乎全新','轻微使用','明显使用痕迹') OR expected_condition IS NULL) | 期望成色（可选） |
| campus | TEXT | CHECK(campus IN('东区','西区','南区','北区') OR campus IS NULL) | 可选 |
| remark | TEXT | | 备注 |
| status | TEXT | NOT NULL DEFAULT '进行中' CHECK(status IN('进行中','已成交','已关闭')) | 已关闭/已成交不可接单（409） |
| created_at / updated_at | TEXT | NOT NULL | 按创建时间倒序 |

### 3.6 comment 留言

| 列 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | PK | |
| goods_id | INTEGER | NOT NULL FK→goods(id) | |
| user_id | INTEGER | NOT NULL FK→user(id) | 留言人 |
| content | TEXT | NOT NULL | 内容（≤500 字符 + 敏感词过滤，spec 5.6） |
| status | TEXT | NOT NULL DEFAULT '正常' CHECK(status IN('正常','已删除')) | 删除为标记，不物理删 |
| created_at | TEXT | NOT NULL | 按时间正序展示 |

已下架商品禁新留言：应用层校验 goods.status 后拦截（409）；历史留言随详情接口隐藏。

### 3.7 conversation 会话

| 列 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | PK | |
| goods_id | INTEGER | FK→goods(id) | 商品来源（可空） |
| want_id | INTEGER | FK→want_buy(id) | 求购来源（可空） |
| buyer_id | INTEGER | NOT NULL FK→user(id) | 买方（发起聊一聊/接单方为 seller，见下） |
| seller_id | INTEGER | NOT NULL FK→user(id) | 卖方 |
| last_message_at | TEXT | | 会话列表按此倒序 |
| created_at | TEXT | NOT NULL | |

> 语义约定：聊一聊场景 buyer=点击方、seller=商品发布者；求购接单场景 **接单卖家=buyer_id 侧的发起人？** —— 统一定义：`buyer_id`=求购者/买家侧，`seller_id`=商品/货源提供者侧；接单时 seller=接单人，buyer=求购发布者。

### 3.8 message 私聊消息

| 列 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | PK | |
| conversation_id | INTEGER | NOT NULL FK→conversation(id) | |
| sender_id | INTEGER | NOT NULL FK→user(id) | 发送者（必须是会话参与者，否则 403） |
| content | TEXT | NOT NULL | 文本内容或图片 URL |
| msg_type | TEXT | NOT NULL DEFAULT '文本' CHECK(msg_type IN('文本','图片')) | 类型（spec 3.2） |
| is_read | INTEGER | NOT NULL DEFAULT 0 | 0/1；未读数=对方发送且 is_read=0 的条数 |
| created_at | TEXT | NOT NULL | 索引：conversation_id+created_at |

发送校验：接收方（另一参与者）status=禁用 → 发送失败提示（spec 5.6）；发送前过 AI 审核通道（D8）。

### 3.9 orders 订单

| 列 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | PK | |
| order_no | TEXT | NOT NULL UNIQUE | 订单号，规则 `XY+yyyyMMddHHmmss+4位随机`（应用层生成） |
| goods_id | INTEGER | FK→goods(id) | 关联商品（可空，与 want_id 互斥） |
| want_id | INTEGER | FK→want_buy(id) | 关联求购（可空） |
| buyer_id | INTEGER | NOT NULL FK→user(id) | 买家 |
| seller_id | INTEGER | NOT NULL FK→user(id) | 卖家 |
| status | TEXT | NOT NULL DEFAULT '待沟通' CHECK(status IN('待沟通','待交易','已完成','已取消')) | 状态机见 3.9.1 |
| appointment_time | TEXT | | 约定时间（应用层校验不得为过去时间，spec 5.7） |
| appointment_place | TEXT | | 约定地点 |
| remark | TEXT | | 备注 |
| version | INTEGER | NOT NULL DEFAULT 0 | **乐观锁**（并发状态流转仅一次生效） |
| created_at / updated_at | TEXT | NOT NULL | |

#### 3.9.1 订单状态机

```
待沟通 ──确认安排──▶ 待交易 ──确认完成──▶ 已完成(终态)
   │                  │
   └────── 取消 ──────┴────▶ 已取消(终态)     （仅"已完成"不可取消 → 409）
```
非法流转（如 已完成→待交易）一律 409；同商品存在进行中订单（待沟通/待交易）时禁止再建（409，spec 5.7）。

### 3.10 report 举报

| 列 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | PK | |
| reporter_id | INTEGER | NOT NULL FK→user(id) | 举报人 |
| target_type | TEXT | NOT NULL CHECK(target_type IN('商品','用户','留言','求购')) | 目标类型 4 种 |
| target_id | INTEGER | NOT NULL | 目标 ID（多态，不建 FK） |
| reason | TEXT | NOT NULL | 理由（非空且 ≤300 字符，spec 5.8） |
| evidence_images | TEXT | DEFAULT '[]' | 证据图片 URL JSON 数组 |
| status | TEXT | NOT NULL DEFAULT '待处理' CHECK(status IN('待处理','已处理','已驳回')) | |
| handle_result | TEXT | | 处理结果说明（驳回举报必填，留痕审计） |
| handle_action | TEXT | CHECK(handle_action IN('下架商品','封禁用户','删除留言','驳回举报') OR handle_action IS NULL) | 处理动作 |
| handler_id | INTEGER | FK→user(id) | 处理人 |
| handle_time | TEXT | | 处理时间 |
| created_at | TEXT | NOT NULL | |

**待处理去重**：部分唯一索引 `uk_report_pending (reporter_id, target_type, target_id) WHERE status='待处理'` —— 同一人对同一目标重复举报且旧举报仍待处理时直接 409（spec 5.8），不同举报人可各自举报。

### 3.11 audit_log 审核日志

| 列 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | PK | |
| object_type | TEXT | NOT NULL | 对象类型：商品/留言/私聊消息/实名认证/举报/用户 |
| object_id | INTEGER | NOT NULL | 对象 ID（多态） |
| action | TEXT | NOT NULL | 动作：AI审核/人工审核通过/人工驳回/下架/封禁/删除/复核等 |
| ai_suggestion | TEXT | CHECK(ai_suggestion IN('通过','疑似违规','拒绝') OR ai_suggestion IS NULL) | AI 建议 |
| hit_words | TEXT | | 命中敏感词 JSON 数组 |
| manual_conclusion | TEXT | | 人工最终结论 |
| operator_id | INTEGER | FK→user(id) | 操作人（AI 通道为 NULL） |
| created_at | TEXT | NOT NULL | 保留 ≥180 天（spec 6.5），只增不改 |

---

## 4. 索引清单

| 编号 | 索引 | 用途 | 依据 |
| --- | --- | --- | --- |
| I-01 | `uk_user_student_no(user_no)` UNIQUE | 学号唯一 + 登录查找 | spec 5.1 |
| I-02 | `idx_goods_category(category_id)` | 分类筛选 | spec 6.1 |
| I-03 | `idx_goods_campus(campus)` | 校区筛选 | spec 6.1 |
| I-04 | `idx_goods_status(status)` | 列表只查"在售"、待审核列表 | spec 6.1 |
| I-05 | `idx_goods_price(price)` | 价格区间/价格排序 | spec 6.1 |
| I-06 | `idx_goods_created(created_at DESC)` | 默认时间倒序 | spec 6.1 |
| I-07 | `idx_goods_user(user_id)` | 我的发布 | — |
| I-08 | `idx_comment_goods(goods_id, created_at)` | 留言正序分页 | — |
| I-09 | `idx_message_conv(conv_id, created_at)` | 聊天记录分页 | tasks.md 2.2 |
| I-10 | `idx_order_buyer(buyer_id)` / I-11 `idx_order_seller(seller_id)` / I-11b `idx_order_goods(goods_id)` | 我的买/卖列表、同商品进行中订单去重查询 | tasks.md 2.2 |
| I-12 | `uk_conv_goods(goods_id, buyer_id) WHERE goods_id IS NOT NULL` UNIQUE | 商品会话复用兜底 | D9 |
| I-13 | `uk_conv_want(want_id, buyer_id) WHERE want_id IS NOT NULL` UNIQUE | 求购会话复用兜底 | D9 |
| I-14 | `uk_report_pending(reporter_id, target_type, target_id) WHERE status='待处理'` UNIQUE | 重复举报 409 | spec 5.8 |
| I-15 | `idx_cert_user(user_id)` / I-16 `idx_report_status(status, created_at)` / I-17 `idx_want_status(status, created_at)` / I-18 `idx_audit_object(object_type, object_id)` | 认证/举报/求购/日志查询 | — |

---

## 5. 初始化方案（幂等 + 种子数据）

### 5.1 schema.sql（建表）

- 全部 `IF NOT EXISTS`，可重复执行无报错（tasks.md 2.3）；
- 脚本头部执行 `PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;`（应用连接仍以 JDBC URL 参数为准，见 architecture.md D2）；
- FK 均为 `ON DELETE RESTRICT`（关键业务数据不级联物理删除，配合逻辑删除满足 spec 6.5）。

### 5.2 seed.sql（种子数据）

| 数据 | 内容 | 说明 |
| --- | --- | --- |
| 管理员账号 | `student_no='admin'，role='admin'，password_hash='INIT_ON_FIRST_BOOT'` | **不放真实密码**：BCrypt 含随机盐无法离线预生成；`DataInitializer` 启动时检测占位符→写入 `admin123` 的 BCrypt 哈希（首次登录后建议修改）。满足 AC-13 |
| 默认分类 | 教材书籍 / 电子产品 / 生活用品 / 运动器材 / 服饰鞋包（sort 1~5，启用） | 支撑发布与筛选 |
| 校区 / 新旧程度 / 交易方式枚举 | **不建字典表**，以 CHECK 约束固化在 goods/want_buy（见 3.4/3.5）；枚举清单同步维护于后端常量类 `enums/*` 与前端字典，双方以本文 3.4/3.5 清单为准 | 11 张表外的字典表会扩大 schema 偏离 spec 3.2，故用 CHECK 方案 |
| 演示用户/商品 | **不放入 seed.sql** | 由开发/测试环境脚本或手工造数，避免污染生产初始化 |

### 5.3 验证清单（对应 tasks.md 2.3）

- [ ] schema.sql 在空库连续执行 2 次无报错；
- [ ] seed.sql 重复执行 2 次无报错（INSERT 用 `INSERT OR IGNORE`）；
- [ ] 11 张表与 spec 3.2 字段一一对应（本文 3.1~3.11 已对照）；
- [ ] user 表无明文密码列，password_hash 为 BCrypt（AC-13）；
- [ ] 插入非法枚举（如 goods.status='上线中'）被 CHECK 拒绝；
- [ ] 重复待处理举报触发 uk_report_pending 唯一冲突（模拟 spec 5.8）；
- [ ] FK 生效：删除仍被商品引用的 category 报 FOREIGN KEY 错误（应用层提前返回 409）。

---

## 6. 数据量与性能预估（spec 6.1）

| 表 | 校园规模预估 | 策略 |
| --- | --- | --- |
| goods | ~1 万行 | I-02~I-07 覆盖全部筛选项；列表只取必要列 + LIMIT 分页 |
| message | 高频增长（亿级为上限远） | 覆盖索引 I-09；前端分页拉取，不做全表扫描 |
| orders / report / audit_log | 低~中量 | 单列/组合索引即可 |

SQLite 单文件在万级数据 + WAL 下读性能远超 P95 800ms 指标；写热点（发消息、下单）通过短事务 + 乐观锁控制，见 architecture.md D2/D3。

---

## 变更记录

| 日期 | 变更 | 依据 |
| --- | --- | --- |
| 2026-10-18 | v1.0 初稿：11 张表设计（order→orders、新增 goods.已驳回状态、report 部分唯一索引、orders.version 乐观锁），索引 18 项，seed 不含明文密码 | spec 3.2/5/6；architecture.md；用户 SQLite 约束 |
