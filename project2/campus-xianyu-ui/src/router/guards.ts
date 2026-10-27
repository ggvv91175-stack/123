import { ElMessage } from 'element-plus'
import type { Router } from 'vue-router'
import { useUserStore } from '@/stores/user'

/**
 * 全局前置守卫（meta 语义见 src/types/router.d.ts）：
 * 1. requiresAuth 未登录 → /login?redirect=原地址
 * 2. requiresAdmin 非管理员 → /403
 * 3. requiresCertified 未实名 → /me/certification?redirect=原地址（发布页/私聊页）
 */
export function installGuards(router: Router): void {
  router.beforeEach((to) => {
    const user = useUserStore()
    document.title = to.meta.title ? `${to.meta.title} · 校园版咸鱼` : '校园版咸鱼'

    // 已登录访问登录页 → 回首页（管理员登录页 → 回后台）
    if (to.name === 'login' && user.isLoggedIn) return { path: '/' }
    if (to.name === 'admin-login' && user.isLoggedIn && user.isAdmin) return { path: '/admin' }
    if (to.meta.public) return true

    // 管理后台未登录 → 管理员登录页（与前台登录分流）
    if (to.matched.some((r) => r.meta.requiresAdmin) && !user.isLoggedIn) {
      ElMessage.warning('请先登录管理员账号')
      return { path: '/admin/login', query: { redirect: to.fullPath } }
    }

    if (to.matched.some((r) => r.meta.requiresAuth) && !user.isLoggedIn) {
      ElMessage.warning('请先登录')
      return { path: '/login', query: { redirect: to.fullPath } }
    }

    if (to.matched.some((r) => r.meta.requiresAdmin) && !user.isAdmin) {
      ElMessage.error('仅管理员可访问')
      return { path: '/403' }
    }

    if (to.matched.some((r) => r.meta.requiresCertified) && !user.isCertified) {
      ElMessage.warning('该功能需要先完成实名认证')
      return { path: '/me/certification', query: { redirect: to.fullPath } }
    }

    return true
  })
}
