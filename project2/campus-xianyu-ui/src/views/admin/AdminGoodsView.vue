<template>
  <el-card>
    <el-tabs v-model="activeTab">
      <!-- ========== 商品审核 ========== -->
      <el-tab-pane label="商品审核" name="goods">
        <div class="space-y-4">
          <el-form inline @submit.prevent>
            <el-form-item label="状态">
              <el-select v-model="goodsQuery.status" placeholder="全部" clearable class="w-32" @change="onGoodsSearch">
                <el-option v-for="s in goodsStatusOptions" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
          </el-form>

          <el-table v-loading="goodsLoading" :data="goodsList" stripe>
            <el-table-column label="商品" min-width="220">
              <template #default="{ row }">
                <div class="flex items-center gap-2">
                  <el-image
                    v-if="row.images?.length"
                    :src="row.images[0]"
                    :preview-src-list="row.images"
                    preview-teleported
                    fit="cover"
                    class="h-10 w-10 shrink-0 rounded"
                  />
                  <div v-else class="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-gray-100 text-xs text-gray-300">
                    无图
                  </div>
                  <span class="line-clamp-1">{{ row.title }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="价格" width="100">
              <template #default="{ row }">{{ formatPrice(row.price) }}</template>
            </el-table-column>
            <el-table-column label="发布者" min-width="120">
              <template #default="{ row }">{{ row.publisher?.nickname || '-' }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="GOODS_STATUS[row.status]?.type">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="驳回/下架理由" min-width="150">
              <template #default="{ row }">
                <span v-if="row.rejectReason" class="text-red-500">{{ row.rejectReason }}</span>
                <span v-else class="text-gray-300">-</span>
              </template>
            </el-table-column>
            <el-table-column label="发布时间" width="165">
              <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="170" fixed="right">
              <template #default="{ row }">
                <!-- 待审核：通过 / 驳回 -->
                <template v-if="row.status === '待审核'">
                  <el-button size="small" type="success" plain @click="onGoodsPass(row)">通过</el-button>
                  <el-button size="small" type="danger" plain @click="openReasonDialog('reject', row)">驳回</el-button>
                </template>
                <!-- 在售 / 已下架：可违规下架 -->
                <el-button
                  v-else-if="row.status === '在售' || row.status === '已下架'"
                  size="small"
                  type="danger"
                  plain
                  @click="openReasonDialog('takedown', row)"
                >
                  违规下架
                </el-button>
                <span v-else class="text-xs text-gray-300">-</span>
              </template>
            </el-table-column>
            <template #empty><EmptyState description="暂无商品" /></template>
          </el-table>
          <Pagination v-model:page="goodsQuery.page" v-model:page-size="goodsQuery.pageSize" :total="goodsTotal" @change="loadGoods" />
        </div>
      </el-tab-pane>

      <!-- ========== 求购管理 ========== -->
      <el-tab-pane label="求购管理" name="wants">
        <div class="space-y-4">
          <el-form inline @submit.prevent>
            <el-form-item label="关键词">
              <el-input
                v-model="wantQuery.keyword"
                placeholder="求购名称"
                clearable
                class="w-48"
                @keyup.enter="onWantSearch"
                @clear="onWantSearch"
              />
            </el-form-item>
            <el-form-item label="状态">
              <el-select v-model="wantQuery.status" placeholder="全部" clearable class="w-32" @change="onWantSearch">
                <el-option v-for="s in wantStatusOptions" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="onWantSearch">搜索</el-button>
            </el-form-item>
          </el-form>

          <el-table v-loading="wantLoading" :data="wantList" stripe>
            <el-table-column prop="itemName" label="求购名称" min-width="180" show-overflow-tooltip />
            <el-table-column label="预算" width="110">
              <template #default="{ row }">{{ formatPrice(row.budget) }}</template>
            </el-table-column>
            <el-table-column label="发布者" min-width="120">
              <template #default="{ row }">{{ row.publisher?.nickname || '-' }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="WANT_STATUS[row.status]?.type">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="发布时间" width="165">
              <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <el-button v-if="row.status === '待接单'" size="small" type="danger" plain @click="onWantTakedown(row)">
                  违规下架
                </el-button>
                <span v-else class="text-xs text-gray-300">-</span>
              </template>
            </el-table-column>
            <template #empty><EmptyState description="暂无求购" /></template>
          </el-table>
          <Pagination v-model:page="wantQuery.page" v-model:page-size="wantQuery.pageSize" :total="wantTotal" @change="loadWants" />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 驳回/违规下架理由弹窗（商品） -->
    <el-dialog v-model="reasonVisible" :title="reasonMode === 'reject' ? '驳回商品' : '违规下架商品'" width="420px" destroy-on-close>
      <el-form ref="reasonFormRef" :model="reasonForm" :rules="reasonRules">
        <el-form-item prop="reason">
          <el-input
            v-model="reasonForm.reason"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            :placeholder="reasonMode === 'reject' ? '请输入驳回理由（必填，将展示给用户）' : '请输入下架理由（必填）'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reasonVisible = false">取消</el-button>
        <el-button type="danger" :loading="submitting" @click="onReasonSubmit">
          {{ reasonMode === 'reject' ? '确认驳回' : '确认下架' }}
        </el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { adminApi } from '@/api'
import type { AdminWantQuery, GoodsItem, GoodsStatus, WantItem, WantStatus } from '@/api/types'
import { formatPrice } from '@/utils'
import { GOODS_STATUS, WANT_STATUS } from '@/utils/constants'
import Pagination from '@/components/Pagination.vue'
import EmptyState from '@/components/EmptyState.vue'

const activeTab = ref<'goods' | 'wants'>('goods')

// ---------------- 商品审核 ----------------

const goodsLoading = ref(false)
const goodsList = ref<GoodsItem[]>([])
const goodsTotal = ref(0)
const goodsStatusOptions: GoodsStatus[] = ['待审核', '在售', '已下架', '已驳回', '违规下架', '已售出']

const goodsQuery = reactive<{ status?: GoodsStatus; page: number; pageSize: number }>({
  status: '待审核',
  page: 1,
  pageSize: 10,
})

async function loadGoods() {
  goodsLoading.value = true
  try {
    const data = await adminApi.goods(goodsQuery)
    goodsList.value = data.list
    goodsTotal.value = data.total
  } finally {
    goodsLoading.value = false
  }
}

function onGoodsSearch() {
  goodsQuery.page = 1
  loadGoods()
}

async function onGoodsPass(row: GoodsItem) {
  await ElMessageBox.confirm(`确定通过商品「${row.title}」的审核吗？`, '审核确认', {
    type: 'warning',
    confirmButtonText: '通过',
    cancelButtonText: '取消',
  })
  await adminApi.reviewGoods(row.id, { result: 'pass' })
  ElMessage.success('已通过')
  loadGoods()
}

// ---------------- 商品驳回 / 违规下架（共用理由弹窗） ----------------

const reasonFormRef = ref<FormInstance>()
const reasonVisible = ref(false)
const submitting = ref(false)
const reasonMode = ref<'reject' | 'takedown'>('reject')
const reasonTarget = ref<GoodsItem>()
const reasonForm = reactive({ reason: '' })

const reasonRules: FormRules = {
  reason: [{ required: true, message: '请输入理由', trigger: 'blur' }],
}

function openReasonDialog(mode: 'reject' | 'takedown', row: GoodsItem) {
  reasonMode.value = mode
  reasonTarget.value = row
  reasonForm.reason = ''
  reasonVisible.value = true
}

async function onReasonSubmit() {
  await reasonFormRef.value?.validate()
  if (!reasonTarget.value) return
  submitting.value = true
  try {
    if (reasonMode.value === 'reject') {
      await adminApi.reviewGoods(reasonTarget.value.id, { result: 'reject', reason: reasonForm.reason.trim() })
      ElMessage.success('已驳回')
    } else {
      await adminApi.takedownGoods(reasonTarget.value.id, reasonForm.reason.trim())
      ElMessage.success('已下架')
    }
    reasonVisible.value = false
    loadGoods()
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    submitting.value = false
  }
}

// ---------------- 求购管理 ----------------

const wantLoading = ref(false)
const wantList = ref<WantItem[]>([])
const wantTotal = ref(0)
const wantStatusOptions: WantStatus[] = ['待接单', '已接单', '已关闭']

const wantQuery = reactive<Required<Pick<AdminWantQuery, 'page' | 'pageSize'>> & AdminWantQuery>({
  keyword: undefined,
  status: undefined,
  page: 1,
  pageSize: 10,
})

async function loadWants() {
  wantLoading.value = true
  try {
    const data = await adminApi.wants(wantQuery)
    wantList.value = data.list
    wantTotal.value = data.total
  } finally {
    wantLoading.value = false
  }
}

function onWantSearch() {
  wantQuery.page = 1
  loadWants()
}

/** 求购违规下架：待接单 → 已关闭，二次确认 */
async function onWantTakedown(row: WantItem) {
  await ElMessageBox.confirm(`确定违规下架求购「${row.itemName}」吗？下架后将变为「已关闭」。`, '下架确认', {
    type: 'warning',
    confirmButtonText: '下架',
    cancelButtonText: '取消',
  })
  await adminApi.takedownWant(row.id)
  ElMessage.success('已下架')
  loadWants()
}

function formatTime(t?: string) {
  return t ? new Date(t).toLocaleString('zh-CN') : '-'
}

onMounted(() => {
  loadGoods()
  loadWants()
})
</script>
