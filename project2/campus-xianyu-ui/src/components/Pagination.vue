<template>
  <div v-if="total > 0" class="flex justify-end py-4">
    <el-pagination
      background
      layout="total, sizes, prev, pager, next, jumper"
      :total="total"
      :current-page="page"
      :page-size="pageSize"
      :page-sizes="pageSizes"
      @current-change="onPage"
      @size-change="onSize"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 分页组件（封装 el-pagination，与后端分页约定对齐）
 * 用法：<Pagination v-model:page="page" v-model:page-size="pageSize" :total="total" @change="load" />
 */
const props = withDefaults(
  defineProps<{
    total: number
    page: number
    pageSize: number
    pageSizes?: number[]
  }>(),
  { pageSizes: () => [10, 20, 50] },
)

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [pageSize: number]
  /** 页码或每页条数变化（切换条数时页码自动归 1） */
  change: [page: number, pageSize: number]
}>()

function onPage(page: number) {
  emit('update:page', page)
  emit('change', page, props.pageSize)
}

function onSize(pageSize: number) {
  emit('update:pageSize', pageSize)
  emit('update:page', 1)
  emit('change', 1, pageSize)
}
</script>
