<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50">
    <EmptyState description="403 · 没有权限访问该页面">
      <el-button type="primary" size="small" @click="$router.push('/')">返回首页</el-button>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import { EmptyState } from '@/components'
</script>
