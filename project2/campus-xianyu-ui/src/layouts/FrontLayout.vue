<template>
  <el-container class="min-h-screen">
    <el-header class="sticky top-0 z-10 flex items-center gap-6 border-b bg-white !h-14">
      <router-link to="/" class="shrink-0 text-lg font-bold text-brand">校园版咸鱼</router-link>

      <el-menu
        mode="horizontal"
        router
        :default-active="$route.path"
        :ellipsis="false"
        class="hidden flex-1 !border-b-0 sm:flex"
      >
        <el-menu-item index="/">首页</el-menu-item>
        <el-menu-item index="/goods">淘闲置</el-menu-item>
        <el-menu-item index="/wants">求购广场</el-menu-item>
      </el-menu>

      <!-- 移动端导航菜单 -->
      <el-dropdown class="sm:hidden" trigger="click" @command="onNav">
        <el-icon class="cursor-pointer text-xl text-gray-600"><Menu /></el-icon>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="/">首页</el-dropdown-item>
            <el-dropdown-item command="/goods">淘闲置</el-dropdown-item>
            <el-dropdown-item command="/wants">求购广场</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-button type="primary" size="small" class="ml-auto sm:ml-0" @click="$router.push('/publish')">发布闲置</el-button>

      <template v-if="user.isLoggedIn">
        <el-tooltip content="私聊消息">
          <el-icon class="cursor-pointer text-xl text-gray-500 hover:text-brand" @click="$router.push('/chat')">
            <ChatDotRound />
          </el-icon>
        </el-tooltip>

        <el-dropdown trigger="click" @command="onCommand">
          <span class="flex cursor-pointer items-center gap-2">
            <el-avatar :size="30" :src="user.profile?.avatar || undefined">
              {{ user.profile?.nickname?.slice(0, 1) }}
            </el-avatar>
            <span class="text-sm">{{ user.profile?.nickname }}</span>
            <el-tag v-if="user.isCertified" type="success" size="small">已实名</el-tag>
            <el-tag v-else type="warning" size="small">未实名</el-tag>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="me">个人中心</el-dropdown-item>
              <el-dropdown-item command="my-goods">我的发布</el-dropdown-item>
              <el-dropdown-item command="my-wants">我的求购</el-dropdown-item>
              <el-dropdown-item command="my-comments">我的留言</el-dropdown-item>
              <el-dropdown-item command="orders">我的订单</el-dropdown-item>
              <el-dropdown-item v-if="user.isAdmin" command="admin">管理后台</el-dropdown-item>
              <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
      <el-button v-else plain type="primary" @click="$router.push('/login')">登录 / 注册</el-button>
    </el-header>

    <el-main class="bg-gray-50">
      <div class="mx-auto max-w-6xl">
        <router-view />
      </div>
    </el-main>

    <el-footer class="!h-auto py-4 text-center text-sm text-gray-400">
      校园版咸鱼 · 校园二手交易平台
    </el-footer>
  </el-container>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { Menu } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const user = useUserStore()
const router = useRouter()

function onNav(path: string) {
  router.push(path)
}

async function onCommand(command: string) {
  if (command === 'me') {
    router.push('/me')
  } else if (command === 'my-goods') {
    router.push('/me/goods')
  } else if (command === 'my-wants') {
    router.push('/me/wants')
  } else if (command === 'my-comments') {
    router.push('/me/comments')
  } else if (command === 'orders') {
    router.push('/orders')
  } else if (command === 'admin') {
    router.push('/admin')
  } else if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确定退出登录吗？', '提示', { type: 'warning' })
    } catch {
      return // 取消
    }
    user.logout()
    router.push('/login')
  }
}
</script>
