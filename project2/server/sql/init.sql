-- =====================================================================
-- 校园版咸鱼 — SQLite 初始化脚本（一次性创建全部 10 张表 + 种子数据）
-- 幂等：CREATE TABLE IF NOT EXISTS / INSERT OR IGNORE，可重复执行
-- 说明：
--   1. SQLite 无 ENUM：枚举取值用 CHECK 约束固化在 DB 层
--   2. SQLite 无 JSON 列类型：JSON 数据以 TEXT 存储（ORM 侧 simple-json 序列化）
--   3. update_time 的自动刷新由 ORM（UpdateDateColumn）负责，DDL 仅给默认值
--   4. 公共字段约定：每张表均含 create_time / update_time / is_deleted
-- 执行方式：npm run db:init（scripts/init-db.js 读取本文件执行）
-- =====================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

-- ---------------------------------------------------------------------
-- 1. user 用户表（仅存密码哈希，无明文）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "user" (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,          -- 用户ID
  student_no    TEXT    NOT NULL UNIQUE,                    -- 学号（登录账号）
  password_hash TEXT    NOT NULL,                           -- bcrypt 密码哈希（含盐）
  nickname      TEXT    NOT NULL,                           -- 昵称
  college       TEXT,                                       -- 学院
  phone         TEXT,                                       -- 手机号（仅本人可见）
  role          TEXT    NOT NULL DEFAULT 'student'
                CHECK (role IN ('admin','student')),        -- 角色：admin=管理员, student=学生
  status        TEXT    NOT NULL DEFAULT '正常'
                CHECK (status IN ('正常','禁用')),           -- 账号状态：禁用后拒绝登录/发布/收发消息
  avatar        TEXT,                                       -- 头像URL
  is_certified  INTEGER NOT NULL DEFAULT 0,                 -- 是否已实名认证：0否 1是
  token_version INTEGER NOT NULL DEFAULT 0,                 -- Token版本号：修改密码/禁用时+1，旧Token全量失效
  create_time   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  update_time   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  is_deleted    INTEGER NOT NULL DEFAULT 0                  -- 逻辑删除：0否 1是
);

-- ---------------------------------------------------------------------
-- 2. real_auth 实名认证表（已驳回保留留痕，重新提交插入新行）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS real_auth (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,          -- 认证ID
  user_id       INTEGER NOT NULL,                           -- 申请人用户ID
  student_no    TEXT    NOT NULL,                           -- 认证学号
  college       TEXT    NOT NULL,                           -- 学院
  proof_images  TEXT,                                       -- 证明材料图片URL数组（JSON字符串）
  status        TEXT    NOT NULL DEFAULT '待审核'
                CHECK (status IN ('待审核','已通过','已驳回')),
  reject_reason TEXT,                                       -- 驳回理由（驳回必填，回显给用户）
  reviewer_id   INTEGER,                                    -- 审核人（管理员）ID
  review_time   TEXT,                                       -- 审核时间
  create_time   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  update_time   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  is_deleted    INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id)     REFERENCES "user"(id)     ON DELETE RESTRICT,
  FOREIGN KEY (reviewer_id) REFERENCES "user"(id)     ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_real_auth_user   ON real_auth (user_id);
CREATE INDEX IF NOT EXISTS idx_real_auth_status ON real_auth (status, create_time);

-- ---------------------------------------------------------------------
-- 3. category 分类表
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS category (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,            -- 分类ID
  name        TEXT    NOT NULL UNIQUE,                      -- 分类名
  sort_order  INTEGER NOT NULL DEFAULT 0,                   -- 展示排序（小在前）
  status      TEXT    NOT NULL DEFAULT '启用'
              CHECK (status IN ('启用','停用')),             -- 停用后不再可选，历史商品不受影响
  create_time TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  update_time TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  is_deleted  INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------
-- 4. goods 商品表
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS goods (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,        -- 商品ID
  user_id         INTEGER NOT NULL,                         -- 发布者用户ID
  title           TEXT    NOT NULL,                         -- 标题（≤50字符，应用层校验）
  price           REAL    NOT NULL CHECK (price BETWEEN 0.01 AND 999999.99),
  category_id     INTEGER NOT NULL,                         -- 分类ID
  condition_level TEXT    NOT NULL
                  CHECK (condition_level IN ('全新','几乎全新','轻微使用','明显使用痕迹')),
  campus          TEXT    NOT NULL
                  CHECK (campus IN ('东区','西区','南区','北区')),
  trade_method    TEXT    NOT NULL
                  CHECK (trade_method IN ('当面交易','宿舍自提','校内其他')),
  description     TEXT    NOT NULL,                         -- 图文描述（文本部分）
  images          TEXT,                                     -- 图片URL数组（JSON字符串，≤9张）
  status          TEXT    NOT NULL DEFAULT '待审核'
                  CHECK (status IN ('待审核','已驳回','在售','已下架','已售出','违规下架')),
  reject_reason   TEXT,                                     -- 审核驳回/违规下架理由
  version         INTEGER NOT NULL DEFAULT 0,               -- 乐观锁版本号（并发审核/编辑防覆盖）
  create_time     TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  update_time     TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  is_deleted      INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id)     REFERENCES "user"(id)   ON DELETE RESTRICT,
  FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_goods_category    ON goods (category_id);
CREATE INDEX IF NOT EXISTS idx_goods_campus      ON goods (campus);
CREATE INDEX IF NOT EXISTS idx_goods_status      ON goods (status);
CREATE INDEX IF NOT EXISTS idx_goods_price       ON goods (price);
CREATE INDEX IF NOT EXISTS idx_goods_create_time ON goods (create_time DESC);
CREATE INDEX IF NOT EXISTS idx_goods_user        ON goods (user_id, is_deleted);

-- ---------------------------------------------------------------------
-- 5. want_buy 求购表
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS want_buy (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,     -- 求购ID
  user_id            INTEGER NOT NULL,                      -- 求购者用户ID
  item_name          TEXT    NOT NULL,                      -- 物品名称（≤50字符，应用层校验）
  budget             REAL    NOT NULL CHECK (budget BETWEEN 0.01 AND 999999.99),
  expected_condition TEXT
                     CHECK (expected_condition IN ('全新','几乎全新','轻微使用','明显使用痕迹')),
  campus             TEXT
                     CHECK (campus IN ('东区','西区','南区','北区')),
  remark             TEXT,                                  -- 备注/描述（≤500字符）
  status             TEXT    NOT NULL DEFAULT '待接单'
                     CHECK (status IN ('待接单','已接单','已关闭')),  -- 已接单/已关闭不可接单（409）
  create_time        TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  update_time        TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  is_deleted         INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_want_status ON want_buy (status, create_time DESC);
CREATE INDEX IF NOT EXISTS idx_want_user   ON want_buy (user_id);

-- ---------------------------------------------------------------------
-- 6. message_comment 商品留言表（两层结构：顶层留言 + 回复平铺，回复的回复挂到顶层）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_comment (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,       -- 留言ID
  goods_id         INTEGER NOT NULL,                        -- 商品ID
  user_id          INTEGER NOT NULL,                        -- 留言人ID
  parent_id        INTEGER,                                 -- 顶层留言ID：回复非空；顶层留言为NULL
  reply_to_user_id INTEGER,                                 -- 被回复人用户ID：回复非空，冗余用于"xx 回复 yy"展示
  content          TEXT    NOT NULL,                        -- 留言内容（≤500字符，需过敏感词）
  status           TEXT    NOT NULL DEFAULT '正常'
                   CHECK (status IN ('正常','已删除')),      -- 删除为标记不物理删
  create_time      TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  update_time      TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  is_deleted       INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (goods_id)         REFERENCES goods(id)           ON DELETE RESTRICT,
  FOREIGN KEY (user_id)          REFERENCES "user"(id)          ON DELETE RESTRICT,
  FOREIGN KEY (parent_id)        REFERENCES message_comment(id) ON DELETE RESTRICT,
  FOREIGN KEY (reply_to_user_id) REFERENCES "user"(id)          ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_comment_goods  ON message_comment (goods_id, create_time);
CREATE INDEX IF NOT EXISTS idx_comment_parent ON message_comment (parent_id, create_time);

-- ---------------------------------------------------------------------
-- 7. chat_session 会话表（goods_id / want_id 互斥可空）
--    SQLite 唯一索引允许多个 NULL，天然实现"按来源去重"
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_session (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,      -- 会话ID
  goods_id          INTEGER,                                -- 来源商品ID（可空，与 want_id 互斥）
  want_id           INTEGER,                                -- 来源求购ID（可空，与 goods_id 互斥）
  buyer_id          INTEGER NOT NULL,                       -- 买家/求购者侧用户ID
  seller_id         INTEGER NOT NULL,                       -- 卖家/接单人侧用户ID
  last_message_time TEXT,                                   -- 最后一条消息时间（会话列表排序用）
  create_time       TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  update_time       TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  is_deleted        INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (goods_id)  REFERENCES goods(id)    ON DELETE RESTRICT,
  FOREIGN KEY (want_id)   REFERENCES want_buy(id) ON DELETE RESTRICT,
  FOREIGN KEY (buyer_id)  REFERENCES "user"(id)   ON DELETE RESTRICT,
  FOREIGN KEY (seller_id) REFERENCES "user"(id)   ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_session_goods ON chat_session (goods_id, buyer_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_session_want  ON chat_session (want_id, buyer_id);
CREATE INDEX IF NOT EXISTS idx_session_buyer  ON chat_session (buyer_id, last_message_time);
CREATE INDEX IF NOT EXISTS idx_session_seller ON chat_session (seller_id, last_message_time);

-- ---------------------------------------------------------------------
-- 8. chat_message 私聊消息表
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_message (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,            -- 消息ID
  session_id  INTEGER NOT NULL,                             -- 会话ID
  sender_id   INTEGER NOT NULL,                             -- 发送者ID（必须为会话参与者，否则403）
  content     TEXT    NOT NULL,                             -- 消息内容（文本或图片URL）
  msg_type    TEXT    NOT NULL DEFAULT '文本'
              CHECK (msg_type IN ('文本','图片')),
  is_read     INTEGER NOT NULL DEFAULT 0,                   -- 是否已读：未读数=对方发送且is_read=0
  create_time TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  update_time TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  is_deleted  INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES chat_session(id) ON DELETE RESTRICT,
  FOREIGN KEY (sender_id)  REFERENCES "user"(id)     ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_message_session ON chat_message (session_id, create_time);

-- ---------------------------------------------------------------------
-- 9. order_info 订单表（order 为保留字，故表名 order_info）
--    状态机：待沟通 → 待交易 → 已完成(终态)；待沟通/待交易 → 已取消(终态)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_info (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,      -- 订单ID
  order_no          TEXT    NOT NULL UNIQUE,                -- 订单号：XY+yyyyMMddHHmmss+6位随机
  goods_id          INTEGER,                                -- 关联商品ID（可空，与 want_id 互斥）
  want_id           INTEGER,                                -- 关联求购ID（可空，与 goods_id 互斥）
  buyer_id          INTEGER NOT NULL,                       -- 买家ID
  seller_id         INTEGER NOT NULL,                       -- 卖家ID
  status            TEXT    NOT NULL DEFAULT '待沟通'
                    CHECK (status IN ('待沟通','待交易','已完成','已取消')),  -- 非法流转返回409
  appointment_time  TEXT,                                   -- 约定时间（不得为过去时间）
  appointment_place TEXT,                                   -- 约定地点
  remark            TEXT,                                   -- 备注（≤500字符）
  version           INTEGER NOT NULL DEFAULT 0,             -- 乐观锁版本号（并发流转仅一次生效）
  create_time       TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  update_time       TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  is_deleted        INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (goods_id)  REFERENCES goods(id)    ON DELETE RESTRICT,
  FOREIGN KEY (want_id)   REFERENCES want_buy(id) ON DELETE RESTRICT,
  FOREIGN KEY (buyer_id)  REFERENCES "user"(id)   ON DELETE RESTRICT,
  FOREIGN KEY (seller_id) REFERENCES "user"(id)   ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_order_buyer ON order_info (buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_order_seller ON order_info (seller_id, status);
CREATE INDEX IF NOT EXISTS idx_order_goods ON order_info (goods_id);

-- ---------------------------------------------------------------------
-- 10. report 举报表（target 多态：商品/用户/留言/求购，不建外键）
--     重复待处理举报去重由应用层实现
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,        -- 举报ID
  reporter_id     INTEGER NOT NULL,                         -- 举报人ID
  target_type     TEXT    NOT NULL
                  CHECK (target_type IN ('商品','用户','留言','求购')),
  target_id       INTEGER NOT NULL,                         -- 举报目标ID
  reason          TEXT    NOT NULL,                         -- 举报理由（非空且≤300字符）
  evidence_images TEXT,                                     -- 证据图片URL数组（JSON字符串）
  status          TEXT    NOT NULL DEFAULT '待处理'
                  CHECK (status IN ('待处理','已处理','已驳回')),
  handle_action   TEXT
                  CHECK (handle_action IN ('下架商品','封禁用户','删除留言','警告用户','驳回举报')),
  handle_result   TEXT,                                     -- 处理结果说明（驳回举报必填，留痕审计）
  handler_id      INTEGER,                                  -- 处理人（管理员）ID
  handle_time     TEXT,                                     -- 处理时间
  create_time     TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  update_time     TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  is_deleted      INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (reporter_id) REFERENCES "user"(id) ON DELETE RESTRICT,
  FOREIGN KEY (handler_id)  REFERENCES "user"(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_report_pending ON report (reporter_id, target_type, target_id, status);
CREATE INDEX IF NOT EXISTS idx_report_status  ON report (status, create_time);

-- =====================================================================
-- 种子数据
-- 说明：
--   1. 管理员密码哈希为占位符 'INIT_ON_FIRST_BOOT'，请执行
--      npm run seed:accounts 生成真实 bcrypt 哈希（admin/admin123）。
--   2. 演示用户/商品等业务数据不放入本脚本，避免污染生产初始化。
-- =====================================================================

-- 管理员账号
INSERT OR IGNORE INTO "user" (id, student_no, password_hash, nickname, role, status, is_certified)
VALUES (1, 'admin', 'INIT_ON_FIRST_BOOT', '平台管理员', 'admin', '正常', 1);

-- 默认分类
INSERT OR IGNORE INTO category (id, name, sort_order, status) VALUES
  (1, '教材书籍', 1, '启用'),
  (2, '电子产品', 2, '启用'),
  (3, '生活用品', 3, '启用'),
  (4, '运动器材', 4, '启用'),
  (5, '服饰鞋包', 5, '启用');
