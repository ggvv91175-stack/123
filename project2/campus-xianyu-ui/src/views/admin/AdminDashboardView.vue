<template>
  <div v-loading="loading" class="space-y-6">
    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 gap-4 md:grid-cols-5">
      <el-card v-for="card in statCards" :key="card.label" shadow="hover">
        <div class="text-sm text-gray-400">{{ card.label }}</div>
        <div class="mt-2 text-2xl font-bold" :class="card.color">{{ card.value }}</div>
      </el-card>
    </div>

    <!-- 待办事项 -->
    <el-card>
      <template #header>
        <span class="font-semibold">待办事项</span>
      </template>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div
          v-for="todo in todoCards"
          :key="todo.label"
          class="flex cursor-pointer items-center justify-between rounded border p-4 transition hover:border-brand hover:shadow"
          @click="$router.push(todo.to)"
        >
          <div>
            <div class="text-sm text-gray-500">{{ todo.label }}</div>
            <div class="mt-1 text-xl font-bold" :class="todo.count > 0 ? 'text-orange-500' : 'text-gray-400'">
              {{ todo.count }}
            </div>
          </div>
          <el-icon class="text-gray-300"><ArrowRight /></el-icon>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import { adminApi } from '@/api'
import type { DashboardStats } from '@/api/types'

const loading = ref(false)
const stats = ref<DashboardStats>()

const statCards = computed(() => [
  { label: '用户总数', value: stats.value?.userTotal ?? '-', color: 'text-gray-800' },
  { label: '商品总数', value: stats.value?.goodsTotal ?? '-', color: 'text-gray-800' },
  { label: '在售商品', value: stats.value?.goodsOnSale ?? '-', color: 'text-green-600' },
  { label: '求购总数', value: stats.value?.wantTotal ?? '-', color: 'text-gray-800' },
  { label: '待接单求购', value: stats.value?.wantOpen ?? '-', color: 'text-blue-600' },
])

const todoCards = computed(() => [
  { label: '待审核实名认证', count: stats.value?.pending.certifications ?? 0, to: '/admin/certifications' },
  { label: '待审核商品', count: stats.value?.pending.goods ?? 0, to: '/admin/goods' },
  { label: '待处理举报', count: stats.value?.pending.reports ?? 0, to: '/admin/reports' },
])

async function load() {
  loading.value = true
  try {
    stats.value = await adminApi.dashboard()
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
