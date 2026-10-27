# 校园版咸鱼 — API 接口设计（Task 3）

> 对应 tasks.md Task 3（SubTask 3.1 / 3.2 / 3.3），依赖 `docs/architecture.md`（Task 1）、`docs/database-design.md`（Task 2）。
> 覆盖 spec 3.3~3.11 全部 52 个接口；本契约作为前后端并行开发基线，评审通过后冻结。

| 文档版本 | 日期 | 状态 |
| --- | --- | --- |
| v1.0 | 2026-10-18 | 待评审冻结 |

---

## 1. 通用约定

| 项 | 约定 |
| --- | --- |
| Base URL | `/api/v1` |
| 认证 | `Authorization: Bearer <JWT>`；第 3 节"公开"接口除外；JWT 有效期 2h（spec 6.2） |
| 统一响应 | `{ "code": 0, "message": "success", "data": { ... } }`；`code=0` 成功，非 0 与 HTTP 状态码一致（见第 2 节） |
| 分页请求 | `page`（默认 1）、`pageSize`（默认 10，**最大 50**，超出按 50 截断） |
| 分页响应 | `data: { "list": [...], "total": 0, "page": 1, "pageSize": 10 }` |
| 时间格式 | `yyyy-MM-dd HH:mm:ss`（东八区）；请求约定时间不得早于当前时间 |
| Content-Type | `application/json`（上传接口 `multipart/form-data`） |
| 参数校验 | 后端 `@Validated` 逐字段校验，400 返回首个字段错误提示（spec 5.3"返回具体字段错误"） |
| 健康检查 | `GET /api/v1/health`（公开，Task 4 联调用）：`{code:0, data:{status:"UP"}}` |

### 1.1 通用数据结构

```jsonc
// 用户摘要（列表/详情内嵌，学号脱敏 + 手机号永不外泄）
{ "id": 2, "nickname": "小张", "avatar": "/uploads/.../a.png",
  "college": "计算机学院", "isCertified": true,
  "studentNoMasked": "2021****245" }          // 仅 /users/me 返回完整学号

// 商品对象（列表项省略 description/images）
{ "id": 101, "title": "高数教材（第七版）", "price": 25.00,
  "categoryId": 1, "categoryName": "教材书籍", "conditionLevel": "几乎全新",
  "campus": "东区", "tradeMethod": "当面交易",
  "status": "在售", "coverImage": "/uploads/.../1.jpg",
  "seller": { ...用户摘要 }, "commentCount": 3, "createdAt": "2026-10-18 10:00:00" }
```

---

## 2. 错误码表

| HTTP / code | message 示例 | 触发场景（spec 边界映射） |
| --- | --- | --- |
| 0 | success | 成功 |
| 400 | "参数错误：价格必须大于 0" | 字段缺失/格式非法/标题超长/min>max 价格区间（5.4）/预算≤0（5.5）/约定时间为过去（5.7）/请求体非法 JSON 或过大（5.9）/不能接自己的求购* |
| 401 | "请先登录" / "登录已过期" | 未携带 Token、Token 过期/伪造/已加入黑名单、**账号被禁用后持有效 Token 访问**（5.1，实时校验用户状态） |
| 403 | "无权操作该商品" / "无权限访问管理功能" | 水平越权：改删他人商品/求购、非会话参与者收发消息、非订单参与方、求购者本人接单（5.5）；垂直越权：学生访问 `/admin/**`（5.8/AC-10） |
| 404 | "商品不存在" / "会话不存在" | 资源不存在或已逻辑删除 |
| 409 | "该学号已注册" | 学号重复注册（5.1）/重复提交认证（5.2）/快速重复提交商品（5.3，防重幂等）/对已售出·下架·待审核商品下单（5.7）/同商品已有进行中订单（5.7）/取消已完成订单（5.7）/非法状态流转（5.7，含乐观锁失败）/已关闭·已成交求购被接单（5.5）/对已下架商品留言或私聊（5.6）/分类仍被引用删除（5.8）/重复待处理举报（5.8） |
| 429 | "操作过于频繁，请稍后再试" | 第 5 节限流接口超频（5.9） |
| 500 | "服务繁忙，请稍后再试" | 未捕获异常（不裸露堆栈，spec 6.3） |

> \* "求购者本人接单"语义属权限拦截，归 403（与 spec 3.6 权限列"非求购者本人"一致）；其余本人性冲突归 409/400。

### 2.1 边界条件 → 接口行为对照（spec 第 5 节全覆盖）

| spec 边界 | 接口与行为 |
| --- | --- |
| 5.1 学号已注册/密码规则/禁用登录/Token 失效 | POST /auth/register→409；POST /auth/register 校验密码规则→400；禁用账号 POST /auth/login→403（提示"账号已被禁用，请联系管理员"）；任意携带失效 Token→401 |
| 5.2 认证重复/材料超限/驳回重提 | POST /users/me/certification：已待审核/已通过→409；图片超限→400；已驳回→允许重新提交（新记录） |
| 5.3 商品必填/图片超限/重复提交/驳回重提/删除带订单 | POST/PUT /goods：逐字段 400；图片>9 张或中断→400 且不入库；防重（同用户 60s 内同标题同价）→409；修改已驳回商品→重置"待审核"；DELETE /goods/{id} 有进行中订单→逻辑删除，订单继续 |
| 5.4 搜索空关键词/注入字符/min>max/页码越界 | GET /goods：空串纯空格忽略 keyword；参数化查询原样转义；min>max→400；page 越界→空 list + 正确 total |
| 5.5 本人接单/预算非法/已关闭接单 | POST /wants/{id}/accept：本人→403；预算≤0 发布时→400；已关闭/已成交→409 |
| 5.6 空超长敏感词留言/已下架留言私聊/非参与者/向禁用用户发消息/自留言 | POST /goods/{id}/comments：空/超长/敏感词拒绝→400（提示违规）；商品非"在售"→409（历史留言隐藏：列表仅返回正常状态商品的留言）；非参与者读写消息→403；接收方禁用→发送失败 400（提示）；自己给自己商品留言→允许，响应带 `isOwner:true` 标注 |
| 5.7 订单非法下单/重复订单/取消已完成/并发/过去时间 | POST /orders：商品状态非在售→409；进行中订单存在→409；PATCH /orders/{id}/cancel 已完成→409；并发流转乐观锁失败→409；appointmentTime 为过去→400 |
| 5.8 重复举报/理由空超长/分类被引用/禁用联动/驳回留痕 | POST /reports：同目标待处理→409（提示已受理）；理由非法→400；DELETE /categories/{id} 被引用→409；PATCH /admin/users/{id}/status 禁用→联动下架其待审核/在售商品（响应返回 affectedGoods 数）；管理员驳回举报/审核必填说明→400，落 audit_log |
| 5.9 网络失败/弱网上传幂等/限流/非法 JSON | 前端统一错误页（前端职责）；POST /files/upload 携带 fileHash 重复上传返回同一 URL；限流→429；非法 JSON→400 |

---

## 3. 鉴权矩阵

| 权限层级 | 判定规则 | 接口 |
| --- | --- | --- |
| P0 公开 | 无需 Token | POST /auth/register、POST /auth/login、GET /health、GET /goods、GET /goods/{id}、GET /goods/{id}/comments、GET /categories |
| P1 登录 | 有效 JWT + 用户状态=正常 | /users/me/**、GET /users/{id}/profile、商品写接口（属主校验后）、/wants/**、留言发表、/conversations/**、/orders/**、POST /reports、POST /files/upload |
| P2 发布者本人 | P1 + 资源属主 | PUT/DELETE /goods/{id}、PATCH /goods/{id}/status、PUT/DELETE /wants/{id} |
| P3 本人或管理员 | P1 + 属主或 admin | DELETE /comments/{id} |
| P4 会话参与者 | P1 + buyer_id/seller_id 之一 | GET/POST /conversations/{id}/messages |
| P5 订单参与方 | P1 + buyer_id/seller_id 之一 | GET /orders/{id}、PATCH /orders/{id}/status、PATCH /orders/{id}/cancel |
| P6 管理员 | P1 + role=admin | /admin/**、POST/PUT/DELETE /categories、PATCH /admin/ai-audit/* |

> 公开读接口的差异化：未登录访问 GET /goods/{id} 可见基础信息，但发布者联系方式/完整学号等仅登录后返回（spec 3.4"登录可见完整信息"）。

---

## 4. 限流策略

实现：Guava RateLimiter 令牌桶（architecture.md D1），键=用户 ID（登录/发布等）或 IP（注册），超限立即返回 429。

| 接口组 | 限额 | 维度 | 依据 |
| --- | --- | --- | --- |
| POST /auth/login | 10 次/分钟 | IP+学号 | spec 5.9 |
| POST /auth/register | 5 次/分钟 | IP | 防刷（补充） |
| POST /goods、PUT /goods/{id} | 10 次/分钟 | 用户 | spec 5.9"发布" |
| POST /goods/{id}/comments | 10 次/分钟 | 用户 | spec 5.9"留言" |
| POST /conversations/{id}/messages | 10 次/分钟 | 用户 | spec 5.9"发消息" |
| POST /files/upload | 20 次/分钟 | 用户 | 发布需传 ≤9 张，放宽（补充） |
| POST /reports、POST /wants | 10 次/分钟 | 用户 | 同类写操作（补充） |

---

## 5. 接口明细（spec 3.3~3.11 全量）

### 5.1 认证与用户模块（9 个）

| # | 方法 | 路径 | 权限 | 请求参数/体 | 响应 data | 边界 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | POST | /auth/register | 公开 | body: studentNo、password、nickname、phone(选) | `{userId}` | 学号重复 409；密码规则 400 |
| 2 | POST | /auth/login | 公开 | body: studentNo、password | `{token, expiresIn, user:{...用户摘要}}` | 禁用账号 403；密码错误 400；限流 429 |
| 3 | POST | /auth/logout | 登录 | — | `{}` | Token 入黑名单，再次使用 401 |
| 4 | GET | /users/me | 登录 | — | 完整个人信息（含完整学号/手机号、认证状态） | — |
| 5 | PUT | /users/me | 登录 | body: nickname?、avatar?、college? | `{}` | 敏感字段（学号/角色/状态）不可改 |
| 6 | PUT | /users/me/password | 登录 | body: oldPassword、newPassword | `{}` | 原密码错 400；新密码规则 400；成功后旧 Token 全部失效 |
| 7 | POST | /users/me/certification | 登录 | body: studentNo、college、proofImages[] | `{certificationId}` | 已待审核/已通过 409；驳回后可重提 |
| 8 | GET | /users/me/certification | 登录 | — | 最新一条认证 `{status, rejectReason, reviewTime}` | 无记录 data=null |
| 9 | GET | /users/{id}/profile | 登录 | — | 他人主页（学号打码、认证标识、在售商品摘要） | 手机号不返回 |

**注册/登录示例**

```jsonc
// POST /api/v1/auth/login  请求
{ "studentNo": "20211231245", "password": "Xy#2026abc" }
// 响应 200
{ "code": 0, "message": "success",
  "data": { "token": "eyJhbGciOiJIUzI1NiJ9...", "expiresIn": 7200,
            "user": { "id": 2, "nickname": "小张", "avatar": null,
                      "college": "计算机学院", "isCertified": true,
                      "studentNoMasked": "2021****245" } } }
// 响应 403（禁用账号，spec 5.1）
{ "code": 403, "message": "账号已被禁用，请联系管理员", "data": null }
```

### 5.2 商品模块（7 个）

| # | 方法 | 路径 | 权限 | 请求参数/体 | 响应 data | 边界 |
| --- | --- | --- | --- | --- | --- | --- |
| 10 | GET | /goods | 公开 | query: keyword?、categoryId?、minPrice?、maxPrice?、campus?、condition?、sort(time_desc\|price_asc\|price_desc，默认 time_desc)、page、pageSize | 分页（列表项为商品摘要） | min>max 400；越界空列表；空关键词忽略 |
| 11 | GET | /goods/{id} | 公开 | — | 商品详情（含 seller 摘要、images[]、commentCount；登录含发布者联系方式） | 不存在/已删 404；非在售状态登录用户可见状态标识 |
| 12 | POST | /goods | 登录 | body: title、price、categoryId、conditionLevel、campus、tradeMethod、description、images[]≤9 | `{goodsId, status:"待审核"}` | 必填/范围逐项 400；敏感词拒绝 400；重复提交 409；限流 429 |
| 13 | PUT | /goods/{id} | 发布者 | 同 12（部分字段可空=不改） | `{}` | 非本人 403；改动后状态重置"待审核"；已售出商品禁改 409 |
| 14 | DELETE | /goods/{id} | 发布者 | — | `{}` | 非本人 403；逻辑删除，既有订单保留 |
| 15 | PATCH | /goods/{id}/status | 发布者 | body: action(onShelf\|offShelf\|markSold) | `{status}` | 非本人 403；非法动作/状态迁移 409 |
| 16 | GET | /users/me/goods | 登录 | query: status?、page、pageSize | 分页（本人全部状态商品） | — |

**发布商品示例**

```jsonc
// POST /api/v1/goods  请求
{ "title": "考研数学全书（几乎全新）", "price": 35.00, "categoryId": 1,
  "conditionLevel": "几乎全新", "campus": "东区", "tradeMethod": "宿舍自提",
  "description": "去年买的，只翻过前两章…",
  "images": ["/uploads/202610/uuid1.jpg", "/uploads/202610/uuid2.jpg"] }
// 响应 200
{ "code": 0, "message": "success", "data": { "goodsId": 110, "status": "待审核" } }
```

### 5.3 分类模块（4 个）

| # | 方法 | 路径 | 权限 | 请求参数/体 | 响应 data | 边界 |
| --- | --- | --- | --- | --- | --- | --- |
| 17 | GET | /categories | 公开 | query: all?(true 仅管理员，含停用) | `[{id,name,sortOrder,status}]` | 默认仅启用 |
| 18 | POST | /categories | 管理员 | body: name、sortOrder? | `{categoryId}` | 重名 409 |
| 19 | PUT | /categories/{id} | 管理员 | body: name?、sortOrder?、status? | `{}` | 重名 409 |
| 20 | DELETE | /categories/{id} | 管理员 | — | `{}` | 被在售/待审核商品引用 409（提示迁移或停用） |

### 5.4 求购模块（6 个）

| # | 方法 | 路径 | 权限 | 请求参数/体 | 响应 data | 边界 |
| --- | --- | --- | --- | --- | --- | --- |
| 21 | GET | /wants | 登录 | query: keyword?、status?(默认进行中)、page、pageSize（时间倒序） | 分页 | — |
| 22 | GET | /wants/{id} | 登录 | — | 求购详情（含发布者摘要） | 404 |
| 23 | POST | /wants | 登录 | body: itemName、budget、expectedCondition?、campus?、remark? | `{wantId}` | 预算≤0 400；限流 429 |
| 24 | PUT | /wants/{id} | 发布者 | 同 23 | `{}` | 非本人 403 |
| 25 | DELETE | /wants/{id} | 发布者 | query: closeOnly?(true=仅关闭) | `{}` | 非本人 403；默认关闭（status→已关闭） |
| 26 | POST | /wants/{id}/accept | 登录（非求购者） | — | `{conversationId}` | 本人 403；已关闭/已成交 409；**自动创建会话（携带求购上下文首条消息）并通知求购者**；复用已存在会话 |

### 5.5 互动模块（7 个）

| # | 方法 | 路径 | 权限 | 请求参数/体 | 响应 data | 边界 |
| --- | --- | --- | --- | --- | --- | --- |
| 27 | GET | /goods/{id}/comments | 公开 | query: page、pageSize（**时间正序**） | 分页（含用户摘要；isOwner 标注） | 商品已下架→历史留言隐藏（data=null+goodsStatus） |
| 28 | POST | /goods/{id}/comments | 登录 | body: content（≤500） | `{commentId}` | 空/超长/敏感词 400；商品非在售 409；限流 429 |
| 29 | DELETE | /comments/{id} | 本人或管理员 | — | `{}` | 非本人且非管理员 403；状态→已删除 |
| 30 | GET | /conversations | 登录 | query: page、pageSize | 分页（对方摘要、lastMessage、unreadCount，按最新消息倒序） | — |
| 31 | GET | /conversations/{id}/messages | 参与者 | query: page、pageSize（时间正序，游标分页可选） | 分页 | 非参与者 403 |
| 32 | POST | /conversations/{id}/messages | 参与者 | body: content、msgType?(默认文本) | `{messageId}` | 非参与者 403；接收方禁用 400；敏感词拒绝 400；限流 429；更新会话 last_message_at |
| 33 | POST | /conversations | 登录 | body: goodsId?、wantId?（二选一） | `{conversationId, reused:true/false}` | 商品非在售 409；存在即复用（spec 3.7） |

> 新消息获取：前端对 GET /conversations 与 31 轮询（间隔 ≤3s，AC-08），或后续升级 WebSocket（本版契约不含）。

### 5.6 订单模块（5 个）

| # | 方法 | 路径 | 权限 | 请求参数/体 | 响应 data | 边界 |
| --- | --- | --- | --- | --- | --- | --- |
| 34 | POST | /orders | 登录 | body: goodsId?或 wantId?、appointmentTime?、appointmentPlace?、remark? | `{orderId, orderNo, status:"待沟通"}` | 商品非在售 409；进行中订单重复 409；过去时间 400；goodsId/wantId 缺一 400 |
| 35 | GET | /orders | 登录 | query: role(buyer\|seller，默认 buyer)、status?、page、pageSize | 分页（含商品摘要/对方摘要） | "我买到的/我卖出的" |
| 36 | GET | /orders/{id} | 订单参与方 | — | 订单详情（状态、约定信息、version 不外露） | 非参与方 403；404 |
| 37 | PATCH | /orders/{id}/status | 订单参与方 | body: action(confirmTrade\|confirmComplete) | `{status}` | 非法流转 409（含乐观锁并发失败）；非参与方 403；**确认完成联动商品→已售出** |
| 38 | PATCH | /orders/{id}/cancel | 订单参与方 | body: reason? | `{status:"已取消"}` | 已完成/已取消 409；非参与方 403 |

**状态流转示例**

```jsonc
// PATCH /api/v1/orders/602/status  请求
{ "action": "confirmTrade" }            // 待沟通 → 待交易
// 响应 200
{ "code": 0, "message": "success", "data": { "status": "待交易" } }
// 并发/非法流转 409
{ "code": 409, "message": "订单状态已变更或流转非法，请刷新后重试", "data": null }
```

### 5.7 举报与文件模块（2 个）

| # | 方法 | 路径 | 权限 | 请求参数/体 | 响应 data | 边界 |
| --- | --- | --- | --- | --- | --- | --- |
| 39 | POST | /reports | 登录 | body: targetType(商品\|用户\|留言\|求购)、targetId、reason、evidenceImages[] | `{reportId}` | 目标不存在 404；重复待处理 409；理由空/超长 400 |
| 40 | POST | /files/upload | 登录 | multipart: file、fileHash?(MD5，幂等键) | `{url, fileHash}` | jpg/png/webp、单张 ≤5MB 否则 400；**同 hash 重复上传返回同一 URL（幂等）**；UUID 重命名存储 |

### 5.8 管理员模块（9 个）

| # | 方法 | 路径 | 权限 | 请求参数/体 | 响应 data | 边界 |
| --- | --- | --- | --- | --- | --- | --- |
| 41 | GET | /admin/goods | 管理员 | query: status?(默认待审核)、page、pageSize | 分页（含全量图文） | 学生调用 403（下同） |
| 42 | PATCH | /admin/goods/{id}/audit | 管理员 | body: result(pass\|reject)、reason?(reject 必填) | `{status}` | reject 缺理由 400；通过→在售；驳回→已驳回（卖家可改后重提，闭环）；落 audit_log |
| 43 | GET | /admin/certifications | 管理员 | query: status?(默认待审核)、page、pageSize | 分页（含证明图片、申请人摘要） | — |
| 44 | PATCH | /admin/certifications/{id}/review | 管理员 | body: result(pass\|reject)、reason?(reject 必填) | `{status}` | 通过→user.is_certified=1；驳回留理由回显；落 audit_log |
| 45 | GET | /admin/reports | 管理员 | query: status?(默认待处理)、page、pageSize | 分页（含目标摘要与快照） | — |
| 46 | PATCH | /admin/reports/{id}/handle | 管理员 | body: action(takeDownGoods\|banUser\|deleteComment\|dismiss)、result 说明 | `{status:"已处理"/"已驳回"}` | 各动作联动：下架商品→违规下架；封禁→user.status=禁用并联动下架商品；删除留言→comment.status；dismiss 必填说明；全部落 audit_log 留痕 |
| 47 | GET | /admin/users | 管理员 | query: keyword?(昵称/学号)、status?、page、pageSize | 分页 | — |
| 48 | PATCH | /admin/users/{id}/status | 管理员 | body: action(ban\|enable)、reason? | `{affectedGoods}` | 禁用→联动下架其待审核/在售商品（返回数量）；禁用其进行中订单留待对方取消（记录处理结果）；不能禁用自己/admin 409 |
| 49 | GET | /admin/stats | 管理员 | — | `{userCount, goodsOnSale, orderCount, pendingGoods, pendingReports, pendingCerts}` | — |

### 5.9 AI 智能审核扩展接口（3 个，可选）

| # | 方法 | 路径 | 权限 | 请求参数/体 | 响应 data | 边界 |
| --- | --- | --- | --- | --- | --- | --- |
| 50 | POST | /admin/ai-audit/text | 管理员/内部调用 | body: text、channel?(local\|external) | `{suggestion(通过\|疑似违规\|拒绝), hitWords[]}` | 关闭开关时 409（提示功能未启用）；外部通道超时降级为通过+记日志 |
| 51 | POST | /admin/ai-audit/image | 管理员/内部调用 | body: imageUrl | 同上（预留） | 同上 |
| 52 | GET | /admin/ai-audit/logs | 管理员 | query: suggestion?、page、pageSize | 分页 audit_log（含人工复核结论） | — |

> 发布/留言/发消息时由服务端内部调用审核通道（非前端直调）；`拒绝`直接拦截（400 提示"内容包含违规信息，请修改后重试"），`疑似违规`放行进人工复核队列（spec 2.7）。

---

## 6. 接口覆盖核对（SubTask 3.3 验证）

- [ ] spec 3.3~3.11 全部 52 个接口已定义（5.1~5.9 编号 1~52）；
- [ ] 统一响应 `{code,message,data}`、分页 page/pageSize≤50、东八区时间（第 1 节）；
- [ ] 错误码覆盖 400/401/403/404/409/429/500 并映射 spec 第 5 节全部边界（2.1 对照表）；
- [ ] 鉴权矩阵含公开/登录/发布者/参与者/订单参与方/管理员六层（第 3 节），学生访问 `/admin/**` 一律 403；
- [ ] 限流策略：登录/发布/留言/发消息 10 次/分钟 → 429（第 4 节）；
- [ ] 参数化查询、输入转义、属主校验点已在架构层定义（AC-14/AC-15 接口层前置）；
- [ ] 幂等：重复上传同 URL（40）、防重复提交（12）、会话复用（26/33）。

---

## 变更记录

| 日期 | 变更 | 依据 |
| --- | --- | --- |
| 2026-10-18 | v1.0 初稿：52 个接口契约 + 错误码/鉴权矩阵/限流 + 边界条件对照 | spec 3.3~3.11、第 4/5/6 节；architecture.md D1/D7 |
