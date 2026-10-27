# 阶段4：求购信息管理后端 — 实施计划

## 一、概述

在现有 NestJS 10 + TypeORM 0.3 + MySQL 8 后端上实现求购模块：

- 求购发布（需实名）、编辑、关闭（无物理/逻辑删除接口，关闭即终态之一）
- 求购列表分页、求购详情（均需登录可见）
- 卖家接单：求购状态 `待接单 → 已接单`，同一事务内自动创建 `chat_session` 并关联 `want_id`
- 权限：仅本人可编辑/关闭；本人不可接自己的求购；未实名禁止发布求购；接单仅需登录（已与用户确认）

已确认决策（用户选择）：

1. **改数据库枚举**：`want_buy.status` 改为 `待接单 / 已接单 / 已关闭`，提供迁移脚本并同步 `init.sql` 与实体（旧数据 `进行中→待接单`、`已成交→已接单`）
2. **列表与详情均需登录**（匿名 401，遵循 docs/api.md 鉴权矩阵 P1）
3. **接单接口仅需登录，不要求实名**

## 二、现状分析

| 项 | 现状 |
| --- | --- |
| `want_buy` 表 | 已在 `server/sql/init.sql` 建表，字段：`user_id, item_name, budget, expected_condition, campus, remark, status ENUM('进行中','已成交','已关闭')`，含 `version`？否（无乐观锁），有 `is_deleted` |
| `chat_session` 表 | 已建表：`goods_id / want_id` 互斥可空，`buyer_id`（求购者）、`seller_id`（接单人）、`last_message_time`；唯一键 `uk_session_want(want_id, buyer_id)` |
| 求购模块 | `server/src/modules/want/want.module.ts` 仅为空占位 |
| 私聊模块 | `server/src/modules/chat/chat.module.ts` 占位，无实体 |
| 全局能力 | 已具备 `@Public()`、`@Roles('admin')`、`@RequireCertified()`、`@OptionalAuth()`、`@CurrentUser()`；`UserModule` 为 `@Global()`，可直接注入 `User` 仓库；全局过滤器已将 MySQL 约束异常翻译为 409/400 |
| 参考实现 | `goods` 模块（`goods.service.ts`）已形成分页 clamp 50、发布者摘要拼装、条件更新防并发等模式，本阶段沿用 |

## 三、改动清单（按文件）

### 1. 数据库

**`server/sql/init.sql`（修改）**

- 将 `want_buy.status` 定义改为：
  `status ENUM('待接单','已接单','已关闭') NOT NULL DEFAULT '待接单' COMMENT '状态：已接单/已关闭不可接单（409）'`
- 其余字段不变。

**`server/sql/migration-003.sql`（新增，幂等）**

三步式迁移，避免 ENUM 直接收缩导致旧值丢失：

1. 若 `information_schema` 中 `want_buy.status` 仍含 `进行中`，先扩展为
   `ENUM('进行中','已成交','已关闭','待接单','已接单')`（默认 `待接单`）
2. `UPDATE want_buy SET status='待接单' WHERE status='进行中';`
   `UPDATE want_buy SET status='已接单' WHERE status='已成交';`
3. 再次读取列类型，若仍含旧值，收缩为最终
   `ENUM('待接单','已接单','已关闭') NOT NULL DEFAULT '待接单'`
4. 全部 DDL 通过 `PREPARE/EXECUTE` + `IF()` 条件执行，重复执行时输出 skip 提示

### 2. 实体

**`server/src/modules/want/entities/want-buy.entity.ts`（新增）**

- `@Entity('want_buy')`，字段与表一一对应：`id, userId, itemName, budget, expectedCondition, campus, remark, status, createTime, updateTime, isDeleted`
- 复用现有 transformer：`bigintToNumber` / `tinyintToBoolean`（来自 `user.entity.ts`）、`decimalToNumber`（来自 `goods.entity.ts`）
- 导出 `WANT_STATUSES = ['待接单','已接单','已关闭'] as const` 与 `WantStatus` 类型
- 复用 `CONDITION_LEVELS` / `CAMPUSES`（从 goods 实体导入），避免重复枚举

**`server/src/modules/chat/entities/chat-session.entity.ts`（新增）**

- `@Entity('chat_session')`：`id, goodsId(可空), wantId(可空), buyerId, sellerId, lastMessageTime(可空), createTime, updateTime, isDeleted`
- 本阶段仅为接单创建会话提供写入能力，chat 接口留待阶段5；`ChatModule` 保持占位，不改其控制器/服务

### 3. DTO

**`server/src/modules/want/dto/want.dto.ts`（新增）**

- `CreateWantDto`
  - `itemName`：`@IsNotEmpty` + `@Length(1,50)`
  - `budget`：`@IsNumber({maxDecimalPlaces:2})` + `@Min(0.01)` + `@Max(999999.99)`
  - `expectedCondition?`：`@IsOptional` + `@IsIn(CONDITION_LEVELS)`
  - `campus?`：`@IsOptional` + `@IsIn(CAMPUSES)`
  - `remark?`：`@IsOptional` + `@IsString` + `@Length(0,500)`
  - 全部字段带 `@ApiProperty/@ApiPropertyOptional`
- `UpdateWantDto extends CreateWantDto`：全量更新（与 goods 编辑一致），服务端仅允许 `待接单` 状态编辑
- `QueryWantDto`
  - `keyword?`：`@IsOptional` + `@IsString` + `@Length(1,50)`
  - `status?`：`@IsOptional` + `@IsIn(WANT_STATUSES)`，**默认 `待接单`**
  - `campus?`：`@IsIn(CAMPUSES)`
  - `page?` 默认 1、`pageSize?` 默认 10（服务层 clamp 到 1~50）
- 不新增关闭/接单 DTO（无请求体）

### 4. 服务

**`server/src/modules/want/want.service.ts`（新增）**

构造注入：`Repository<WantBuy>`、`Repository<ChatSession>`、`Repository<User>`、`DataSource`

| 方法 | 逻辑 |
| --- | --- |
| `create(userId, dto)` | 直接落库，`status='待接单'`；`itemName` trim；返回实体 |
| `update(userId, id, dto)` | `findOwned` 校验存在（404）与归属（403）；仅 `待接单` 可编辑，`已接单/已关闭` → 409「该求购已被接单或已关闭，无法编辑」；全量赋值后保存 |
| `close(userId, id)` | `findOwned`；仅 `待接单 → 已关闭`，其余 → 409；返回 `{id, status:'已关闭'}` |
| `list(query)` | 登录访问；默认 `status='待接单'`（显式传则按传值）；`keyword` trim 后为空则忽略，否则 `title`/`remark` LIKE 参数化；`campus` 过滤；`createTime DESC, id DESC`；分页 clamp 50；`attachPublisher` 拼装发布者摘要（`nickname/avatar/isCertified`） |
| `detail(id)` | 不存在或 `isDeleted=true` → 404；附带发布者摘要；全部状态对登录用户可见（本阶段无审核态） |
| `accept(userId, id)` | 见下方「接单事务」 |

**接单事务（重点）**

```
dataSource.transaction(async (manager) => {
  1. 查 want_buy（isDeleted=false）→ 不存在 404
  2. want.userId === userId → 403「不能接自己的求购」
  3. want.status !== '待接单' → 409「该求购已被接单或已关闭，当前状态：xxx」
  4. 条件更新：
     manager.update(WantBuy,
       { id, isDeleted: false, status: '待接单' },
       { status: '已接单' })
     affected === 0 → 409（并发接单，只有一个成功）
  5. 查已有会话 manager.findOne(ChatSession,
       { where: { wantId: id, buyerId: want.userId, isDeleted: false } })
     存在 → 直接复用（幂等）
     不存在 → 创建 ChatSession：
       { goodsId: null, wantId: id,
         buyerId: want.userId,   // 求购者
         sellerId: userId,       // 接单卖家
         lastMessageTime: null }
  6. 返回 { conversationId: session.id, wantId: id, status: '已接单' }
})
```

- 语义依据 `docs/database-design.md` 3.6：接单方为 `seller_id`，求购者为 `buyer_id`
- 唯一键 `uk_session_want(want_id, buyer_id)` 天然保证同一求购只有一条会话；条件更新保证只有一个卖家能接单
- 本阶段不写 `chat_message` 首条消息（私聊消息能力属阶段5）

### 5. 控制器

**`server/src/modules/want/want.controller.ts`（新增）**

- `@ApiTags('求购')`、`@Controller('wants')`
- 路由（全部需登录，无 `@Public`）：

| 方法 | 路径 | 守卫 | 说明 |
| --- | --- | --- | --- |
| POST | `/wants` | `@RequireCertified()` | 发布求购，未实名 403 |
| GET | `/wants` | 登录 | 列表分页（默认仅待接单） |
| GET | `/wants/:id` | 登录 | 详情（含发布者摘要） |
| PUT | `/wants/:id` | 登录 + 属主校验 | 编辑（仅待接单） |
| PATCH | `/wants/:id/close` | 登录 + 属主校验 | 关闭求购（仅待接单） |
| POST | `/wants/:id/accept` | 登录 | 接单（本人 403，已接单/已关闭 409） |

- 静态路径 `GET /wants` 定义在 `GET /wants/:id` 之前；每个方法补 `@ApiOperation`、`@ApiBearerAuth`（发布/接单需注明）

**`server/src/modules/want/want.module.ts`（重写）**

```ts
@Module({
  imports: [TypeOrmModule.forFeature([WantBuy, ChatSession])],
  controllers: [WantController],
  providers: [WantService],
  exports: [WantService],
})
export class WantModule {}
```

**`server/src/app.module.ts`（小幅调整）**

- `WantModule` 已注册，无需改导入；仅将注释从「业务模块占位」中移出（与 Goods/Category/Files 并列）

### 6. Swagger

- 控制器/DTO 已按上表补全 `@ApiTags/@ApiOperation/@ApiBearerAuth/@ApiProperty`
- `main.ts` Swagger 描述由「阶段3：商品/分类/文件上传」更新为「阶段4：求购/接单」

### 7. 测试用例

**`server/test/phase4.http`（新增，REST Client 格式，参考 phase2/phase3 风格）**

覆盖：

1. 未实名用户发布求购 → 403；已实名发布成功（`status='待接单'`）；预算 0 → 400；物品名称超 50 字 → 400
2. 列表：匿名 → 401；默认仅 `待接单`；`keyword` 命中物品名/备注；`status=已接单` 筛选；分页参数
3. 详情：不存在 → 404；正常返回发布者摘要
4. 编辑：本人成功；他人 → 403；已接单/已关闭 → 409
5. 关闭：本人 `待接单→已关闭`；重复关闭 → 409；他人 → 403
6. 接单：本人 → 403；成功 → `status='已接单'` 且返回 `conversationId`（库中 `chat_session.want_id` 已关联）；重复接单 → 409；关闭后接单 → 409；匿名 → 401
7. 编辑/关闭不存在的求购 → 404

## 四、接口清单

| # | 方法 | 路径 | 权限 | 请求 | 响应 data |
| --- | --- | --- | --- | --- | --- |
| 1 | POST | `/api/v1/wants` | 登录 + 已实名 | `itemName, budget, expectedCondition?, campus?, remark?` | 求购实体（`status='待接单'`） |
| 2 | GET | `/api/v1/wants` | 登录 | `keyword?, status?（默认待接单）, campus?, page?, pageSize?` | `{ list, total, page, pageSize }`，含发布者摘要 |
| 3 | GET | `/api/v1/wants/:id` | 登录 | — | 求购详情 + 发布者摘要 |
| 4 | PUT | `/api/v1/wants/:id` | 本人 | 同发布 | 更新后的求购实体 |
| 5 | PATCH | `/api/v1/wants/:id/close` | 本人 | — | `{ id, status:'已关闭' }` |
| 6 | POST | `/api/v1/wants/:id/accept` | 登录（非求购者） | — | `{ conversationId, wantId, status:'已接单' }` |

状态机：

```
待接单 --卖家接单--> 已接单（终态，自动建会话）
待接单 --本人关闭--> 已关闭（终态）
已接单/已关闭 --编辑/关闭/接单--> 409
```

## 五、假设与决策

1. **状态枚举变更**：按用户确认改库；`init.sql` 与 `migration-003.sql` 同步。`docs/api.md` / `docs/database-design.md` 中旧状态名本次不修改（超出本阶段后端交付范围），在阶段交付说明中标注差异，待文档统一修订时同步。
2. **字段命名**：数据库列 `remark`，API 字段沿用 `remark`（与 `docs/api.md` 5.4 一致），对应需求中的「描述」。
3. **无删除接口**：需求仅要求「关闭」，关闭为终态，不提供 DELETE，不做逻辑删除（保留历史，避免破坏会话关联）。
4. **列表/详情登录可见**：不做 `@Public`，与现有鉴权矩阵一致。
5. **接单不要求实名**：按用户选择，仅 `POST /wants` 使用 `@RequireCertified()`。
6. **接单原子性**：条件更新 + 事务，并发下仅一个卖家成功；会话已存在则复用（幂等）。
7. **不实现首条上下文消息**：`chat_message` 写入属阶段5私聊模块；本阶段只建 `chat_session` 关联 `want_id`。
8. **不改动 chat 模块接口**：仅新增 `ChatSession` 实体文件，`ChatModule` 保持占位。

## 六、验证步骤

1. 执行 `mysql -u root -p campus_xianyu < server/sql/migration-003.sql`（或对开发库直接重建），确认 `want_buy.status` 为三值枚举
2. `cd server && npm run build`，确认无编译错误（PowerShell profile 报错为环境提示，可忽略）
3. `npm run start:dev` 启动，打开 `/api-docs` 确认「求购」分组 6 个接口与 DTO 字段完整
4. 按 `server/test/phase4.http` 顺序执行：
   - 先登录 admin / 已实名学生 / 未实名学生，填入 Token
   - 逐条核对期望状态码与响应
   - 接单成功后查库 `chat_session`，确认 `want_id`、`buyer_id`（求购者）、`seller_id`（接单人）正确
5. 回归：阶段3 商品接口不受影响（`GET /goods`、上传等抽查）

## 七、交付物

- 代码：实体 2 个、DTO 1 个、服务 1 个、控制器 1 个、模块重写 1 个、迁移脚本 1 个、`init.sql` 修改
- 测试：`server/test/phase4.http`
- 汇报：接口清单表格 + 自测结果，等待用户确认后再进入阶段5
