<template>
  <div class="py-6">
    <div class="page-card">
      <div class="page-title">{{ $route.meta.title }}</div>
      <EmptyState :description="`「${$route.meta.title}」将在后续阶段实现`">
        <el-button size="small" @click="$router.push('/')">返回首页</el-button>
      </EmptyState>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 通用业务占位页：骨架阶段承载所有未实现业务路由（标题取 route.meta.title）
 */
import { EmptyState } from '@/components'
</script>
