import 'vue-router'

/** 路由元信息：守卫依据（src/router/guards.ts） */
declare module 'vue-router' {
  interface RouteMeta {
    /** 页面标题（拼接 document.title） */
    title?: string
    /** 公开页面：免登录 */
    public?: boolean
    /** 需登录 */
    requiresAuth?: boolean
    /** 仅 admin 角色 */
    requiresAdmin?: boolean
    /** 需已完成实名认证（发布页/私聊页） */
    requiresCertified?: boolean
  }
}
