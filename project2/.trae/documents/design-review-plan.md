# 计划：设计文档评审报告（校园版咸鱼）

> 模式：Plan Mode | 日期：2026-10-18 | 语言：中文

## Summary

以资深技术架构师 + 产品经理双视角，对 4 份文档（spec.md、docs/architecture.md、docs/database-design.md、docs/api.md）执行交叉评审，从 **需求完整性 / 边界条件 / 技术可行性 / 安全风险 / 用户体验** 5 个维度提出关键问题，产出一份评审结果文档 `docs/design-review.md`。**只输出报告，不直接修改 4 份被评审文档**（修订建议写入报告，待确认后另行执行）。

## 评审对象（Phase 1 已全部读取）

| 文档 | 版本/状态 | 评审关注点 |
| --- | --- | --- |
| [spec.md](c:/Users/yzh/Desktop/Trae_projects/project2/.trae/specs/specify-campus-secondhand-platform/spec.md) | 503 行，含 AC-01~16、边界 5.1~5.9 | 需求基线一致性 |
| [architecture.md](c:/Users/yzh/Desktop/Trae_projects/project2/docs/architecture.md) | v1.0 待评审 | 决策 D1~D9 可行性 |
| [database-design.md](c:/Users/yzh/Desktop/Trae_projects/project2/docs/database-design.md) | v1.0 待评审 | 11 张表/索引/枚举 |
| [api.md](c:/Users/yzh/Desktop/Trae_projects/project2/docs/api.md) | v1.0 待评审，52 接口 | 契约完整性/边界映射 |
| 交叉参照：`校园版咸鱼-需求文档.md`、`checklist.md`、`tasks.md` | — | 勾稽核对 |

## 产出物

**唯一新文件**：`docs/design-review.md`（约 450 行）。不改动任何既有文件。

### 报告结构

```
# 校园版咸鱼 — 设计文档评审报告
1. 评审概览（对象/方法/总体结论：有条件通过——P0 必改，P1 建议冻结前修订）
2. 问题统计矩阵（5 维度 × P0/P1/P2 计数表）
3. 详细发现（5 小节，每条含：ID/级别/涉及文档章节/问题描述/影响/建议处置）
4. 设计确认项（评审通过的设计亮点，保持报告平衡视角）
5. 冻结前修订清单（P0+P1 → 指向具体文档章节的修订动作）
6. v2 建议池（P2/非阻塞项）
```

## 预研发现清单（报告核心素材，执行时展开成文）

> 编号规则：F1~F40；级别 P0=阻塞冻结 / P1=冻结前应修订 / P2=记录或 v2。

### 维度 1：需求完整性（遗漏功能点）

| ID | 级别 | 位置 | 问题 | 建议 |
| --- | --- | --- | --- | --- |
| F1 | P1 | spec 故事8/2.3/2.5 vs api.md 全文 | **通知机制缺失**：spec 要求"留言通知""接单通知求购者"，但无通知表、无通知接口，仅有会话轮询 | v1 口径=复用会话（系统消息）或明确砍掉；notification 表列入 v2 |
| F2 | P1 | database-design.md 3.5 vs api.md 5.4 | **求购"已成交"无触发路径**：接单不置状态、订单完成不联动 want_id | 订单 confirmComplete 联动 want→已成交，或新增求购者"标记成交" |
| F3 | P1 | api.md #15 #37 | **商品"已售出"双路径冲突**：手动 markSold 与订单完成联动并存，与进行中订单的一致性矩阵未定义 | 定义互斥规则写入 api.md 边界（有进行中订单时禁手动 markSold 等） |
| F4 | P2 | spec 2.6/故事20 vs database-design.md 3.10、api.md #46 | **举报处理缺"警告用户"动作**：spec 与枚举/接口不一致 | 枚举补"警告用户"（落 audit_log）或回改 spec |
| F5 | P1 | database-design.md 3.8 vs api.md 5.5 | **会话已读无接口**：message.is_read 支撑未读数，但无标记已读 API，未读数永不清零 | 新增 PATCH /conversations/{id}/read（或读消息时自动置已读） |
| F6 | P2 | seed.sql | 管理员账号不可新增（仅 seed 1 个），无管理管理员接口 | v1 记录为已知限制；改密走 /users/me/password |
| F7 | P2 | api.md #17 | GET /categories?all=true 公开接口内嵌管理员参数，鉴权易漏 | 拆分 GET /admin/categories |
| F8 | P2 | spec 5.1 vs api.md | 校验细则未量化（密码复杂度具体规则、手机号格式等） | 集中定义：密码≥8 位含字母+数字、手机号 11 位等 |
| F9 | P2 | api.md 1.1 | 封面图规则未明示（images[0]=coverImage） | 1.1 补一句约定 |

### 维度 2：边界条件（未处理异常）

| ID | 级别 | 位置 | 问题 | 建议 |
| --- | --- | --- | --- | --- |
| F10 | P1 | schema.sql CHECK/UNIQUE vs api.md 错误码 | **约束异常映射为 500**：SQLite 违反 CHECK/FK/UNIQUE 抛 SQLiteException，未分类处理用户全看到 500 | GlobalExceptionHandler 按错误消息转 400/409 |
| F11 | P1 | architecture.md D2 | SQLITE_BUSY/buyy_timeout 超时未定义行为（单写者高并发写） | 短事务+一次重试；超时返回友好提示；写入部署监控 |
| F12 | P1 | database-design.md 3.4/3.9 | **goods 无乐观锁**：两管理员同时审核、审核与卖家编辑并发互相覆盖（orders 有 version，goods 没有） | goods 状态条件 UPDATE（WHERE status='待审核'）+updated_at 校验，失败 409 |
| F13 | P1 | api.md #46 | 举报目标已删除时处理动作 404 未定义 | 定义"目标不存在→标记已处理+说明'目标已删除'" |
| F14 | P2 | database-design.md 3.9 | 订单号 4 位随机碰撞未定义重试 | 6 位随机或捕获 UNIQUE 冲突重试 3 次 |
| F15 | P2 | api.md #24 | PUT /wants 可空字段语义未定义（null=不改 vs 清空） | 约定 null=不改、空串=清空 |
| F16 | P2 | database-design.md 3.11 | audit_log 180 天清理无落地（无定时任务设计） | 部署章节补 cron 清理任务 |
| F17 | P2 | architecture.md D6 | 上传磁盘满/IO 失败半成品文件清理 | 先落盘校验、失败删除；运维水位监控 |
| F18 | P2 | api.md 第 1 节 | 深分页 OFFSET 性能（1 万级可接受） | 记录已知限制 |
| F19 | P2 | api.md #30 | 会话列表未读数聚合查询性能 | 依赖 I-09 索引 + 会话数规模有限，记录即可 |

### 维度 3：技术可行性（实现难点）

| ID | 级别 | 位置 | 问题 | 建议 |
| --- | --- | --- | --- | --- |
| F20 | P1 | api.md #6 vs database-design.md 3.1 | **"修改密码后旧 Token 全部失效"无法实现**：JWT 无状态且 user 表无版本字段 | user 加 token_version（JWT 载荷携带+校验比对），或放宽口径为"≤2h 自然过期"——评审二选一 |
| F21 | P1 | architecture.md D6 vs 11 张表 | **上传幂等 fileHash 无持久化**：11 张表无文件记录表，hash→URL 映射无处可查 | 推荐：文件名=MD5（同内容同路径天然幂等，零表成本）；备选：新增 file_record 表（第 12 张，需评审确认偏离 spec 3.2） |
| F22 | P2 | architecture.md D3 | MP @Version 需配合状态条件 UPDATE 才完整；部分唯一索引冲突需捕获转 409 | 实现规范写入 Task 4 验收 |
| F23 | P2 | api.md 轮询约定 | 500 在线×3s 轮询≈167 QPS 读 | WAL 可扛；响应带无变化短返回；间隔可配置 |
| F24 | P2 | architecture.md 1.2 | 拦截器放行清单未列（swagger/health/uploads/error） | config 补白名单 |
| F25 | P2 | architecture.md D9 | 会话创建+首条消息+通知需同事务；订单完成联动商品同事务；文件 IO 移出事务 | Service 事务边界规范 |
| F26 | P2 | schema.sql localtime | datetime('now','localtime') 依赖系统时区 | systemd/compose 强制 TZ=Asia/Shanghai（compose 已有，补 systemd） |

### 维度 4：安全风险

| ID | 级别 | 位置 | 问题 | 建议 |
| --- | --- | --- | --- | --- |
| F27 | **P0** | api.md #11 vs 边界 5.6 | **非在售商品 ID 直连泄露**：GET /goods/{id} 公开，未登录枚举 id 可见待审核/已驳回/违规下架图文，绕过审核流程 | 非"在售/已售出"状态仅发布者与管理员可见（他人 404）；公开列表恒只查在售 |
| F28 | P1 | architecture.md 3.1 | JWT 密钥配置文件明文 | 环境变量注入+≥256bit+轮换预案+不进仓库 |
| F29 | P1 | api.md #40 | 上传仅扩展名/Content-Type 校验可伪造 | 魔数（magic bytes）校验 + Nginx `X-Content-Type-Options: nosniff` |
| F30 | P1 | api.md 第 4 节 | 限流键取 IP 可被 X-Forwarded-For 伪造 | 仅信任 Nginx 注入的 X-Real-IP |
| F31 | P2 | api.md #2 | 登录无连续失败锁定 | 同账号连续 10 次失败锁 15 分钟（限流外补充） |
| F32 | P2 | spec 5.1 | 注册 409 可枚举学号存在性 | spec 明确要求该提示，记录权衡即可 |
| F33 | P2 | architecture.md 4.1 | /uploads 公开无防盗链 | Nginx referer 白名单（可选项） |
| F34 | P2 | spec 6.2 | XSS 纵深：description/留言纯文本+前端转义+CSP；若引入富文本需 DOMPurify | 前端规范 |

### 维度 5：用户体验

| ID | 级别 | 位置 | 问题 | 建议 |
| --- | --- | --- | --- | --- |
| F35 | P1 | api.md 第 1 节 | **JWT 2h 无刷新**：浏览中被登出 | 滑动续期（剩余<30min 时响应头返回新 Token）或 refresh token；与 F20 合并决策 |
| F36 | P2 | api.md 轮询 | 3s 轮询聊天延迟感知 | 聊天页 2s+进入即拉；v2 WebSocket |
| F37 | P2 | spec 6.1 vs D6 | 缩略图无实现方案（本地存储无图片处理） | 上传时 Thumbnailator 生成缩略图 或 前端样式压缩 |
| F38 | P2 | api.md #12 | 发布表单误关丢失 | 前端 localStorage 草稿 |
| F39 | P2 | Task 4 前端 | 空态/骨架屏/懒加载/上传进度/筛选记忆 | 并入 Task 4 前端验收清单 |
| F40 | P2 | 架构 6.3 | 管理后台建议桌面优先（非 H5 场景） | 原型已用 Element Plus 桌面布局，保持 |

### 设计确认项（评审通过，写入报告第 4 章平衡视角）

orders 表名避保留字、乐观锁+状态条件双保险、report 部分唯一索引去重、CHECK 中文枚举、三层鉴权模型、seed 无明文密码（DataInitializer 方案）、CHECK 兜底校验、会话部分唯一索引防重、文件 UUID 重命名。

### 统计预估

P0×1（F27）；P1×13（F1/F2/F3/F5/F10/F11/F12/F13/F20/F21/F28/F29/F30/F35 中按最终归类约 13 条）；P2×约 20。

## Assumptions & Decisions

1. **只出报告不改文档**：用户原话"提出关键问题并生成评审结果文档"→ 修订建议写入报告第 5 章，实际修订待用户确认后作为后续任务。
2. **产出位置**：`docs/design-review.md`（沿用 docs/ 英文文件名惯例）。
3. **级别定义**：P0=安全漏洞/核心闭环破坏，冻结前必须改；P1=文档间不一致或可实现性缺口，冻结前应改；P2=记录已知限制或 v2 池。
4. **结论口径**：有条件通过（conditionally approved）。

## 执行步骤

1. Write `docs/design-review.md`：按上述结构成文，将 F1~F40 展开为完整条目（问题+影响+建议），补充第 2 章统计矩阵、第 4 章确认项、第 5 章修订清单（P0/P1 → 精确到目标文档章节的修订动作）、第 6 章 v2 池。
2. 自查勾稽：统计矩阵数字与正文条目一致；每条"位置"引用回查原文档真实存在；5 维度全覆盖；P0/P1 均有可执行建议。

## Verification

- [ ] 报告统计矩阵与详细发现条目数量/编号一致
- [ ] 每条发现引用的文档章节经回读确认存在（抽查 F5/F12/F20/F21/F27 等关键条目）
- [ ] 5 个评审维度全部覆盖，且 spec 5.1~5.9 与三份设计文档的交叉核对过程在报告中可见
- [ ] 所有 P0/P1 附带"改哪个文档、改哪一节"的可执行修订建议
- [ ] 未修改 4 份被评审文档（git/文件时间戳无变化，仅新增 docs/design-review.md）
