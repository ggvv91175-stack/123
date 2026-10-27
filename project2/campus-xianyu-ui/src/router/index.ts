import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { installGuards } from './guards'

/**
 * 路由表：
 * - 前台：FrontLayout 承载，首页/商品列表/商品详情公开浏览；求购（后端需登录）/我的需登录；发布/编辑/私聊需登录+实名
 * - 后台：AdminLayout 独立布局，/admin/** 全部 requiresAuth + requiresAdmin
 * - meta 字段含义见 src/types/router.d.ts；守卫逻辑见 guards.ts
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, title: '登录' },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { public: true, title: '注册' },
  },
  {
    path: '/403',
    name: 'forbidden',
    component: () => import('@/views/ForbiddenView.vue'),
    meta: { public: true, title: '无权限' },
  },
  {
    path: '/',
    component: () => import('@/layouts/FrontLayout.vue'),
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/views/HomeView.vue'),
        meta: { title: '首页' },
      },
      {
        path: 'goods',
        name: 'goods-list',
        component: () => import('@/views/GoodsListView.vue'),
        meta: { title: '淘闲置' },
      },
      {
        path: 'goods/:id',
        name: 'goods-detail',
        component: () => import('@/views/GoodsDetailView.vue'),
        meta: { title: '商品详情' },
      },
      {
        path: 'publish',
        name: 'publish',
        component: () => import('@/views/GoodsPublishView.vue'),
        meta: { title: '发布商品', requiresAuth: true, requiresCertified: true },
      },
      {
        path: 'goods/:id/edit',
        name: 'goods-edit',
        component: () => import('@/views/GoodsPublishView.vue'),
        meta: { title: '编辑商品', requiresAuth: true, requiresCertified: true },
      },
      {
        path: 'wants',
        name: 'wants',
        component: () => import('@/views/WantListView.vue'),
        meta: { title: '求购广场', requiresAuth: true },
      },
      {
        path: 'wants/:id(\\d+)',
        name: 'want-detail',
        component: () => import('@/views/WantDetailView.vue'),
        meta: { title: '求购详情', requiresAuth: true },
      },
      {
        path: 'wants/publish',
        name: 'want-publish',
        component: () => import('@/views/WantPublishView.vue'),
        meta: { title: '发布求购', requiresAuth: true, requiresCertified: true },
      },
      {
        path: 'chat/:sessionId?',
        name: 'chat',
        component: () => import('@/views/ChatView.vue'),
        meta: { title: '私聊', requiresAuth: true, requiresCertified: true },
      },
      {
        path: 'orders',
        name: 'orders',
        component: () => import('@/views/OrderListView.vue'),
        meta: { title: '我的订单', requiresAuth: true },
      },
      {
        path: 'orders/:id',
        name: 'order-detail',
        component: () => import('@/views/OrderDetailView.vue'),
        meta: { title: '订单详情', requiresAuth: true },
      },
      {
        path: 'me',
        name: 'me',
        component: () => import('@/views/MeView.vue'),
        meta: { title: '个人中心', requiresAuth: true },
      },
      {
        path: 'me/certification',
        name: 'certification',
        component: () => import('@/views/CertificationView.vue'),
        meta: { title: '实名认证', requiresAuth: true },
      },
      {
        path: 'me/goods',
        name: 'my-goods',
        component: () => import('@/views/MyGoodsView.vue'),
        meta: { title: '我的发布', requiresAuth: true },
      },
      {
        path: 'me/wants',
        name: 'my-wants',
        component: () => import('@/views/MyWantsView.vue'),
        meta: { title: '我的求购', requiresAuth: true },
      },
      {
        path: 'me/comments',
        name: 'my-comments',
        component: () => import('@/views/MyCommentsView.vue'),
        meta: { title: '我的留言', requiresAuth: true },
      },
    ],
  },
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('@/views/AdminLoginView.vue'),
    meta: { public: true, title: '管理员登录' },
  },
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: '', name: 'admin-dashboard', component: () => import('@/views/admin/AdminDashboardView.vue'), meta: { title: '数据看板' } },
      { path: 'users', name: 'admin-users', component: () => import('@/views/admin/AdminUsersView.vue'), meta: { title: '用户管理' } },
      { path: 'goods', name: 'admin-goods', component: () => import('@/views/admin/AdminGoodsView.vue'), meta: { title: '商品审核' } },
      { path: 'reports', name: 'admin-reports', component: () => import('@/views/admin/AdminReportsView.vue'), meta: { title: '举报处理' } },
      { path: 'certifications', name: 'admin-certs', component: () => import('@/views/admin/AdminCertsView.vue'), meta: { title: '认证审核' } },
      { path: 'categories', name: 'admin-categories', component: () => import('@/views/admin/AdminCategoriesView.vue'), meta: { title: '分类管理' } },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { public: true, title: '页面不存在' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

installGuards(router)

export default router
