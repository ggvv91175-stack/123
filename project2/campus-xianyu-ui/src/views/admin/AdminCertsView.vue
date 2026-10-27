<template>
  <div class="space-y-4">
    <!-- 状态筛选 -->
    <el-card>
      <el-radio-group v-model="query.status" @change="onSearch">
        <el-radio-button value="待审核">待审核</el-radio-button>
        <el-radio-button value="已通过">已通过</el-radio-button>
        <el-radio-button value="已驳回">已驳回</el-radio-button>
      </el-radio-group>
    </el-card>

    <!-- 认证表格 -->
    <el-card>
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="申请人" min-width="140">
          <template #default="{ row }">
            <div class="flex items-center gap-2">
              <el-avatar :size="28" :src="row.applicant?.avatar || undefined">{{ row.applicant?.nickname?.[0] }}</el-avatar>
              <span>{{ row.applicant?.nickname || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="学号" width="130">
          <template #default="{ row }">{{ maskStudentNo(row.studentNo) }}</template>
        </el-table-column>
        <el-table-column prop="college" label="学院" min-width="140" show-overflow-tooltip />
        <el-table-column label="证明材料" width="110">
          <template #default="{ row }">
            <div v-if="row.proofImages?.length" class="flex gap-1">
              <el-image
                :src="row.proofImages[0]"
                :preview-src-list="row.proofImages"
                preview-teleported
                fit="cover"
                class="h-10 w-10 rounded"
              />
              <span v-if="row.proofImages.length > 1" class="text-xs text-gray-400">+{{ row.proofImages.length - 1 }}</span>
            </div>
            <span v-else class="text-gray-300">无</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="CERT_STATUS[row.status]?.type">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="驳回理由" min-width="140">
          <template #default="{ row }">
            <span v-if="row.rejectReason" class="text-red-500">{{ row.rejectReason }}</span>
            <span v-else class="text-gray-300">-</span>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="165">
          <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === '待审核'">
              <el-button size="small" type="success" plain @click="onPass(row)">通过</el-button>
              <el-button size="small" type="danger" plain @click="openReject(row)">驳回</el-button>
            </template>
            <span v-else class="text-xs text-gray-400">{{ formatTime(row.reviewTime) }}</span>
          </template>
        </el-table-column>
        <template #empty><EmptyState description="暂无认证申请" /></template>
      </el-table>
      <Pagination v-model:page="query.page" v-model:page-size="query.pageSize" :total="total" @change="load" />
    </el-card>

    <!-- 驳回理由弹窗 -->
    <el-dialog v-model="rejectVisible" title="驳回实名认证" width="420px" destroy-on-close>
      <el-form ref="rejectFormRef" :model="rejectForm" :rules="rejectRules">
        <el-form-item prop="reason">
          <el-input
            v-model="rejectForm.reason"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="请输入驳回理由（必填，将展示给用户）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" :loading="submitting" @click="onReject">确认驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { adminApi } from '@/api'
import type { CertReviewItem } from '@/api/types'
import { maskStudentNo } from '@/utils'
import { CERT_STATUS } from '@/utils/constants'
import Pagination from '@/components/Pagination.vue'
import EmptyState from '@/components/EmptyState.vue'

const loading = ref(false)
const list = ref<CertReviewItem[]>([])
const total = ref(0)

const query = reactive<{ status: string; page: number; pageSize: number }>({
  status: '待审核',
  page: 1,
  pageSize: 10,
})

async function load() {
  loading.value = true
  try {
    const data = await adminApi.certifications(query)
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

/** 通过：二次确认 */
async function onPass(row: CertReviewItem) {
  await ElMessageBox.confirm(`确定通过「${row.applicant?.nickname ?? row.studentNo}」的实名认证吗？`, '审核确认', {
    type: 'warning',
    confirmButtonText: '通过',
    cancelButtonText: '取消',
  })
  await adminApi.reviewCertification(row.id, { result: 'pass' })
  ElMessage.success('已通过')
  load()
}

// ---------------- 驳回 ----------------

const rejectFormRef = ref<FormInstance>()
const rejectVisible = ref(false)
const submitting = ref(false)
const rejectTarget = ref<CertReviewItem>()
const rejectForm = reactive({ reason: '' })

const rejectRules: FormRules = {
  reason: [{ required: true, message: '请输入驳回理由', trigger: 'blur' }],
}

function openReject(row: CertReviewItem) {
  rejectTarget.value = row
  rejectForm.reason = ''
  rejectVisible.value = true
}

async function onReject() {
  await rejectFormRef.value?.validate()
  if (!rejectTarget.value) return
  submitting.value = true
  try {
    await adminApi.reviewCertification(rejectTarget.value.id, { result: 'reject', reason: rejectForm.reason.trim() })
    ElMessage.success('已驳回')
    rejectVisible.value = false
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
