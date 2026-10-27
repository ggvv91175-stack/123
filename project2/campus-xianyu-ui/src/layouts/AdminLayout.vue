<template>
  <el-container class="min-h-screen">
    <el-aside width="220px" class="bg-slate-800">
      <div class="py-4 text-center font-bold text-white">校园咸鱼 · 管理后台</div>
      <el-menu
        router
        :default-active="$route.path"
        background-color="#1e293b"
        text-color="#cbd5e1"
        active-text-color="#ffffff"
        class="!border-r-0"
      >
        <el-menu-item index="/admin">
          <el-icon><DataAnalysis /></el-icon><span>数据看板</span>
        </el-menu-item>
        <el-menu-item index="/admin/users">
          <el-icon><User /></el-icon><span>用户管理</span>
        </el-menu-item>
        <el-menu-item index="/admin/goods">
          <el-icon><Goods /></el-icon><span>商品审核</span>
        </el-menu-item>
        <el-menu-item index="/admin/reports">
          <el-icon><Warning /></el-icon><span>举报处理</span>
        </el-menu-item>
        <el-menu-item index="/admin/certifications">
          <el-icon><DocumentChecked /></el-icon><span>认证审核</span>
        </el-menu-item>
        <el-menu-item index="/admin/categories">
          <el-icon><Collection /></el-icon><span>分类管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="flex items-center justify-between border-b bg-white !h-14">
        <span class="font-semibold">{{ $route.meta.title }}</span>
        <div class="flex items-center gap-3">
          <span class="text-sm text-gray-500">{{ user.profile?.nickname }}</span>
          <el-button size="small" @click="$router.push('/')">返回前台</el-button>
          <el-button size="small" type="danger" plain @click="onLogout">退出登录</el-button>
        </div>
      </el-header>
      <el-main class="bg-gray-50">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'

const user = useUserStore()
const router = useRouter()

async function onLogout() {
  try {
    await ElMessageBox.confirm('确定退出登录吗？', '提示', { type: 'warning' })
  } catch {
    return
  }
  user.logout()
  router.push('/admin/login')
}
</script>
