# 校园版咸鱼 · Vue 3 可演示界面原型 实施计划（v2）

## Summary

基于 `spec.md` 构建纯前端可演示原型：**Vue 3 + Vite + Element Plus + Vue Router + Pinia**，内存 mock 数据驱动全部交互，无后端。布局为用户指定的后台式结构：**顶部栏（系统名称 + 面包屑 + 用户下拉）+ 左侧菜单（按角色显隐）+ 中央内容区**。覆盖全部 17 个页面（学生端 + 管理端），可完整走通"登录 → 浏览/发布 → 留言/私聊 → 接单/订单 → 管理审核"演示闭环。

## Current State Analysis

- 工作区根目录：`校园版咸鱼-需求文档.md` + `.trae/`（spec/tasks/checklist/documents）。
- 上轮已创建项目 `campus-xianyu-ui/` 的 8 个基础文件（本轮**保留并复用**）：
  - `package.json`（vue@3.4、element-plus@2.8、pinia@2.2、vue-router@4.4、vite@5.4，已锁定）
  - `vite.config.js`（`@` 别名、端口 5173）、`index.html`（标题：校园版咸鱼）
  - `src/main.js`（Element Plus 全量引入 + zh-cn + 图标注册）、`src/App.vue`、`src/styles/global.css`
  - `src/mock/data.js`（5 用户/5 分类/9 商品/3 求购/1 会话 2 消息/3 留言/3 订单/2 举报/1 认证/3 AI 日志 + 敏感词库）
  - `src/utils/index.js`（学号脱敏 maskStudentNo、敏感词检测 checkSensitive）
- **尚未创建**：路由、MainLayout、6 个 Pinia store、15 个页面组件；**尚未安装依赖**（无 node_modules）。
- 用户已确认决策：组件库 = **Element Plus**；页面范围 = **全部页面**。

## Proposed Changes

### 1. 状态层：Pinia stores（`src/stores/`，6 个文件）

| 文件 | 职责（对应 spec 接口） |
| --- | --- |
| `user.js` | 登录/注册/退出（禁用账号拒绝，spec 3.3/5.1）、修改资料/密码、实名认证提交与状态（409/驳回重提，5.2） |
| `goods.js` | 商品 CRUD + 上下架/售出（改动重置待审核、仅本人可改删否则 403 提示）、组合筛选搜索分页（3.4）、留言增删（3.7）、AI 敏感词拦截（2.7） |
| `wants.js` | 求购 CRUD/关闭、接单（本人拦截、已关闭 409）→ 自动建会话（3.6） |
| `messages.js` | 会话发起/复用、会话列表（最新+未读）、消息收发（仅参与者 403、向禁用用户发送失败）、演示用自动回复（3.7） |
| `orders.js` | 创建订单（非法商品状态 409、同商品进行中去重）、状态机 待沟通→待交易→已完成 + 取消（乐观锁语义、非法流转 409，3.8/5.7），完成联动商品售出 |
| `admin.js` | 商品审核、认证审核、举报处理（联动下架/封禁/删留言）、用户禁用启用（联动下架其商品）、分类 CRUD（被引用 409）、AI 审核日志与人工复核（3.10/3.11） |

### 2. 路由与守卫（`src/router/index.js`）

- 17 条路由：`/login` 独立；MainLayout 子路由 15 条 + `/` 重定向 `/market`。
- `meta.title` 驱动面包屑；`meta.roles:['admin']` 管理端 6 页。
- 守卫：未登录访问受限页 → `/login`；学生访问 `/admin/*` → 403 提示回首页（AC-10）；`/market`、`/goods/:id` 公开可看，操作需登录。

### 3. 布局外壳（`src/layout/MainLayout.vue`，用户核心要求）

- `el-container` 三段式：
  - **Header 顶栏**：左「校园版咸鱼」系统名称（🐟 + 标题）；中 `el-breadcrumb`（route.matched + meta.title 动态生成，支持多级如"平台管理/商品审核"）；右用户昵称+头像 `el-dropdown`（个人中心/退出登录）。
  - **Aside 左侧菜单**：`el-menu` router 模式——通用组：商品市场、求购广场、消息中心、我的订单、我的发布、个人中心；管理组（仅 admin）：平台管理子菜单（商品审核/认证审核/举报处理/用户管理/分类管理/AI 审核记录）。
  - **Main**：`<router-view/>`。

### 4. 页面组件（15 个，`src/views/`）

**登录**：`Login.vue` — 登录/注册双 Tab +「一键填充学生/管理员演示账号」按钮。

**学生端 8 页**：
1. `Market.vue` 首页：筛选器（分类/价格区间/校区/新旧程度）+ 关键词 + 商品卡片网格（渐变占位图+分类 emoji）+ 分页 + 发布按钮（spec 2.4）
2. `GoodsDetail.vue`：占位大图、全字段、发布者卡片（认证标识+学号脱敏）、留言列表/发表/删除、聊一聊（建会话跳聊天页）、举报弹窗、我想要（创建订单）、本人可见状态操作（2.2/2.5）
3. `GoodsCreate.vue`：全字段表单 + 图片上传（≤9 张）+ 编辑模式（query.id 预填，重置待审核）（2.2）
4. `MyGoods.vue`：我的发布表格（状态 Tag）+ 上架/下架/标记售出/编辑/删除（2.2）
5. `Wants.vue` 求购广场：卡片列表 + 接单按钮 + 关闭自己的求购；`WantCreate.vue` 发布求购表单（2.3）
6. `MessageCenter.vue` 会话列表（未读角标）+ `Chat.vue` 聊天页（气泡、发送、对方 1.2s 自动回复演示）（2.5）
7. `Orders.vue`：我买到的/我卖出的 Tab + 状态筛选 + 流转按钮（非法流转报错演示）（2.5）
8. `Profile.vue`：资料卡（学号脱敏）、修改密码弹窗、实名认证提交/状态/驳回理由回显（2.1）

**管理端 6 页**：`AuditGoods.vue`（通过/驳回+理由）、`AuditCerts.vue`（材料预览+审核）、`Reports.vue`（处理动作联动：下架商品/封禁用户/删留言/驳回）、`Users.vue`（搜索+禁用/启用联动下架）、`Categories.vue`（增删改停用，被引用 409）、`AiAudit.vue`（日志列表+人工复核+文本敏感词测试通道）（2.6/2.7）

### 5. 安装与验证

- `npm install`（campus-xianyu-ui 目录）→ `npm run dev`（后台，端口 5173）。
- 浏览器走查演示闭环 + 权限拦截 + 非法流转拦截，截图确认布局（顶栏+面包屑+左侧菜单）。

## Assumptions & Decisions

- JavaScript（非 TS）、Element Plus 全量引入、内存 mock 刷新重置（均在上轮确认/为原型合理默认）。
- 桌面后台布局优先（用户明确要求顶部+左侧菜单）；spec 的 H5 移动端适配不在本原型范围。
- 复用上轮 8 个已存在文件，不重复创建；store 方法内注释标注对应 spec 接口便于后续接真实 API。
- 假定 Node.js ≥ 18；若缺失则报告用户。

## Verification

1. `npm run dev` 启动无报错，`http://localhost:5173` 可访问。
2. 演示闭环走查：一键填充登录 → 首页筛选搜索 → 详情留言 → 发布商品 → 我的发布 → 管理员审核通过 → 首页可见 → 求购接单 → 私聊 → 订单流转（含非法流转拦截）。
3. 布局检查：顶栏含系统名称+面包屑、左侧菜单按角色显隐；学生访问 `/admin/*` 被 403 拦截。
