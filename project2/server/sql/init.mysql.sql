-- =====================================================================
-- 校园版咸鱼 — MySQL 8 初始化脚本（Docker 首启自动执行）
-- 挂载点：/docker-entrypoint-initdb.d/init.mysql.sql（仅首次初始化空数据卷时执行）
-- 说明：
--   1. 与 sql/init.sql（SQLite 版）结构对齐：10 张表 + CHECK 约束固化枚举取值
--   2. MySQL 8.0.16+ 支持 CHECK 约束；时间列用 DATETIME（默认 CURRENT_TIMESTAMP）
--   3. 字符集 utf8mb4，存储引擎 InnoDB
--   4. 幂等：CREATE TABLE IF NOT EXISTS / INSERT IGNORE，可重复执行
--   5. 种子账号密码为预计算 bcrypt 哈希（库中零明文）：
--      admin/admin123、20211231245/abc12345（已实名）、20211231246/abc12345（未实名）
--      生产部署请务必登录后修改密码（修改密码会吊销全部旧 Token）
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 1. user 用户表（仅存密码哈希，无明文）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user` (
  id            INT          NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  student_no    VARCHAR(32)  NOT NULL COMMENT '学号（登录账号）',
  password_hash VARCHAR(100) NOT NULL COMMENT 'bcrypt 密码哈希（含盐）',
  nickname      VARCHAR(64)  NOT NULL COMMENT '昵称',
  college       VARCHAR(64)  NULL COMMENT '学院',
  phone         VARCHAR(32)  NULL COMMENT '手机号（仅本人可见）',
  role          VARCHAR(16)  NOT NULL DEFAULT 'student' COMMENT '角色：admin=管理员, student=学生',
  status        VARCHAR(8)   NOT NULL DEFAULT '正常' COMMENT '账号状态：禁用后拒绝登录/发布/收发消息',
  avatar        VARCHAR(255) NULL COMMENT '头像URL',
  is_certified  TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否已实名认证：0否 1是',
  token_version INT          NOT NULL DEFAULT 0 COMMENT 'Token版本号：修改密码/禁用时+1，旧Token全量失效',
  create_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '逻辑删除：0否 1是',
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_student_no (student_no),
  CONSTRAINT chk_user_role   CHECK (role IN ('admin','student')),
  CONSTRAINT chk_user_status CHECK (status IN ('正常','禁用'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. real_auth 实名认证表（已驳回保留留痕，重新提交插入新行）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS real_auth (
  id            INT         NOT NULL AUTO_INCREMENT COMMENT '认证ID',
  user_id       INT         NOT NULL COMMENT '申请人用户ID',
  student_no    VARCHAR(32) NOT NULL COMMENT '认证学号',
  college       VARCHAR(64) NOT NULL COMMENT '学院',
  proof_images  TEXT        NULL COMMENT '证明材料图片URL数组（JSON字符串）',
  status        VARCHAR(8)  NOT NULL DEFAULT '待审核' COMMENT '审核状态',
  reject_reason VARCHAR(255) NULL COMMENT '驳回理由（驳回必填，回显给用户）',
  reviewer_id   INT         NULL COMMENT '审核人（管理员）ID',
  review_time   DATETIME    NULL COMMENT '审核时间',
  create_time   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted    TINYINT(1)  NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_real_auth_user (user_id),
  KEY idx_real_auth_status (status, create_time),
  CONSTRAINT chk_real_auth_status CHECK (status IN ('待审核','已通过','已驳回')),
  CONSTRAINT fk_real_auth_user     FOREIGN KEY (user_id)     REFERENCES `user`(id) ON DELETE RESTRICT,
  CONSTRAINT fk_real_auth_reviewer FOREIGN KEY (reviewer_id) REFERENCES `user`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3. category 分类表
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS category (
  id          INT         NOT NULL AUTO_INCREMENT COMMENT '分类ID',
  name        VARCHAR(32) NOT NULL COMMENT '分类名',
  sort_order  INT         NOT NULL DEFAULT 0 COMMENT '展示排序（小在前）',
  status      VARCHAR(8)  NOT NULL DEFAULT '启用' COMMENT '停用后不再可选，历史商品不受影响',
  create_time DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted  TINYINT(1)  NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_category_name (name),
  CONSTRAINT chk_category_status CHECK (status IN ('启用','停用'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4. goods 商品表
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS goods (
  id              INT          NOT NULL AUTO_INCREMENT COMMENT '商品ID',
  user_id         INT          NOT NULL COMMENT '发布者用户ID',
  title           VARCHAR(64)  NOT NULL COMMENT '标题（≤50字符，应用层校验）',
  price           DOUBLE       NOT NULL COMMENT '价格',
  category_id     INT          NOT NULL COMMENT '分类ID',
  condition_level VARCHAR(16)  NOT NULL COMMENT '新旧程度',
  campus          VARCHAR(8)   NOT NULL COMMENT '校区',
  trade_method    VARCHAR(16)  NOT NULL COMMENT '交易方式',
  description     TEXT         NOT NULL COMMENT '图文描述（文本部分）',
  images          TEXT         NULL COMMENT '图片URL数组（JSON字符串，≤9张）',
  status          VARCHAR(8)   NOT NULL DEFAULT '待审核' COMMENT '商品状态',
  reject_reason   VARCHAR(255) NULL COMMENT '审核驳回/违规下架理由',
  version         INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本号（并发审核/编辑防覆盖）',
  create_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted      TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_goods_category (category_id),
  KEY idx_goods_campus (campus),
  KEY idx_goods_status (status),
  KEY idx_goods_price (price),
  KEY idx_goods_create_time (create_time DESC),
  KEY idx_goods_user (user_id, is_deleted),
  CONSTRAINT chk_goods_price     CHECK (price BETWEEN 0.01 AND 999999.99),
  CONSTRAINT chk_goods_condition CHECK (condition_level IN ('全新','几乎全新','轻微使用','明显使用痕迹')),
  CONSTRAINT chk_goods_campus    CHECK (campus IN ('东区','西区','南区','北区')),
  CONSTRAINT chk_goods_trade     CHECK (trade_method IN ('当面交易','宿舍自提','校内其他')),
  CONSTRAINT chk_goods_status    CHECK (status IN ('待审核','已驳回','在售','已下架','已售出','违规下架')),
  CONSTRAINT fk_goods_user     FOREIGN KEY (user_id)     REFERENCES `user`(id) ON DELETE RESTRICT,
  CONSTRAINT fk_goods_category FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 5. want_buy 求购表
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS want_buy (
  id                 INT          NOT NULL AUTO_INCREMENT COMMENT '求购ID',
  user_id            INT          NOT NULL COMMENT '求购者用户ID',
  item_name          VARCHAR(64)  NOT NULL COMMENT '物品名称（≤50字符，应用层校验）',
  budget             DOUBLE       NOT NULL COMMENT '预算',
  expected_condition VARCHAR(16)  NULL COMMENT '期望成色',
  campus             VARCHAR(8)   NULL COMMENT '校区',
  remark             VARCHAR(600) NULL COMMENT '备注/描述（≤500字符）',
  status             VARCHAR(8)   NOT NULL DEFAULT '待接单' COMMENT '已接单/已关闭不可接单（409）',
  create_time        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted         TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_want_status (status, create_time DESC),
  KEY idx_want_user (user_id),
  CONSTRAINT chk_want_budget    CHECK (budget BETWEEN 0.01 AND 999999.99),
  CONSTRAINT chk_want_condition CHECK (expected_condition IN ('全新','几乎全新','轻微使用','明显使用痕迹')),
  CONSTRAINT chk_want_campus    CHECK (campus IN ('东区','西区','南区','北区')),
  CONSTRAINT chk_want_status    CHECK (status IN ('待接单','已接单','已关闭')),
  CONSTRAINT fk_want_user FOREIGN KEY (user_id) REFERENCES `user`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 6. message_comment 商品留言表（两层结构：顶层留言 + 回复平铺）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_comment (
  id               INT         NOT NULL AUTO_INCREMENT COMMENT '留言ID',
  goods_id         INT         NOT NULL COMMENT '商品ID',
  user_id          INT         NOT NULL COMMENT '留言人ID',
  parent_id        INT         NULL COMMENT '顶层留言ID：回复非空；顶层留言为NULL',
  reply_to_user_id INT         NULL COMMENT '被回复人用户ID：冗余用于"xx 回复 yy"展示',
  content          VARCHAR(600) NOT NULL COMMENT '留言内容（≤500字符，需过敏感词）',
  status           VARCHAR(8)  NOT NULL DEFAULT '正常' COMMENT '删除为标记不物理删',
  create_time      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted       TINYINT(1)  NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_comment_goods (goods_id, create_time),
  KEY idx_comment_parent (parent_id, create_time),
  CONSTRAINT chk_comment_status CHECK (status IN ('正常','已删除')),
  CONSTRAINT fk_comment_goods   FOREIGN KEY (goods_id)         REFERENCES goods(id)           ON DELETE RESTRICT,
  CONSTRAINT fk_comment_user    FOREIGN KEY (user_id)          REFERENCES `user`(id)          ON DELETE RESTRICT,
  CONSTRAINT fk_comment_parent  FOREIGN KEY (parent_id)        REFERENCES message_comment(id) ON DELETE RESTRICT,
  CONSTRAINT fk_comment_replyto FOREIGN KEY (reply_to_user_id) REFERENCES `user`(id)          ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 7. chat_session 会话表（goods_id / want_id 互斥可空）
--    MySQL 唯一索引同样允许多个 NULL，天然实现"按来源去重"
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_session (
  id                INT      NOT NULL AUTO_INCREMENT COMMENT '会话ID',
  goods_id          INT      NULL COMMENT '来源商品ID（可空，与 want_id 互斥）',
  want_id           INT      NULL COMMENT '来源求购ID（可空，与 goods_id 互斥）',
  buyer_id          INT      NOT NULL COMMENT '买家/求购者侧用户ID',
  seller_id         INT      NOT NULL COMMENT '卖家/接单人侧用户ID',
  last_message_time DATETIME NULL COMMENT '最后一条消息时间（会话列表排序用）',
  create_time       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted        TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_session_goods (goods_id, buyer_id),
  UNIQUE KEY uk_session_want (want_id, buyer_id),
  KEY idx_session_buyer (buyer_id, last_message_time),
  KEY idx_session_seller (seller_id, last_message_time),
  CONSTRAINT fk_session_goods  FOREIGN KEY (goods_id)  REFERENCES goods(id)    ON DELETE RESTRICT,
  CONSTRAINT fk_session_want   FOREIGN KEY (want_id)   REFERENCES want_buy(id) ON DELETE RESTRICT,
  CONSTRAINT fk_session_buyer  FOREIGN KEY (buyer_id)  REFERENCES `user`(id)   ON DELETE RESTRICT,
  CONSTRAINT fk_session_seller FOREIGN KEY (seller_id) REFERENCES `user`(id)   ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 8. chat_message 私聊消息表
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_message (
  id          INT          NOT NULL AUTO_INCREMENT COMMENT '消息ID',
  session_id  INT          NOT NULL COMMENT '会话ID',
  sender_id   INT          NOT NULL COMMENT '发送者ID（必须为会话参与者，否则403）',
  content     TEXT         NOT NULL COMMENT '消息内容（文本或图片URL）',
  msg_type    VARCHAR(8)   NOT NULL DEFAULT '文本' COMMENT '消息类型',
  is_read     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '未读数=对方发送且is_read=0',
  create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted  TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_message_session (session_id, create_time),
  CONSTRAINT chk_message_type CHECK (msg_type IN ('文本','图片')),
  CONSTRAINT fk_message_session FOREIGN KEY (session_id) REFERENCES chat_session(id) ON DELETE RESTRICT,
  CONSTRAINT fk_message_sender  FOREIGN KEY (sender_id)  REFERENCES `user`(id)       ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 9. order_info 订单表（order 为保留字，故表名 order_info）
--    状态机：待沟通 → 待交易 → 已完成(终态)；待沟通/待交易 → 已取消(终态)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_info (
  id                INT          NOT NULL AUTO_INCREMENT COMMENT '订单ID',
  order_no          VARCHAR(32)  NOT NULL COMMENT '订单号：XY+yyyyMMddHHmmss+6位随机',
  goods_id          INT          NULL COMMENT '关联商品ID（可空，与 want_id 互斥）',
  want_id           INT          NULL COMMENT '关联求购ID（可空，与 goods_id 互斥）',
  buyer_id          INT          NOT NULL COMMENT '买家ID',
  seller_id         INT          NOT NULL COMMENT '卖家ID',
  status            VARCHAR(8)   NOT NULL DEFAULT '待沟通' COMMENT '非法流转返回409',
  appointment_time  DATETIME     NULL COMMENT '约定时间（不得为过去时间）',
  appointment_place VARCHAR(128) NULL COMMENT '约定地点',
  remark            VARCHAR(600) NULL COMMENT '备注（≤500字符）',
  version           INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本号（并发流转仅一次生效）',
  create_time       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted        TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_order_no (order_no),
  KEY idx_order_buyer (buyer_id, status),
  KEY idx_order_seller (seller_id, status),
  KEY idx_order_goods (goods_id),
  CONSTRAINT chk_order_status CHECK (status IN ('待沟通','待交易','已完成','已取消')),
  CONSTRAINT fk_order_goods  FOREIGN KEY (goods_id)  REFERENCES goods(id)    ON DELETE RESTRICT,
  CONSTRAINT fk_order_want   FOREIGN KEY (want_id)   REFERENCES want_buy(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_buyer  FOREIGN KEY (buyer_id)  REFERENCES `user`(id)   ON DELETE RESTRICT,
  CONSTRAINT fk_order_seller FOREIGN KEY (seller_id) REFERENCES `user`(id)   ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 10. report 举报表（target 多态：商品/用户/留言/求购，不建外键）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report (
  id              INT          NOT NULL AUTO_INCREMENT COMMENT '举报ID',
  reporter_id     INT          NOT NULL COMMENT '举报人ID',
  target_type     VARCHAR(8)   NOT NULL COMMENT '举报目标类型',
  target_id       INT          NOT NULL COMMENT '举报目标ID',
  reason          VARCHAR(320) NOT NULL COMMENT '举报理由（非空且≤300字符）',
  evidence_images TEXT         NULL COMMENT '证据图片URL数组（JSON字符串）',
  status          VARCHAR(8)   NOT NULL DEFAULT '待处理' COMMENT '处理状态',
  handle_action   VARCHAR(16)  NULL COMMENT '处理动作',
  handle_result   VARCHAR(255) NULL COMMENT '处理结果说明（驳回举报必填，留痕审计）',
  handler_id      INT          NULL COMMENT '处理人（管理员）ID',
  handle_time     DATETIME     NULL COMMENT '处理时间',
  create_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted      TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_report_pending (reporter_id, target_type, target_id, status),
  KEY idx_report_status (status, create_time),
  CONSTRAINT chk_report_target CHECK (target_type IN ('商品','用户','留言','求购')),
  CONSTRAINT chk_report_status CHECK (status IN ('待处理','已处理','已驳回')),
  CONSTRAINT chk_report_action CHECK (handle_action IN ('下架商品','封禁用户','删除留言','警告用户','驳回举报')),
  CONSTRAINT fk_report_reporter FOREIGN KEY (reporter_id) REFERENCES `user`(id) ON DELETE RESTRICT,
  CONSTRAINT fk_report_handler  FOREIGN KEY (handler_id)  REFERENCES `user`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 种子数据（密码为预计算 bcrypt 哈希，库中零明文）
-- =====================================================================

-- 管理员：admin / admin123
INSERT IGNORE INTO `user` (id, student_no, password_hash, nickname, role, status, is_certified)
VALUES (1, 'admin', '$2a$10$lesc.oYjhrIShzooIxj.KOhNl.RAurMAORSXbvAi2a7SJdLxnTnom', '平台管理员', 'admin', '正常', 1);

-- 学生·已认证：20211231245 / abc12345
INSERT IGNORE INTO `user` (id, student_no, password_hash, nickname, college, role, status, is_certified)
VALUES (2, '20211231245', '$2a$10$d6W8fFX2L1Bb40hhnGKuN.QyH92LM5ALzp1AJQg7Is2XNTlf8mBvi', '张三（已认证）', '计算机学院', 'student', '正常', 1);

-- 学生·未认证：20211231246 / abc12345
INSERT IGNORE INTO `user` (id, student_no, password_hash, nickname, role, status, is_certified)
VALUES (3, '20211231246', '$2a$10$d6W8fFX2L1Bb40hhnGKuN.QyH92LM5ALzp1AJQg7Is2XNTlf8mBvi', '李四（未认证）', 'student', '正常', 0);

-- 已认证学生补一条"已通过"认证记录
INSERT IGNORE INTO real_auth (id, user_id, student_no, college, proof_images, status, reviewer_id, review_time)
VALUES (1, 2, '20211231245', '计算机学院', '["https://example.com/proof/student-card.jpg"]', '已通过', 1, NOW());

-- 默认分类
INSERT IGNORE INTO category (id, name, sort_order, status) VALUES
  (1, '教材书籍', 1, '启用'),
  (2, '电子产品', 2, '启用'),
  (3, '生活用品', 3, '启用'),
  (4, '运动器材', 4, '启用'),
  (5, '服饰鞋包', 5, '启用');
