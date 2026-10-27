<template>
  <div class="space-y-4">
    <!-- 筛选栏 -->
    <el-card>
      <el-form inline @submit.prevent>
        <el-form-item label="状态">
          <el-radio-group v-model="query.status" @change="onSearch">
            <el-radio-button value="待处理">待处理</el-radio-button>
            <el-radio-button value="已处理">已处理</el-radio-button>
            <el-radio-button value="已驳回">已驳回</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="目标类型">
          <el-select v-model="query.targetType" placeholder="全部" clearable class="w-28" @change="onSearch">
            <el-option v-for="t in targetTypes" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 举报表格 -->
    <el-card>
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="举报人" min-width="120">
          <template #default="{ row }">{{ row.reporter?.nickname || '-' }}</template>
        </el-table-column>
        <el-table-column label="目标" width="120">
          <template #default="{ row }">
            <el-tag>{{ row.targetType }}</el-tag>
            <span class="ml-1 text-xs text-gray-400">#{{ row.targetId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="举报理由" min-width="180" show-overflow-tooltip />
        <el-table-column label="证据" width="90">
          <template #default="{ row }">
            <div v-if="row.evidenceImages?.length" class="flex gap-1">
              <el-image
                :src="row.evidenceImages[0]"
                :preview-src-list="row.evidenceImages"
                preview-teleported
                fit="cover"
                class="h-10 w-10 rounded"
              />
              <span v-if="row.evidenceImages.length > 1" class="text-xs text-gray-400">
                +{{ row.evidenceImages.length - 1 }}
              </span>
            </div>
            <span v-else class="text-gray-300">无</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="REPORT_STATUS[row.status]?.type">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="处理结果" min-width="160">
          <template #default="{ row }">
            <div v-if="row.handleAction">
              <el-tag size="small" type="info">{{ row.handleAction }}</el-tag>
              <div v-if="row.handleResult" class="mt-1 text-xs text-gray-500">{{ row.handleResult }}</div>
            </div>
            <span v-else class="text-gray-300">-</span>
          </template>
        </el-table-column>
        <el-table-column label="举报时间" width="165">
          <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === '待处理'" size="small" type="primary" plain @click="openHandle(row)">
              处理
            </el-button>
            <span v-else class="text-xs text-gray-400">{{ formatTime(row.handleTime) }}</span>
          </template>
        </el-table-column>
        <template #empty><EmptyState description="暂无举报" /></template>
      </el-table>
      <Pagination v-model:page="query.page" v-model:page-size="query.pageSize" :total="total" @change="load" />
    </el-card>

    <!-- 处理弹窗 -->
    <el-dialog v-model="handleVisible" title="处理举报" width="440px" destroy-on-close>
      <template v-if="handleTarget">
        <el-descriptions :column="1" border size="small" class="mb-4">
          <el-descriptions-item label="目标">
            {{ handleTarget.targetType }} #{{ handleTarget.targetId }}
          </el-descriptions-item>
          <el-descriptions-item label="举报理由">{{ handleTarget.reason }}</el-descriptions-item>
        </el-descriptions>

        <el-form ref="handleFormRef" :model="handleForm" :rules="handleRules" label-width="90px">
          <el-form-item label="处理动作" prop="action">
            <el-radio-group v-model="handleForm.action">
              <el-radio v-for="a in actionOptions" :key="a" :value="a" class="!block">{{ a }}</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="处理说明" prop="result">
            <el-input
              v-model="handleForm.result"
              type="textarea"
              :rows="3"
              maxlength="200"
              show-word-limit
              :placeholder="handleForm.action === '驳回举报' ? '请输入驳回说明（必填）' : '选填，将记录到处理结果'"
            />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="handleVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onHandle">确认处理</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { adminApi } from '@/api'
import type { AdminReportItem, AdminReportQuery, HandleAction, ReportTargetType } from '@/api/types'
import { REPORT_STATUS } from '@/utils/constants'
import Pagination from '@/components/Pagination.vue'
import EmptyState from '@/components/EmptyState.vue'

const loading = ref(false)
const list = ref<AdminReportItem[]>([])
const total = ref(0)
const targetTypes: ReportTargetType[] = ['商品', '求购', '用户', '留言']

const query = reactive<Required<Pick<AdminReportQuery, 'page' | 'pageSize'>> & AdminReportQuery>({
  status: '待处理',
  targetType: undefined,
  page: 1,
  pageSize: 10,
})

async function load() {
  loading.value = true
  try {
    const data = await adminApi.reports(query)
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function onSearch() {
  query.page = 1
  load()
}

// ---------------- 处理 ----------------

/** 处理动作与目标类型映射（与后端强制校验一致） */
const ACTION_MAP: Record<ReportTargetType, HandleAction[]> = {
  商品: ['下架商品', '警告用户', '驳回举报'],
  求购: ['警告用户', '驳回举报'],
  用户: ['封禁用户', '警告用户', '驳回举报'],
  留言: ['删除留言', '警告用户', '驳回举报'],
}

const handleFormRef = ref<FormInstance>()
const handleVisible = ref(false)
const submitting = ref(false)
const handleTarget = ref<AdminReportItem>()
const handleForm = reactive<{ action: HandleAction | ''; result: string }>({ action: '', result: '' })

const actionOptions = computed<HandleAction[]>(() =>
  handleTarget.value ? ACTION_MAP[handleTarget.value.targetType] : [],
)

const handleRules: FormRules = {
  action: [{ required: true, message: '请选择处理动作', trigger: 'change' }],
  result: [
    {
      validator: (_r, v: string, cb) => {
        if (handleForm.action === '驳回举报' && !v?.trim()) cb(new Error('驳回举报必须填写处理说明'))
        else cb()
      },
      trigger: 'blur',
    },
  ],
}

function openHandle(row: AdminReportItem) {
  handleTarget.value = row
  handleForm.action = ''
  handleForm.result = ''
  handleVisible.value = true
}

async function onHandle() {
  await handleFormRef.value?.validate()
  if (!handleTarget.value || !handleForm.action) return
  submitting.value = true
  try {
    await adminApi.handleReport(handleTarget.value.id, {
      action: handleForm.action,
      result: handleForm.result.trim() || undefined,
    })
    ElMessage.success('已处理')
    handleVisible.value = false
    load()
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    submitting.value = false
  }
}

function formatTime(t?: string | null) {
  return t ? new Date(t).toLocaleString('zh-CN') : '-'
}

onMounted(load)
</script>
