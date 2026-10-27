-- =====================================================================
-- 校园版咸鱼 — SQLite 建表脚本（Task 2 / SubTask 2.2）
-- 幂等：全部 IF NOT EXISTS，可重复执行；详见 docs/database-design.md
-- 运行时连接以 JDBC URL 参数为准：
--   jdbc:sqlite:/data/campus.db?journal_mode=WAL&busy_timeout=5000&foreign_keys=true
-- =====================================================================
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

-- ---------------------------------------------------------------------
-- 1. user 用户表（AC-13：仅存密码哈希，无明文列）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    student_no    TEXT    NOT NULL UNIQUE,                -- 学号（登录账号）
    password_hash TEXT    NOT NULL,                       -- BCrypt 哈希（含盐）
    nickname      TEXT    NOT NULL,
    college       TEXT,                                   -- 学院
    phone         TEXT,                                   -- 手机号（仅本人可见）
    role          TEXT    NOT NULL DEFAULT 'student'
                  CHECK (role IN ('admin', 'student')),
    status        TEXT    NOT NULL DEFAULT '正常'
                  CHECK (status IN ('正常', '禁用')),
    avatar        TEXT,
    is_certified  INTEGER NOT NULL DEFAULT 0,             -- 0/1
    created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ---------------------------------------------------------------------
-- 2. certification 实名认证（已驳回保留留痕；重新提交插入新行）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certification (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    student_no   TEXT    NOT NULL,
    college      TEXT    NOT NULL,
    proof_images TEXT    DEFAULT '[]',                   -- 证明材料 URL JSON 数组
    status       TEXT    NOT NULL DEFAULT '待审核'
                 CHECK (status IN ('待审核', '已通过', '已驳回')),
    reject_reason TEXT,                                  -- 驳回必填（应用层校验）
    reviewer_id  INTEGER,
    review_time  TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id)     REFERENCES user(id) ON DELETE RESTRICT,
    FOREIGN KEY (reviewer_id) REFERENCES user(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_cert_user     ON certification (user_id);
CREATE INDEX IF NOT EXISTS idx_cert_status   ON certification (status, created_at);

-- ---------------------------------------------------------------------
-- 3. category 分类
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS category (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    status     TEXT    NOT NULL DEFAULT '启用' CHECK (status IN ('启用', '停用')),
    created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ---------------------------------------------------------------------
-- 4. goods 商品（状态含实现级补充：已驳回，见 database-design.md 3.4 注）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS goods (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    title           TEXT    NOT NULL,                    -- ≤50 字符（应用层校验）
    price           REAL    NOT NULL
                    CHECK (price >= 0.01 AND price <= 999999.99),
    category_id     INTEGER NOT NULL,
    condition_level TEXT    NOT NULL
                    CHECK (condition_level IN ('全新', '几乎全新', '轻微使用', '明显使用痕迹')),
    campus          TEXT    NOT NULL
                    CHECK (campus IN ('东区', '西区', '南区', '北区')),
    trade_method    TEXT    NOT NULL
                    CHECK (trade_method IN ('当面交易', '宿舍自提', '校内其他')),
    description     TEXT    NOT NULL,
    images          TEXT    DEFAULT '[]',                -- ≤9 张 URL JSON 数组（应用层校验）
    status          TEXT    NOT NULL DEFAULT '待审核'
                    CHECK (status IN ('待审核', '已驳回', '在售', '已下架', '已售出', '违规下架')),
    reject_reason   TEXT,
    is_deleted      INTEGER NOT NULL DEFAULT 0,          -- 逻辑删除，订单保留
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id)     REFERENCES user(id)     ON DELETE RESTRICT,
    FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE RESTRICT
);
-- spec 6.1：分类/校区/状态/价格/创建时间 五维索引
CREATE INDEX IF NOT EXISTS idx_goods_category ON goods (category_id);
CREATE INDEX IF NOT EXISTS idx_goods_campus   ON goods (campus);
CREATE INDEX IF NOT EXISTS idx_goods_status   ON goods (status);
CREATE INDEX IF NOT EXISTS idx_goods_price    ON goods (price);
CREATE INDEX IF NOT EXISTS idx_goods_created  ON goods (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goods_user     ON goods (user_id, is_deleted);

-- ---------------------------------------------------------------------
-- 5. want_buy 求购
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS want_buy (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            INTEGER NOT NULL,
    item_name          TEXT    NOT NULL,
    budget             REAL    NOT NULL
                       CHECK (budget >= 0.01 AND budget <= 999999.99),
    expected_condition TEXT
                       CHECK (expected_condition IN ('全新', '几乎全新', '轻微使用', '明显使用痕迹')
                              OR expected_condition IS NULL),
    campus             TEXT
                       CHECK (campus IN ('东区', '西区', '南区', '北区') OR campus IS NULL),
    remark             TEXT,
    status             TEXT    NOT NULL DEFAULT '进行中'
                       CHECK (status IN ('进行中', '已成交', '已关闭')),
    created_at         TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_want_status ON want_buy (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_want_user   ON want_buy (user_id);

-- ---------------------------------------------------------------------
-- 6. comment 商品留言
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comment (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    goods_id   INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    content    TEXT    NOT NULL,                          -- ≤500 字符 + 敏感词（应用层校验）
    status     TEXT    NOT NULL DEFAULT '正常' CHECK (status IN ('正常', '已删除')),
    created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (goods_id) REFERENCES goods(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id)  REFERENCES user(id)  ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_comment_goods ON comment (goods_id, created_at);

-- ---------------------------------------------------------------------
-- 7. conversation 会话（goods_id / want_id 互斥可空；部分唯一索引去重兜底）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversation (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    goods_id        INTEGER,
    want_id         INTEGER,
    buyer_id        INTEGER NOT NULL,                    -- 买家/求购者侧
    seller_id       INTEGER NOT NULL,                    -- 卖家/接单人侧
    last_message_at TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (goods_id)  REFERENCES goods(id)     ON DELETE RESTRICT,
    FOREIGN KEY (want_id)   REFERENCES want_buy(id)  ON DELETE RESTRICT,
    FOREIGN KEY (buyer_id)  REFERENCES user(id)      ON DELETE RESTRICT,
    FOREIGN KEY (seller_id) REFERENCES user(id)      ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_conv_goods ON conversation (goods_id, buyer_id)
    WHERE goods_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_conv_want  ON conversation (want_id, buyer_id)
    WHERE want_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conv_buyer  ON conversation (buyer_id,  last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_seller ON conversation (seller_id, last_message_at DESC);

-- ---------------------------------------------------------------------
-- 8. message 私聊消息
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    sender_id       INTEGER NOT NULL,
    content         TEXT    NOT NULL,
    msg_type        TEXT    NOT NULL DEFAULT '文本' CHECK (msg_type IN ('文本', '图片')),
    is_read         INTEGER NOT NULL DEFAULT 0,          -- 未读数 = 对方发送且 is_read=0
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (conversation_id) REFERENCES conversation(id) ON DELETE RESTRICT,
    FOREIGN KEY (sender_id)       REFERENCES user(id)         ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_message_conv ON message (conversation_id, created_at);

-- ---------------------------------------------------------------------
-- 9. orders 订单（order 为保留字故表名 orders；version 乐观锁）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no          TEXT    NOT NULL UNIQUE,           -- XY+yyyyMMddHHmmss+4位随机
    goods_id          INTEGER,
    want_id           INTEGER,
    buyer_id          INTEGER NOT NULL,
    seller_id         INTEGER NOT NULL,
    status            TEXT    NOT NULL DEFAULT '待沟通'
                      CHECK (status IN ('待沟通', '待交易', '已完成', '已取消')),
    appointment_time  TEXT,                              -- 约定时间（不得为过去，应用层校验）
    appointment_place TEXT,
    remark            TEXT,
    version           INTEGER NOT NULL DEFAULT 0,        -- 乐观锁（并发流转仅一次生效）
    created_at        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (goods_id)  REFERENCES goods(id)     ON DELETE RESTRICT,
    FOREIGN KEY (want_id)   REFERENCES want_buy(id)  ON DELETE RESTRICT,
    FOREIGN KEY (buyer_id)  REFERENCES user(id)      ON DELETE RESTRICT,
    FOREIGN KEY (seller_id) REFERENCES user(id)      ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_order_buyer ON orders (buyer_id,  status);
CREATE INDEX IF NOT EXISTS idx_order_seller ON orders (seller_id, status);
CREATE INDEX IF NOT EXISTS idx_order_goods ON orders (goods_id);   -- 同商品进行中订单去重查询

-- ---------------------------------------------------------------------
-- 10. report 举报（部分唯一索引：同一举报人对同一目标的"待处理"举报唯一）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id     INTEGER NOT NULL,
    target_type     TEXT    NOT NULL
                    CHECK (target_type IN ('商品', '用户', '留言', '求购')),
    target_id       INTEGER NOT NULL,
    reason          TEXT    NOT NULL,                    -- 非空且 ≤300 字符（应用层校验）
    evidence_images TEXT    DEFAULT '[]',
    status          TEXT    NOT NULL DEFAULT '待处理'
                    CHECK (status IN ('待处理', '已处理', '已驳回')),
    handle_action   TEXT
                    CHECK (handle_action IN ('下架商品', '封禁用户', '删除留言', '驳回举报')
                           OR handle_action IS NULL),
    handle_result   TEXT,                                -- 驳回举报必填（留痕审计）
    handler_id      INTEGER,
    handle_time     TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (reporter_id) REFERENCES user(id) ON DELETE RESTRICT,
    FOREIGN KEY (handler_id)  REFERENCES user(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_report_pending ON report (reporter_id, target_type, target_id)
    WHERE status = '待处理';
CREATE INDEX IF NOT EXISTS idx_report_status ON report (status, created_at);

-- ---------------------------------------------------------------------
-- 11. audit_log 审核日志（只增不改，保留 ≥180 天）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    object_type       TEXT    NOT NULL,                  -- 商品/留言/私聊消息/实名认证/举报/用户
    object_id         INTEGER NOT NULL,
    action            TEXT    NOT NULL,                  -- AI审核/人工审核通过/人工驳回/下架/封禁/删除/复核
    ai_suggestion     TEXT
                      CHECK (ai_suggestion IN ('通过', '疑似违规', '拒绝') OR ai_suggestion IS NULL),
    hit_words         TEXT,                              -- 命中敏感词 JSON 数组
    manual_conclusion TEXT,
    operator_id       INTEGER,                           -- AI 通道为 NULL
    created_at        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (operator_id) REFERENCES user(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_audit_object  ON audit_log (object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at);
