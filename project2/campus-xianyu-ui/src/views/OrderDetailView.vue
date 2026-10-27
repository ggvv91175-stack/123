<template>
  <div class="space-y-6 py-6">
    <div class="page-card">
      <div class="flex items-center justify-between">
        <div class="page-title">订单详情</div>
        <el-button size="small" @click="router.push('/orders')">返回列表</el-button>
      </div>

      <div v-loading="loading">
        <template v-if="order">
          <!-- 状态步骤条（已取消单独展示） -->
          <el-alert
            v-if="order.status === '已取消'"
            type="info"
            :closable="false"
            show-icon
            title="订单已取消"
            description="该订单已被取消，不再进行后续交易流程。"
            class="mb-6"
          />
          <el-steps v-else :active="stepActive" align-center finish-status="success" class="mb-6">
            <el-step title="待沟通" description="双方沟通约定交易细节" />
            <el-step title="待交易" description="卖家已确认，等待当面交易" />
            <el-step title="已完成" description="交易完成" />
          </el-steps>

          <!-- 基本信息 -->
          <div class="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div class="text-xs text-gray-400">订单号</div>
              <div class="mt-1">{{ order.orderNo }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">订单状态</div>
              <div class="mt-1">
                <el-tag :type="ORDER_STATUS[order.status]?.type" size="small">{{ order.status }}</el-tag>
              </div>
            </div>
            <div v-if="order.appointmentTime">
              <div class="text-xs text-gray-400">约定时间</div>
              <div class="mt-1">{{ formatTime(order.appointmentTime) }}</div>
            </div>
            <div v-if="order.appointmentPlace">
              <div class="text-xs text-gray-400">约定地点</div>
              <div class="mt-1">{{ order.appointmentPlace }}</div>
            </div>
            <div v-if="order.remark" class="md:col-span-2">
              <div class="text-xs text-gray-400">备注</div>
              <div class="mt-1">{{ order.remark }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">创建时间</div>
              <div class="mt-1 text-sm text-gray-600">{{ formatTime(order.createTime) }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">更新时间</div>
              <div class="mt-1 text-sm text-gray-600">{{ formatTime(order.updateTime) }}</div>
            </div>
          </div>

          <!-- 商品摘要 -->
          <div class="mb-4 border-t border-gray-100 pt-4">
            <div class="mb-2 text-sm font-medium">商品信息</div>
            <div
              v-if="order.goods"
              class="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-100 p-3 transition hover:border-brand hover:shadow-sm"
              @click="router.push(`/goods/${order.goods.id}`)"
            >
              <el-image
                :src="order.goods.cover || ''"
                fit="cover"
                class="h-16 w-16 shrink-0 rounded bg-gray-100"
              >
                <template #error>
                  <div class="flex h-full w-full items-center justify-center text-xs text-gray-400">无图</div>
                </template>
              </el-image>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate font-medium">{{ order.goods.title }}</span>
                  <el-tag :type="GOODS_STATUS[order.goods.status]?.type" size="small">{{ order.goods.status }}</el-tag>
                </div>
                <div class="mt-1 text-base font-semibold text-red-500">{{ formatPrice(order.goods.price) }}</div>
              </div>
            </div>
            <div v-else class="rounded-lg border border-gray-100 p-3 text-sm text-gray-400">商品已删除</div>
          </div>

          <!-- 交易双方 -->
          <div class="mb-4 border-t border-gray-100 pt-4">
            <div class="mb-2 text-sm font-medium">交易双方</div>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div class="flex items-center gap-2 rounded-lg border border-gray-100 p-3">
                <el-avatar :src="order.buyer?.avatar || undefined" :size="36">
                  {{ order.buyer?.nickname?.charAt(0) || '买' }}
                </el-avatar>
                <div class="min-w-0">
                  <div class="truncate text-sm">
                    买家：{{ order.buyer?.nickname || '-' }}
                    <span v-if="order.buyerId === myId" class="text-xs text-brand">（我）</span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2 rounded-lg border border-gray-100 p-3">
                <el-avatar :src="order.seller?.avatar || undefined" :size="36">
                  {{ order.seller?.nickname?.charAt(0) || '卖' }}
                </el-avatar>
                <div class="min-w-0">
                  <div class="truncate text-sm">
                    卖家：{{ order.seller?.nickname || '-' }}
                    <span v-if="order.sellerId === myId" class="text-xs text-brand">（我）</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 操作区（按角色 + 状态显示） -->
          <div v-if="hasActions" class="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
            <el-button
              v-if="order.status === '待沟通' && isSeller"
              type="primary"
              :loading="acting"
              @click="onAction('confirm')"
            >确认交易</el-button>
            <el-button
              v-if="order.status === '待交易' && isBuyer"
              type="success"
              :loading="acting"
              @click="onAction('complete')"
            >确认收货 / 完成交易</el-button>
            <el-button
              v-if="order.status === '待沟通' || order.status === '待交易'"
              type="danger"
              plain
              :loading="acting"
              @click="onAction('cancel')"
            >取消订单</el-button>
          </div>
          <div v-else-if="order.status === '已完成' || order.status === '已取消'" class="border-t border-gray-100 pt-4 text-right text-sm text-gray-400">
            {{ order.status === '已完成' ? '订单已完成，感谢使用。' : '订单已取消，无可用操作。' }}
          </div>
        </template>

        <!-- 403/404：订单不存在或无权限 -->
        <EmptyState v-else-if="!loading" description="订单不存在或无权限查看">
          <el-button type="primary" size="small" @click="router.push('/orders')">返回订单列表</el-button>
        </EmptyState>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { orderApi } from '@/api'
import type { OrderItem } from '@/api/types'
import { GOODS_STATUS, ORDER_STATUS } from '@/utils/constants'
import { formatPrice } from '@/utils'
import { EmptyState } from '@/components'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const orderId = Number(route.params.id)
const order = ref<OrderItem | null>(null)
const loading = ref(false)
/** 操作按钮 loading（防重复提交） */
const acting = ref(false)

/** 当前用户ID */
const myId = computed(() => userStore.profile?.id)
const isBuyer = computed(() => !!order.value && order.value.buyerId === myId.value)
const isSeller = computed(() => !!order.value && order.value.sellerId === myId.value)

/** 步骤条当前进度：待沟通=0 待交易=1 已完成=2（已完成时全部点亮） */
const stepActive = computed(() => {
  if (!order.value) return 0
  if (order.value.status === '待沟通') return 0
  if (order.value.status === '待交易') return 1
  return 3
})

/** 是否有可用操作 */
const hasActions = computed(() => {
  if (!order.value) return false
  if (order.value.status === '待沟通' || order.value.status === '待交易') return true
  return false
})

function formatTime(t: string) {
  return new Date(t).toLocaleString('zh-CN')
}

async function load() {
  loading.value = true
  try {
    order.value = await orderApi.detail(orderId)
  } catch {
    // 403/404 等错误提示已由响应拦截器统一处理，此处展示空状态
    order.value = null
  } finally {
    loading.value = false
  }
}

type Action = 'confirm' | 'complete' | 'cancel'

const ACTION_TEXT: Record<Action, { title: string; confirm: string; success: string }> = {
  confirm: { title: '确认交易', confirm: '确认与买家达成交易？订单将进入「待交易」状态。', success: '已确认交易' },
  complete: { title: '完成交易', confirm: '确认已收到商品并完成交易？该操作不可撤销。', success: '交易已完成' },
  cancel: { title: '取消订单', confirm: '确认取消该订单？取消后不可恢复。', success: '订单已取消' },
}

async function onAction(action: Action) {
  const text = ACTION_TEXT[action]
  try {
    await ElMessageBox.confirm(text.confirm, text.title, {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  acting.value = true
  try {
    await orderApi.updateStatus(orderId, action)
    ElMessage.success(text.success)
    await load()
  } catch {
    // 错误提示已由响应拦截器统一处理（如终态操作 409）
  } finally {
    acting.value = false
  }
}

onMounted(load)
</script>
