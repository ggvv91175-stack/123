/** 后端统一响应包装：{ code, message, data }，code=0 成功 */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

/** 分页结果（后端约定） */
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/** 当前用户信息（对齐后端 buildUserSummary / /users/me） */
export interface UserProfile {
  id: number
  /** 完整学号（仅 /users/me 返回本人完整学号） */
  studentNo?: string
  /** 脱敏学号（登录返回及他人视角，如 2021****245） */
  studentNoMasked?: string
  nickname: string
  avatar: string | null
  role: 'student' | 'admin'
  /** 仅 /users/me 与管理接口返回 */
  status?: '正常' | '禁用'
  isCertified: boolean
  college: string | null
  phone?: string | null
  createTime?: string
}

/** 登录返回 */
export interface LoginResult {
  token: string
  /** 过期时长（秒） */
  expiresIn: number
  user: UserProfile
}

/** 分类 */
export interface Category {
  id: number
  name: string
  sortOrder: number
  status: string
}

/** 用户摘要（发布者/留言人视角） */
export interface UserBrief {
  id?: number
  nickname: string
  avatar: string | null
  isCertified?: boolean
}

export type GoodsStatus = '待审核' | '已驳回' | '在售' | '已下架' | '已售出' | '违规下架'
export type WantStatus = '待接单' | '已接单' | '已关闭'

/** 商品（列表/详情共用，附发布者摘要） */
export interface GoodsItem {
  id: number
  userId: number
  title: string
  price: number
  categoryId: number
  conditionLevel: string
  campus: string
  tradeMethod: string
  description: string
  images: string[] | null
  status: GoodsStatus
  rejectReason: string | null
  createTime: string
  updateTime: string
  publisher: UserBrief | null
}

export interface GoodsQuery {
  keyword?: string
  categoryId?: number
  minPrice?: number
  maxPrice?: number
  campus?: string
  condition?: string
  sort?: 'time' | 'price_asc' | 'price_desc'
  page?: number
  pageSize?: number
}

export interface GoodsPayload {
  title: string
  price: number
  categoryId: number
  conditionLevel: string
  campus: string
  tradeMethod: string
  description: string
  images?: string[]
}

/** 求购（列表/详情共用，附发布者摘要） */
export interface WantItem {
  id: number
  userId: number
  itemName: string
  budget: number
  expectedCondition: string | null
  campus: string | null
  remark: string | null
  status: WantStatus
  createTime: string
  updateTime: string
  publisher?: UserBrief | null
}

export interface WantQuery {
  keyword?: string
  status?: WantStatus
  campus?: string
  expectedCondition?: string
  minBudget?: number
  maxBudget?: number
  sort?: 'time' | 'budget_asc' | 'budget_desc'
  page?: number
  pageSize?: number
}

export interface WantPayload {
  itemName: string
  budget: number
  expectedCondition?: string
  campus?: string
  remark?: string
}

/** 商品留言（顶层 + 平铺回复） */
export interface CommentReply {
  id: number
  content: string
  createTime: string
  user: UserBrief | null
  replyToUser: UserBrief | null
}

export interface CommentItem {
  id: number
  content: string
  createTime: string
  user: UserBrief | null
  replies: CommentReply[]
}

/** 我的留言（附商品摘要） */
export interface MyCommentItem {
  id: number
  goodsId: number
  content: string
  isReply: boolean
  replyToUser: UserBrief | null
  createTime: string
  goods: { id: number; title: string; status: string; image: string | null } | null
}

/** 实名认证状态查询结果（未提交返回 null） */
export interface CertificationInfo {
  id: number
  studentNo: string
  college: string
  proofImages: string[] | null
  status: '待审核' | '已通过' | '已驳回'
  rejectReason: string | null
  reviewTime: string | null
  createTime: string
}

/** 举报目标类型 */
export type ReportTargetType = '商品' | '求购' | '用户' | '留言'

/** 聊天消息视图（WS/REST 共用结构） */
export interface ChatMessageView {
  id: number
  sessionId: number
  senderId: number
  receiverId: number
  msgType: string
  content: string
  isRead: boolean
  createTime: string
}

/** 会话视图（我的会话列表项） */
export interface ChatSessionView {
  id: number
  /** 对方用户摘要 */
  peer: UserBrief | null
  /** 关联商品摘要（商品会话） */
  goods: { id: number; title: string; price: number; status: string } | null
  /** 关联求购摘要（求购接单会话） */
  want: { id: number; itemName: string; budget: number; status: string } | null
  unreadCount: number
  lastMessage: { senderId: number; content: string; msgType: string; createTime: string } | null
  lastMessageTime: string | null
  createTime: string
}

export type OrderStatus = '待沟通' | '待交易' | '已完成' | '已取消'

/** 订单（列表/详情共用，附商品与双方摘要） */
export interface OrderItem {
  id: number
  orderNo: string
  goodsId: number | null
  wantId: number | null
  buyerId: number
  sellerId: number
  status: OrderStatus
  appointmentTime: string | null
  appointmentPlace: string | null
  remark: string | null
  createTime: string
  updateTime: string
  goods: { id: number; title: string; price: number; cover: string | null; status: string } | null
  buyer: UserBrief | null
  seller: UserBrief | null
  /** 对方用户摘要（视角冗余字段） */
  peer: UserBrief | null
}

export interface OrderQuery {
  role?: 'buy' | 'sell'
  status?: OrderStatus
  page?: number
  pageSize?: number
}

export interface CreateOrderPayload {
  goodsId: number
  appointmentPlace: string
  appointmentTime?: string
  remark?: string
}

// ---------------- 管理员后台 ----------------

/** 数据看板统计 */
export interface DashboardStats {
  userTotal: number
  goodsTotal: number
  goodsOnSale: number
  wantTotal: number
  wantOpen: number
  pending: {
    certifications: number
    goods: number
    reports: number
  }
}

/** 用户管理查询 */
export interface AdminUserQuery {
  keyword?: string
  status?: '正常' | '禁用'
  role?: 'admin' | 'student'
  isCertified?: boolean
  page?: number
  pageSize?: number
}

/** 认证审核列表项（附申请人摘要） */
export interface CertReviewItem {
  id: number
  userId: number
  studentNo: string
  college: string
  proofImages: string[] | null
  status: '待审核' | '已通过' | '已驳回'
  rejectReason: string | null
  reviewTime: string | null
  createTime: string
  applicant: { nickname: string; avatar: string | null } | null
}

/** 举报状态 / 处理动作 */
export type ReportStatus = '待处理' | '已处理' | '已驳回'
export type HandleAction = '下架商品' | '封禁用户' | '删除留言' | '警告用户' | '驳回举报'

/** 举报列表项（附举报人摘要） */
export interface AdminReportItem {
  id: number
  reporterId: number
  targetType: ReportTargetType
  targetId: number
  reason: string
  evidenceImages: string[] | null
  status: ReportStatus
  handleAction: HandleAction | null
  handleResult: string | null
  handleTime: string | null
  createTime: string
  reporter: { nickname: string; avatar: string | null } | null
}

export interface AdminReportQuery {
  status?: ReportStatus
  targetType?: ReportTargetType
  page?: number
  pageSize?: number
}

/** 管理员求购查询 */
export interface AdminWantQuery {
  keyword?: string
  status?: WantStatus
  page?: number
  pageSize?: number
}

/** 分类管理查询 */
export interface AdminCategoryQuery {
  status?: '启用' | '停用'
  page?: number
  pageSize?: number
}
