import { del, get, patch, post, put } from './http'
import type {
  AdminCategoryQuery,
  AdminReportItem,
  AdminReportQuery,
  AdminUserQuery,
  AdminWantQuery,
  Category,
  CertificationInfo,
  CertReviewItem,
  ChatMessageView,
  ChatSessionView,
  CommentItem,
  CommentReply,
  CreateOrderPayload,
  DashboardStats,
  GoodsItem,
  GoodsPayload,
  GoodsQuery,
  GoodsStatus,
  HandleAction,
  LoginResult,
  MyCommentItem,
  OrderItem,
  OrderQuery,
  OrderStatus,
  PageResult,
  ReportTargetType,
  UserProfile,
  WantItem,
  WantPayload,
  WantQuery,
  WantStatus,
} from './types'

/**
 * API 模块入口：按业务域封装，全部对接真实后端（统一前缀 /api/v1）。
 * 接口路径与后端 server/src/modules/**.controller.ts 对齐。
 */

/** 认证 */
export const authApi = {
  login: (payload: { studentNo: string; password: string }) =>
    post<LoginResult>('/auth/login', payload),
  register: (payload: { studentNo: string; password: string; nickname: string }) =>
    post<{ userId: number }>('/auth/register', payload),
  logout: () => post<void>('/auth/logout'),
}

/** 用户 */
export const userApi = {
  me: () => get<UserProfile>('/users/me'),
  updateMe: (payload: { nickname?: string; avatar?: string; college?: string }) =>
    put<UserProfile>('/users/me', payload),
  changePassword: (payload: { oldPassword: string; newPassword: string }) =>
    put<void>('/users/me/password', payload),
  submitCertification: (payload: { studentNo: string; college: string; proofImages: string[] }) =>
    post<void>('/users/me/certification', payload),
  getCertification: () => get<CertificationInfo | null>('/users/me/certification'),
}

/** 文件上传：POST /files/upload（multipart，字段名 file，jpg/png/webp ≤5MB，需登录），返回 {url} */
export const filesApi = {
  upload: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return post<{ url: string }>('/files/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    })
  },
}

/** 分类（公开） */
export const categoryApi = {
  list: () => get<Category[]>('/categories'),
}

/** 商品 */
export const goodsApi = {
  /** 公开列表（仅在售） */
  list: (params: GoodsQuery) => get<PageResult<GoodsItem>>('/goods', params as Record<string, unknown>),
  detail: (id: number) => get<GoodsItem>(`/goods/${id}`),
  create: (payload: GoodsPayload) => post<{ id: number }>('/goods', payload),
  update: (id: number, payload: GoodsPayload) => put<{ id: number }>(`/goods/${id}`, payload),
  remove: (id: number) => del<{ id: number }>(`/goods/${id}`),
  /** action: on=上架 off=下架 sold=已售出 */
  updateStatus: (id: number, action: 'on' | 'off' | 'sold') =>
    patch<{ id: number; status: GoodsStatus }>(`/goods/${id}/status`, { action }),
  /** 我的发布（全部状态） */
  myList: (params: { status?: GoodsStatus; page?: number; pageSize?: number }) =>
    get<PageResult<GoodsItem>>('/goods/my', params as Record<string, unknown>),
}

/** 求购 */
export const wantApi = {
  list: (params: WantQuery) => get<PageResult<WantItem>>('/wants', params as Record<string, unknown>),
  myList: (params: { status?: WantStatus; page?: number; pageSize?: number }) =>
    get<PageResult<WantItem>>('/wants/my', params as Record<string, unknown>),
  detail: (id: number) => get<WantItem>(`/wants/${id}`),
  create: (payload: WantPayload) => post<{ id: number }>('/wants', payload),
  update: (id: number, payload: WantPayload) => put<{ id: number }>(`/wants/${id}`, payload),
  close: (id: number) => patch<{ id: number }>(`/wants/${id}/close`),
  /** 卖家接单，返回会话ID */
  accept: (id: number) => post<{ conversationId: number }>(`/wants/${id}/accept`),
}

/** 商品留言 */
export const commentApi = {
  list: (goodsId: number, params: { page?: number; pageSize?: number }) =>
    get<PageResult<CommentItem>>(`/goods/${goodsId}/comments`, params),
  create: (goodsId: number, content: string) =>
    post<CommentItem>(`/goods/${goodsId}/comments`, { content }),
  reply: (commentId: number, content: string) =>
    post<CommentReply>(`/comments/${commentId}/replies`, { content }),
  remove: (id: number) => del<{ id: number }>(`/comments/${id}`),
  /** 我的留言（含回复，附商品摘要） */
  myList: (params: { page?: number; pageSize?: number }) =>
    get<PageResult<MyCommentItem>>('/comments/my', params),
}

/** 私聊 */
export const chatApi = {
  /** 发起商品私聊会话（幂等复用），返回会话ID */
  createSession: (goodsId: number) => post<{ conversationId: number }>('/chat/sessions', { goodsId }),
  /** 我的会话列表（按最近消息倒序，附对方/商品/求购摘要/未读数/最后一条消息） */
  mySessions: (params: { page?: number; pageSize?: number }) =>
    get<PageResult<ChatSessionView>>('/chat/sessions', params),
  /** 历史消息（倒序分页；拉取即把对方消息标记已读） */
  history: (sessionId: number, params: { page?: number; pageSize?: number }) =>
    get<PageResult<ChatMessageView>>(`/chat/sessions/${sessionId}/messages`, params),
  /** 发送消息（REST 通道，持久化 + 服务端推送接收人） */
  send: (sessionId: number, content: string) =>
    post<ChatMessageView>(`/chat/sessions/${sessionId}/messages`, { content }),
}

/** 订单 */
export const orderApi = {
  create: (payload: CreateOrderPayload) => post<{ id: number; orderNo: string }>('/orders', payload),
  list: (params: OrderQuery) => get<PageResult<OrderItem>>('/orders', params as Record<string, unknown>),
  detail: (id: number) => get<OrderItem>(`/orders/${id}`),
  /** 状态流转：confirm=待沟通→待交易 complete=待交易→已完成 cancel=取消 */
  updateStatus: (id: number, action: 'confirm' | 'complete' | 'cancel') =>
    patch<{ id: number; status: OrderStatus }>(`/orders/${id}/status`, { action }),
}

/** 举报 */
export const reportApi = {
  create: (payload: {
    targetType: ReportTargetType
    targetId: number
    reason: string
    evidenceImages?: string[]
  }) => post<{ id: number }>('/reports', payload),
}

/**
 * 管理员后台（全部要求 admin 角色，由后端 @Roles('admin') 强制校验）
 * 路径对齐 server/src/modules/admin/**、goods/admin-goods.controller.ts、
 * report/report.controller.ts、category/category.controller.ts
 */
export const adminApi = {
  /** 数据看板统计 */
  dashboard: () => get<DashboardStats>('/admin/dashboard/stats'),

  /** 用户管理 */
  users: (params: AdminUserQuery) =>
    get<PageResult<UserProfile>>('/admin/users', params as Record<string, unknown>),
  /** 禁用/解禁账号（禁用会吊销全部 Token） */
  updateUserStatus: (id: number, action: 'disable' | 'enable') =>
    patch<{ id: number; status: string }>(`/admin/users/${id}/status`, { action }),

  /** 实名认证审核 */
  certifications: (params: { status?: string; page?: number; pageSize?: number }) =>
    get<PageResult<CertReviewItem>>('/admin/certifications', params),
  reviewCertification: (id: number, payload: { result: 'pass' | 'reject'; reason?: string }) =>
    patch<{ status: string }>(`/admin/certifications/${id}/review`, payload),

  /** 商品审核 */
  goods: (params: { status?: GoodsStatus; page?: number; pageSize?: number }) =>
    get<PageResult<GoodsItem>>('/admin/goods', params as Record<string, unknown>),
  reviewGoods: (id: number, payload: { result: 'pass' | 'reject'; reason?: string }) =>
    patch<{ id: number; status: GoodsStatus }>(`/admin/goods/${id}/review`, payload),
  /** 违规下架商品（理由必填） */
  takedownGoods: (id: number, reason: string) =>
    patch<{ id: number; status: GoodsStatus }>(`/admin/goods/${id}/takedown`, { reason }),

  /** 求购管理（违规下架：待接单→已关闭） */
  wants: (params: AdminWantQuery) =>
    get<PageResult<WantItem>>('/admin/wants', params as Record<string, unknown>),
  takedownWant: (id: number) => patch<{ id: number; status: WantStatus }>(`/admin/wants/${id}/takedown`),

  /** 举报处理 */
  reports: (params: AdminReportQuery) =>
    get<PageResult<AdminReportItem>>('/admin/reports', params as Record<string, unknown>),
  handleReport: (id: number, payload: { action: HandleAction; result?: string }) =>
    patch<{ id: number; status: string }>(`/admin/reports/${id}/handle`, payload),

  /** 分类管理 */
  categories: (params: AdminCategoryQuery) =>
    get<PageResult<Category>>('/admin/categories', params as Record<string, unknown>),
  createCategory: (payload: { name: string; sortOrder?: number }) =>
    post<Category>('/categories', payload),
  updateCategory: (id: number, payload: { name?: string; sortOrder?: number; status?: '启用' | '停用' }) =>
    put<Category>(`/categories/${id}`, payload),
  removeCategory: (id: number) => del<{ id: number }>(`/categories/${id}`),
}
