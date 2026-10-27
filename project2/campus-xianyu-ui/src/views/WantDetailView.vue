<template>
  <div class="space-y-6 py-6">
    <div v-if="notFound" class="page-card">
      <EmptyState description="求购不存在">
        <el-button type="primary" @click="$router.push('/wants')">返回求购广场</el-button>
      </EmptyState>
    </div>

    <template v-else>
      <div v-loading="loading" class="page-card">
        <template v-if="want">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <h1 class="text-xl font-bold">{{ want.itemName }}</h1>
            <el-tag :type="WANT_STATUS[want.status]?.type ?? 'info'">
              {{ WANT_STATUS[want.status]?.label ?? want.status }}
            </el-tag>
          </div>

          <div class="mt-3 text-2xl font-bold text-brand">{{ formatPrice(want.budget) }}</div>

          <div class="mt-3 flex flex-wrap gap-2">
            <el-tag v-if="want.expectedCondition" type="warning" effect="plain">
              期望成色：{{ want.expectedCondition }}
            </el-tag>
            <el-tag v-if="want.campus" type="success" effect="plain">{{ want.campus }}</el-tag>
          </div>

          <div v-if="want.remark" class="mt-4">
            <div class="mb-1 text-sm font-semibold text-gray-600">描述 / 备注</div>
            <p class="whitespace-pre-wrap text-sm leading-6 text-gray-700">{{ want.remark }}</p>
          </div>

          <div class="mt-6 flex items-center justify-between border-t pt-4">
            <div class="flex items-center gap-3">
              <el-avatar :size="40" :src="want.publisher?.avatar ?? undefined">
                {{ want.publisher?.nickname?.charAt(0) ?? '?' }}
              </el-avatar>
              <div>
                <div class="flex items-center gap-2 text-sm font-semibold">
                  {{ want.publisher?.nickname ?? '匿名用户' }}
                  <el-tag v-if="want.publisher?.isCertified" size="small" type="success">
                    已实名
                  </el-tag>
                </div>
                <div class="mt-0.5 text-xs text-gray-400">发布于 {{ formatTime(want.createTime) }}</div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- 操作区 -->
      <div v-if="want" class="page-card">
        <!-- 本人求购 -->
        <template v-if="isOwner">
          <div v-if="want.status === '待接单'" class="flex flex-wrap gap-3">
            <el-button type="primary" @click="$router.push(`/wants/publish?id=${want.id}`)">
              编辑
            </el-button>
            <el-button type="danger" plain :loading="closing" @click="onClose">关闭求购</el-button>
          </div>
          <el-alert
            v-else
            :title="want.status === '已接单' ? '该求购已被接单，正在交易中' : '该求购已关闭'"
            :type="want.status === '已接单' ? 'success' : 'info'"
            :closable="false"
            show-icon
          />
        </template>

        <!-- 他人求购 -->
        <template v-else>
          <div class="flex flex-wrap gap-3">
            <el-button
              v-if="want.status === '待接单'"
              type="primary"
              :loading="accepting"
              @click="onAccept"
            >
              我有货，去接单
            </el-button>
            <el-button type="danger" plain @click="reportVisible = true">举报</el-button>
          </div>
          <el-alert
            v-if="want.status !== '待接单'"
            class="mt-3"
            :title="want.status === '已接单' ? '该求购已被其他同学接单' : '该求购已关闭'"
            type="info"
            :closable="false"
            show-icon
          />
        </template>
      </div>
    </template>

    <!-- 举报对话框 -->
    <el-dialog v-model="reportVisible" title="举报求购" width="480px" @closed="resetReport">
      <el-form label-position="top">
        <el-form-item label="举报理由（必填，1~300字）">
          <el-input
            v-model="reportReason"
            type="textarea"
            :rows="4"
            maxlength="300"
            show-word-limit
            placeholder="请描述举报原因"
          />
        </el-form-item>
        <el-form-item label="证据图片（可选，最多3张）">
          <ImageUpload v-model="reportImages" :limit="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reportVisible = false">取消</el-button>
        <el-button type="primary" :loading="reporting" @click="onReport">提交举报</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { reportApi, wantApi } from '@/api'
import type { WantItem } from '@/api/types'
import { EmptyState, ImageUpload } from '@/components'
import { WANT_STATUS } from '@/utils/constants'
import { formatPrice } from '@/utils'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

const id = Number(route.params.id)
const want = ref<WantItem | null>(null)
const loading = ref(false)
const notFound = ref(false)

const isOwner = computed(() => !!want.value && user.profile?.id === want.value.userId)

function formatTime(t: string): string {
  return new Date(t).toLocaleString('zh-CN')
}

async function load() {
  loading.value = true
  try {
    want.value = await wantApi.detail(id)
  } catch {
    // 404 等错误提示已由拦截器处理，这里标记为不存在
    notFound.value = true
  } finally {
    loading.value = false
  }
}

// 关闭求购
const closing = ref(false)
async function onClose() {
  try {
    await ElMessageBox.confirm('确定关闭该求购吗？关闭后不可恢复。', '提示', {
      type: 'warning',
      confirmButtonText: '确定关闭',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  closing.value = true
  try {
    await wantApi.close(id)
    ElMessage.success('已关闭')
    await load()
  } catch {
    // 错误提示已由拦截器处理
  } finally {
    closing.value = false
  }
}

// 接单
const accepting = ref(false)
async function onAccept() {
  if (!user.isCertified) {
    try {
      await ElMessageBox.confirm('接单需要先完成实名认证', '提示', {
        confirmButtonText: '去认证',
        cancelButtonText: '取消',
      })
      router.push('/me/certification')
    } catch {
      // 用户取消
    }
    return
  }
  accepting.value = true
  try {
    const { conversationId } = await wantApi.accept(id)
    ElMessage.success('接单成功，已创建私聊会话')
    router.push(`/chat/${conversationId}`)
  } catch {
    // 错误提示已由拦截器处理
  } finally {
    accepting.value = false
  }
}

// 举报
const reportVisible = ref(false)
const reporting = ref(false)
const reportReason = ref('')
const reportImages = ref<string[]>([])

function resetReport() {
  reportReason.value = ''
  reportImages.value = []
}

async function onReport() {
  const reason = reportReason.value.trim()
  if (!reason || reason.length > 300) {
    ElMessage.warning('请填写1~300字的举报理由')
    return
  }
  reporting.value = true
  try {
    await reportApi.create({
      targetType: '求购',
      targetId: id,
      reason,
      evidenceImages: reportImages.value.length ? reportImages.value : undefined,
    })
    ElMessage.success('举报已提交，等待管理员处理')
    reportVisible.value = false
  } catch {
    // 409 重复举报等错误提示已由拦截器处理
  } finally {
    reporting.value = false
  }
}

onMounted(load)
</script>
