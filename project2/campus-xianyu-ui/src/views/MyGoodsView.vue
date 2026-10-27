<template>
  <div class="space-y-6 py-6">
    <div class="page-card">
      <div class="page-title">我的发布</div>

      <!-- 状态筛选 -->
      <el-tabs v-model="activeStatus" @tab-change="onTabChange">
        <el-tab-pane label="全部" name="" />
        <el-tab-pane v-for="s in statusTabs" :key="s" :label="s" :name="s" />
      </el-tabs>

      <div v-loading="loading">
        <template v-if="list.length">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div
              v-for="item in list"
              :key="item.id"
              class="cursor-pointer rounded-lg border border-gray-100 p-4 transition hover:border-brand hover:shadow-sm"
              @click="router.push(`/goods/${item.id}`)"
            >
              <div class="flex gap-3">
                <el-image
                  :src="item.images?.[0] || ''"
                  fit="cover"
                  class="h-20 w-20 shrink-0 rounded bg-gray-100"
                >
                  <template #error>
                    <div class="flex h-full w-full items-center justify-center text-xs text-gray-400">无图</div>
                  </template>
                </el-image>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <span class="truncate font-medium">{{ item.title }}</span>
                    <el-tag :type="GOODS_STATUS[item.status]?.type" size="small">{{ item.status }}</el-tag>
                  </div>
                  <div class="mt-1 text-base font-semibold text-red-500">{{ formatPrice(item.price) }}</div>
                  <div class="mt-1 text-xs text-gray-400">发布于 {{ formatTime(item.createTime) }}</div>
                </div>
              </div>

              <div v-if="item.status === '已驳回' && item.rejectReason" class="mt-2 text-xs text-red-500">
                驳回理由：{{ item.rejectReason }}
              </div>

              <!-- 操作按钮（按状态显示） -->
              <div class="mt-3 flex flex-wrap gap-2">
                <el-button
                  v-if="canEdit(item.status)"
                  size="small"
                  @click.stop="router.push(`/goods/${item.id}/edit`)"
                >编辑</el-button>
                <el-button
                  v-if="item.status === '在售'"
                  size="small"
                  :loading="actingId === item.id"
                  @click.stop="onStatus(item, 'off')"
                >下架</el-button>
                <el-button
                  v-if="item.status === '已下架'"
                  size="small"
                  type="primary"
                  :loading="actingId === item.id"
                  @click.stop="onStatus(item, 'on')"
                >重新上架</el-button>
                <el-button
                  v-if="item.status === '在售' || item.status === '已下架'"
                  size="small"
                  type="success"
                  :loading="actingId === item.id"
                  @click.stop="onSold(item)"
                >标记已售出</el-button>
                <el-button
                  v-if="canRemove(item.status)"
                  size="small"
                  type="danger"
                  plain
                  :loading="actingId === item.id"
                  @click.stop="onRemove(item)"
                >删除</el-button>
              </div>
            </div>
          </div>

          <Pagination v-model:page="page" v-model:page-size="pageSize" :total="total" @change="load" />
        </template>

        <EmptyState v-else-if="!loading" description="还没有发布商品">
          <el-button type="primary" size="small" @click="router.push('/publish')">去发布</el-button>
        </EmptyState>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { goodsApi } from '@/api'
import type { GoodsItem, GoodsStatus } from '@/api/types'
import { GOODS_STATUS } from '@/utils/constants'
import { formatPrice } from '@/utils'
import { Pagination, EmptyState } from '@/components'

const router = useRouter()

const statusTabs: GoodsStatus[] = ['待审核', '已驳回', '在售', '已下架', '已售出', '违规下架']
const activeStatus = ref<GoodsStatus | ''>('')

const list = ref<GoodsItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
/** 正在执行操作的商品ID（按钮 loading/防重复） */
const actingId = ref<number | null>(null)

function formatTime(t: string) {
  return new Date(t).toLocaleString('zh-CN')
}

/** 仅 待审核/已驳回/在售/已下架 可编辑（与后端一致） */
function canEdit(status: GoodsStatus) {
  return ['待审核', '已驳回', '在售', '已下架'].includes(status)
}

/** 终态（已售出/违规下架）不可删除 */
function canRemove(status: GoodsStatus) {
  return !['已售出', '违规下架'].includes(status)
}

async function load() {
  loading.value = true
  try {
    const data = await goodsApi.myList({
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

async function onStatus(item: GoodsItem, action: 'on' | 'off') {
  actingId.value = item.id
  try {
    await goodsApi.updateStatus(item.id, action)
    ElMessage.success(action === 'off' ? '已下架' : '已重新上架')
    await load()
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    actingId.value = null
  }
}

async function onSold(item: GoodsItem) {
  try {
    await ElMessageBox.confirm(`确认将「${item.title}」标记为已售出？该操作不可撤销。`, '标记已售出', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  actingId.value = item.id
  try {
    await goodsApi.updateStatus(item.id, 'sold')
    ElMessage.success('已标记为已售出')
    await load()
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    actingId.value = null
  }
}

async function onRemove(item: GoodsItem) {
  try {
    await ElMessageBox.confirm(`确认删除「${item.title}」？删除后不可恢复。`, '删除商品', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'error',
    })
  } catch {
    return
  }
  actingId.value = item.id
  try {
    await goodsApi.remove(item.id)
    ElMessage.success('已删除')
    // 删除后若当前页已空，回退一页
    if (list.value.length === 1 && page.value > 1) page.value -= 1
    await load()
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    actingId.value = null
  }
}

onMounted(load)
</script>
