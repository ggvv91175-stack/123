<template>
  <div class="space-y-6 py-6">
    <div class="page-card">
      <div class="page-title">我的留言</div>

      <div v-loading="loading">
        <template v-if="list.length">
          <div class="space-y-3">
            <div v-for="item in list" :key="item.id" class="rounded-lg border border-gray-100 p-4">
              <!-- 商品摘要卡 -->
              <div
                v-if="item.goods"
                class="flex cursor-pointer items-center gap-3 rounded bg-gray-50 p-2 transition hover:bg-gray-100"
                @click="router.push(`/goods/${item.goodsId}`)"
              >
                <el-image
                  :src="item.goods.image || ''"
                  fit="cover"
                  class="h-12 w-12 shrink-0 rounded bg-gray-200"
                >
                  <template #error>
                    <div class="flex h-full w-full items-center justify-center text-xs text-gray-400">无图</div>
                  </template>
                </el-image>
                <span class="min-w-0 flex-1 truncate text-sm">{{ item.goods.title }}</span>
                <el-tag :type="GOODS_STATUS[item.goods.status]?.type || 'info'" size="small">
                  {{ item.goods.status }}
                </el-tag>
              </div>
              <div v-else class="rounded bg-gray-50 p-2 text-sm text-gray-400">商品已删除</div>

              <!-- 留言内容 -->
              <div class="mt-2 text-sm text-gray-700">
                <span v-if="item.isReply" class="text-gray-500">
                  回复 @{{ item.replyToUser?.nickname || '未知用户' }}：
                </span>
                {{ item.content }}
              </div>

              <div class="mt-2 flex items-center justify-between">
                <span class="text-xs text-gray-400">{{ formatTime(item.createTime) }}</span>
                <el-button
                  size="small"
                  type="danger"
                  plain
                  :loading="removingId === item.id"
                  @click="onRemove(item)"
                >删除</el-button>
              </div>
            </div>
          </div>

          <Pagination v-model:page="page" v-model:page-size="pageSize" :total="total" @change="load" />
        </template>

        <EmptyState v-else-if="!loading" description="还没有留言记录" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { commentApi } from '@/api'
import type { MyCommentItem } from '@/api/types'
import { GOODS_STATUS } from '@/utils/constants'
import { Pagination, EmptyState } from '@/components'

const router = useRouter()

const list = ref<MyCommentItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
/** 正在删除的留言ID（按钮 loading/防重复） */
const removingId = ref<number | null>(null)

function formatTime(t: string) {
  return new Date(t).toLocaleString('zh-CN')
}

async function load() {
  loading.value = true
  try {
    const data = await commentApi.myList({ page: page.value, pageSize: pageSize.value })
    list.value = data.list
    total.value = data.total
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    loading.value = false
  }
}

async function onRemove(item: MyCommentItem) {
  try {
    await ElMessageBox.confirm('确认删除这条留言？删除后不可恢复。', '删除留言', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  removingId.value = item.id
  try {
    await commentApi.remove(item.id)
    ElMessage.success('已删除')
    if (list.value.length === 1 && page.value > 1) page.value -= 1
    await load()
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    removingId.value = null
  }
}

onMounted(load)
</script>
