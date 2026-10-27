-- =====================================================================
-- 校园版咸鱼 — 种子数据脚本（Task 2 / SubTask 2.2）
-- 幂等：INSERT OR IGNORE，可重复执行；详见 docs/database-design.md 5.2
-- 说明：
--   1. 管理员 password_hash 为占位符 'INIT_ON_FIRST_BOOT'，
--      由后端 DataInitializer 启动时用 BCrypt 生成 admin123 的哈希回写
--      （BCrypt 含随机盐，无法离线预生成；满足 AC-13 无明文密码）。
--   2. 校区/新旧程度/交易方式枚举不建字典表，由 goods/want_buy 的
--      CHECK 约束与后端常量类固化（见 database-design.md 3.4/3.5）。
--   3. 演示用户/商品等业务数据不放入本脚本，避免污染生产初始化。
-- =====================================================================

-- 1. 管理员账号（首次启动后 DataInitializer 回写真实 BCrypt 哈希）
INSERT OR IGNORE INTO user (id, student_no, password_hash, nickname, role, status, is_certified)
VALUES (1, 'admin', 'INIT_ON_FIRST_BOOT', '平台管理员', 'admin', '正常', 1);

-- 2. 默认分类（sort_order 1~5，启用）
INSERT OR IGNORE INTO category (id, name, sort_order, status) VALUES (1, '教材书籍', 1, '启用');
INSERT OR IGNORE INTO category (id, name, sort_order, status) VALUES (2, '电子产品', 2, '启用');
INSERT OR IGNORE INTO category (id, name, sort_order, status) VALUES (3, '生活用品', 3, '启用');
INSERT OR IGNORE INTO category (id, name, sort_order, status) VALUES (4, '运动器材', 4, '启用');
INSERT OR IGNORE INTO category (id, name, sort_order, status) VALUES (5, '服饰鞋包', 5, '启用');
