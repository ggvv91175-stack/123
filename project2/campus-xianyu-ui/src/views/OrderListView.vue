<template>
  <div class="space-y-6 py-6">
    <div class="page-card">
      <div class="page-title">我的订单</div>

      <!-- 视角切换：我的买到 / 我的卖出 -->
      <el-tabs v-model="role" @tab-change="onFilterChange">
        <el-tab-pane label="我的买到" name="buy" />
        <el-tab-pane label="我的卖出" name="sell" />
      </el-tabs>

      <!-- 状态筛选 -->
      <el-tabs v-model="activeStatus" @tab-change="onFilterChange">
        <el-tab-pane label="全部" name="" />
        <el-tab-pane v-for="s in statusTabs" :key="s" :label="s" :name="s" />
      </el-tabs>

      <div v-loading="loading">
        <template v-if="list.length">
          <!-- 单列卡片列表 -->
          <div class="space-y-4">
            <div
              v-for="item in list"
              :key="item.id"
              class="cursor-pointer rounded-lg border border-gray-100 p-4 transition hover:border-brand hover:shadow-sm"
              @click="router.push(`/orders/${item.id}`)"
            >
              <div class="flex gap-3">
                <el-image
                  :src="item.goods?.cover || ''"
                  fit="cover"
                  class="h-20 w-20 shrink-0 rounded bg-gray-100"
                >
                  <template #error>
                    <div class="flex h-full w-full items-center justify-center text-xs text-gray-400">无图</div>
                  </template>
                </el-image>

                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <span
                      v-if="item.goods"
                      class="truncate font-medium hover:text-brand"
                      @click.stop="router.push(`/goods/${item.goods.id}`)"
                    >{{ item.goods.title }}</span>
                    <span v-else class="truncate font-medium text-gray-400">商品已删除</span>
                    <el-tag :type="ORDER_STATUS[item.status]?.type" size="small">{{ item.status }}</el-tag>
                  </div>
                  <div class="mt-1 text-base font-semibold text-red-500">
                    {{ item.goods ? formatPrice(item.goods.price) : '¥--' }}
                  </div>
                  <div class="mt-1 text-xs text-gray-400">订单号：{{ item.orderNo }}</div>
                  <div class="mt-1 text-xs text-gray-500">
                    {{ role === 'buy' ? '卖家' : '买家' }}：{{ item.peer?.nickname || '-' }}
                  </div>
                  <div v-if="item.appointmentTime || item.appointmentPlace" class="mt-1 text-xs text-gray-500">
                    <span v-if="item.appointmentTime">约定时间：{{ formatTime(item.appointmentTime) }}</span>
                    <span v-if="item.appointmentTime && item.appointmentPlace" class="mx-1">·</span>
                    <span v-if="item.appointmentPlace">地点：{{ item.appointmentPlace }}</span>
                  </div>
                  <div class="mt-1 text-xs text-gray-400">创建于 {{ formatTime(item.createTime) }}</div>
                </div>
              </div>

              <!-- 快捷操作（待沟通/待交易可取消） -->
              <div v-if="canCancel(item.status)" class="mt-3 flex justify-end gap-2">
                <el-button size="small" @click.stop="router.push(`/orders/${item.id}`)">查看详情</el-button>
                <el-button
                  size="small"
                  type="danger"
                  plain
                  :loading="actingId === item.id"
                  @click.stop="onCancel(item)"
                >取消订单</el-button>
              </div>
            </div>
          </div>

          <Pagination v-model:page="page" v-model:page-size="pageSize" :total="total" @change="load" />
        </template>

        <EmptyState v-else-if="!loading" description="暂无订单" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { orderApi } from '@/api'
import type { OrderItem, OrderStatus } from '@/api/types'
import { ORDER_STATUS } from '@/utils/constants'
import { formatPrice } from '@/utils'
import { Pagination, EmptyState } from '@/components'

const router = useRouter()

const role = ref<'buy' | 'sell'>('buy')
const statusTabs: OrderStatus[] = ['待沟通', '待交易', '已完成', '已取消']
const activeStatus = ref<OrderStatus | ''>('')

const list = ref<OrderItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
/** 正在执行操作的订单ID（按钮 loading/防重复） */
const actingId = ref<number | null>(null)

function formatTime(t: string) {
  return new Date(t).toLocaleString('zh-CN')
}

/** 待沟通/待交易 可取消 */
function canCancel(status: OrderStatus) {
  return status === '待沟通' || status === '待交易'
}

async function load() {
  loading.value = true
  try {
    const data = await orderApi.list({
      role: role.value,
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

/** 视角或状态变化：重置页码并重新查询 */
function onFilterChange() {
  page.value = 1
  load()
}

async function onCancel(item: OrderItem) {
  try {
    await ElMessageBox.confirm(`确认取消订单「${item.orderNo}」？取消后不可恢复。`, '取消订单', {
      confirmButtonText: '确认取消',
      cancelButtonText: '再想想',
      type: 'warning',
    })
  } catch {
    return
  }
  actingId.value = item.id
  try {
    await orderApi.updateStatus(item.id, 'cancel')
    ElMessage.success('订单已取消')
    await load()
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    actingId.value = null
  }
}

onMounted(load)
</script>
