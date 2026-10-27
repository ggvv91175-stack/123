<template>
  <el-empty :description="description" :image-size="imageSize">
    <slot />
  </el-empty>
</template>

<script setup lang="ts">
/**
 * 空状态组件（封装 el-empty）
 * 用法：<EmptyState description="暂无商品"><el-button>去发布</el-button></EmptyState>
 */
withDefaults(
  defineProps<{
    description?: string
    imageSize?: number
  }>(),
  { description: '暂无数据', imageSize: 160 },
)
</script>
