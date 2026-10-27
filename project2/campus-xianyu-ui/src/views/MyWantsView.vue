<template>
  <div class="space-y-6 py-6">
    <div class="page-card">
      <div class="page-title">我的求购</div>

      <!-- 状态筛选 -->
      <el-tabs v-model="activeStatus" @tab-change="onTabChange">
        <el-tab-pane label="全部" name="" />
        <el-tab-pane v-for="s in statusTabs" :key="s" :label="s" :name="s" />
      </el-tabs>

      <div v-loading="loading">
        <template v-if="list.length">
          <div class="space-y-3">
            <div
              v-for="item in list"
              :key="item.id"
              class="cursor-pointer rounded-lg border border-gray-100 p-4 transition hover:border-brand hover:shadow-sm"
              @click="router.push(`/wants/${item.id}`)"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="truncate font-medium">{{ item.itemName }}</span>
                <el-tag :type="WANT_STATUS[item.status]?.type" size="small">{{ item.status }}</el-tag>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span class="font-semibold text-red-500">预算 {{ formatPrice(item.budget) }}</span>
                <el-tag v-if="item.expectedCondition" size="small" type="info" effect="plain">
                  {{ item.expectedCondition }}
                </el-tag>
                <el-tag v-if="item.campus" size="small" type="info" effect="plain">{{ item.campus }}</el-tag>
              </div>
              <div class="mt-2 flex items-center justify-between">
                <span class="text-xs text-gray-400">发布于 {{ formatTime(item.createTime) }}</span>
                <div v-if="item.status === '待接单'" class="flex gap-2">
                  <el-button size="small" @click.stop="router.push(`/wants/publish?id=${item.id}`)">编辑</el-button>
                  <el-button
                    size="small"
                    type="danger"
                    plain
                    :loading="closingId === item.id"
                    @click.stop="onClose(item)"
                  >关闭求购</el-button>
                </div>
              </div>
            </div>
          </div>

          <Pagination v-model:page="page" v-model:page-size="pageSize" :total="total" @change="load" />
        </template>

        <EmptyState v-else-if="!loading" description="还没有发布求购">
          <el-button type="primary" size="small" @click="router.push('/wants/publish')">去发布求购</el-button>
        </EmptyState>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { wantApi } from '@/api'
import type { WantItem, WantStatus } from '@/api/types'
import { WANT_STATUS } from '@/utils/constants'
import { formatPrice } from '@/utils'
import { Pagination, EmptyState } from '@/components'

const router = useRouter()

const statusTabs: WantStatus[] = ['待接单', '已接单', '已关闭']
const activeStatus = ref<WantStatus | ''>('')

const list = ref<WantItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
/** 正在关闭的求购ID（按钮 loading/防重复） */
const closingId = ref<number | null>(null)

function formatTime(t: string) {
  return new Date(t).toLocaleString('zh-CN')
}

async function load() {
  loading.value = true
  try {
    const data = await wantApi.myList({
      status: activeStatus.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
    })
    list.value = data.list
    total.value = data.total
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    loading.value = false
  }
}

function onTabChange() {
  page.value = 1
  load()
}

async function onClose(item: WantItem) {
  try {
    await ElMessageBox.confirm(`确认关闭求购「${item.itemName}」？关闭后不可恢复。`, '关闭求购', {
      confirmButtonText: '关闭',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  closingId.value = item.id
  try {
    await wantApi.close(item.id)
    ElMessage.success('求购已关闭')
    await load()
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    closingId.value = null
  }
}

onMounted(load)
</script>
