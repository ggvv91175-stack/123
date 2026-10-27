<template>
  <div class="space-y-6 py-6">
    <div v-loading="loading" class="min-h-32">
      <template v-if="goods">
        <!-- 商品主体：PC 左右两栏，移动端上下堆叠 -->
        <div class="page-card grid gap-6 md:grid-cols-2">
          <!-- 图片区 -->
          <div>
            <el-carousel v-if="goods.images?.length" :height="carouselHeight" indicator-position="outside">
              <el-carousel-item v-for="(img, i) in goods.images" :key="i">
                <el-image
                  :src="img"
                  fit="contain"
                  class="h-full w-full"
                  :preview-src-list="goods.images"
                  :initial-index="i"
                  preview-teleported
                />
              </el-carousel-item>
            </el-carousel>
            <div v-else class="flex h-80 w-full items-center justify-center rounded-lg bg-gray-100 text-gray-400">
              暂无图片
            </div>
          </div>

          <!-- 信息区 -->
          <div class="flex flex-col gap-4">
            <div>
              <div class="flex items-start gap-2">
                <h1 class="flex-1 text-xl font-bold text-gray-800">{{ goods.title }}</h1>
                <el-tag :type="statusTag.type">{{ statusTag.label }}</el-tag>
              </div>
              <div class="mt-2 text-3xl font-bold text-red-500">{{ formatPrice(goods.price) }}</div>
            </div>

            <div class="flex flex-wrap gap-2">
              <el-tag type="info">成色：{{ goods.conditionLevel }}</el-tag>
              <el-tag type="info">校区：{{ goods.campus }}</el-tag>
              <el-tag type="info">交易方式：{{ goods.tradeMethod }}</el-tag>
            </div>

            <div class="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm leading-6 text-gray-700">
              {{ goods.description }}
            </div>

            <div class="text-xs text-gray-400">发布于 {{ formatTime(goods.createTime) }}</div>

            <!-- 发布者卡片 -->
            <div class="flex items-center gap-3 rounded-lg border p-3">
              <el-avatar :size="40" :src="goods.publisher?.avatar || undefined">
                {{ goods.publisher?.nickname?.slice(0, 1) }}
              </el-avatar>
              <div class="flex-1">
                <div class="flex items-center gap-2 text-sm font-medium">
                  {{ goods.publisher?.nickname || '匿名用户' }}
                  <el-tag v-if="goods.publisher?.isCertified" type="success" size="small">已实名</el-tag>
                </div>
                <div class="text-xs text-gray-400">卖家</div>
              </div>
            </div>

            <!-- 操作区 -->
            <div class="flex flex-col gap-2">
              <template v-if="isOwner">
                <el-button type="primary" @click="$router.push(`/goods/${goods.id}/edit`)">编辑</el-button>
                <el-alert v-if="goods.status !== '在售'" type="warning" :closable="false" show-icon>
                  <template #title>
                    当前状态：{{ goods.status }}
                    <template v-if="goods.rejectReason">（驳回原因：{{ goods.rejectReason }}）</template>
                    ，编辑后可重新提交审核
                  </template>
                </el-alert>
              </template>
              <template v-else>
                <el-button
                  v-if="goods.status === '在售'"
                  type="primary"
                  size="large"
                  :loading="contactLoading"
                  @click="onContact"
                >
                  联系卖家
                </el-button>
                <el-button
                  v-if="goods.status === '在售'"
                  type="success"
                  size="large"
                  @click="onBuy"
                >
                  立即购买
                </el-button>
                <el-button plain type="danger" @click="reportVisible = true">举报</el-button>
              </template>
            </div>
          </div>
        </div>

        <!-- 留言区 -->
        <div class="page-card">
          <div class="page-title">留言（{{ commentTotal }}）</div>

          <!-- 发表新留言 -->
          <div v-if="user.isLoggedIn" class="mb-4">
            <el-input
              v-model="newComment"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
              placeholder="对这件商品感兴趣？留言问问卖家吧（1~500字）"
            />
            <div class="mt-2 text-right">
              <el-button type="primary" :loading="commentSubmitting" @click="onCreateComment">发表留言</el-button>
            </div>
          </div>
          <div v-else class="mb-4 rounded-lg bg-gray-50 p-3 text-center text-sm text-gray-500">
            <router-link :to="{ path: '/login', query: { redirect: route.fullPath } }" class="text-brand hover:underline">
              登录
            </router-link>
            后可留言
          </div>

          <!-- 留言列表 -->
          <div v-loading="commentLoading" class="min-h-16">
            <template v-if="comments.length > 0">
              <div v-for="c in comments" :key="c.id" class="border-b py-3 last:border-b-0">
                <div class="flex items-start gap-3">
                  <el-avatar :size="32" :src="c.user?.avatar || undefined">
                    {{ c.user?.nickname?.slice(0, 1) }}
                  </el-avatar>
                  <div class="flex-1">
                    <div class="flex items-center gap-2 text-sm">
                      <span class="font-medium">{{ c.user?.nickname || '匿名用户' }}</span>
                      <span class="text-xs text-gray-400">{{ formatTime(c.createTime) }}</span>
                    </div>
                    <div class="mt-1 whitespace-pre-wrap text-sm text-gray-700">{{ c.content }}</div>
                    <div class="mt-1 flex gap-3 text-xs">
                      <span
                        v-if="user.isLoggedIn"
                        class="cursor-pointer text-brand hover:underline"
                        @click="startReply(c.id, c.user?.nickname)"
                      >
                        回复
                      </span>
                      <span
                        v-if="c.user?.id && c.user.id === user.profile?.id"
                        class="cursor-pointer text-red-400 hover:underline"
                        @click="onDeleteComment(c.id)"
                      >
                        删除
                      </span>
                    </div>

                    <!-- 回复列表（平铺在顶层留言下） -->
                    <div v-if="c.replies?.length" class="mt-2 space-y-2 rounded-lg bg-gray-50 p-3">
                      <div v-for="r in c.replies" :key="r.id">
                        <div class="flex items-center gap-2 text-xs">
                          <span class="font-medium">{{ r.user?.nickname || '匿名用户' }}</span>
                          <span v-if="r.replyToUser" class="text-gray-400">
                            回复 {{ r.replyToUser.nickname }}
                          </span>
                          <span class="text-gray-400">{{ formatTime(r.createTime) }}</span>
                        </div>
                        <div class="mt-0.5 whitespace-pre-wrap text-sm text-gray-700">{{ r.content }}</div>
                        <div class="mt-0.5 flex gap-3 text-xs">
                          <span
                            v-if="user.isLoggedIn"
                            class="cursor-pointer text-brand hover:underline"
                            @click="startReply(r.id, r.user?.nickname)"
                          >
                            回复
                          </span>
                          <span
                            v-if="r.user?.id && r.user.id === user.profile?.id"
                            class="cursor-pointer text-red-400 hover:underline"
                            @click="onDeleteComment(r.id)"
                          >
                            删除
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- 回复输入框 -->
                    <div v-if="replyingTo === c.id || c.replies?.some((r) => r.id === replyingTo)" class="mt-2">
                      <el-input
                        v-model="replyContent"
                        type="textarea"
                        :rows="2"
                        maxlength="500"
                        :placeholder="`回复 ${replyingNickname}（1~500字）`"
                      />
                      <div class="mt-1 text-right">
                        <el-button size="small" @click="cancelReply">取消</el-button>
                        <el-button size="small" type="primary" :loading="replySubmitting" @click="onSubmitReply">
                          提交
                        </el-button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <Pagination
                v-model:page="commentPage"
                v-model:page-size="commentPageSize"
                :total="commentTotal"
                @change="loadComments"
              />
            </template>
            <EmptyState v-else-if="!commentLoading" description="暂无留言，来问第一句吧" :image-size="100" />
          </div>
        </div>
      </template>

      <!-- 商品不存在 / 已下架 -->
      <div v-else-if="!loading && notFound" class="page-card">
        <EmptyState description="商品不存在或已下架">
          <el-button type="primary" size="small" @click="$router.push('/goods')">去逛逛其他闲置</el-button>
        </EmptyState>
      </div>
    </div>

    <!-- 购买下单弹窗 -->
    <el-dialog v-model="buyVisible" title="确认下单" width="min(480px, 92vw)" :close-on-click-modal="false">
      <el-form label-position="top">
        <el-form-item label="约定地点（必填，1~100字）">
          <el-input v-model="buyForm.appointmentPlace" maxlength="100" show-word-limit placeholder="如：东区图书馆门口" />
        </el-form-item>
        <el-form-item label="约定时间（可选）">
          <el-date-picker
            v-model="buyForm.appointmentTime"
            type="datetime"
            placeholder="选择约定交易时间"
            :disabled-date="(d: Date) => d.getTime() < Date.now() - 86400000"
            class="!w-full"
          />
        </el-form-item>
        <el-form-item label="备注（可选，≤500字）">
          <el-input v-model="buyForm.remark" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="如：希望当面验货" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="buyVisible = false">取消</el-button>
        <el-button type="primary" :loading="buySubmitting" @click="onSubmitBuy">提交订单</el-button>
      </template>
    </el-dialog>

    <!-- 举报弹窗 -->
    <el-dialog v-model="reportVisible" title="举报商品" width="480px" :close-on-click-modal="false">
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
        <el-button type="primary" :loading="reportSubmitting" @click="onSubmitReport">提交举报</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { chatApi, commentApi, goodsApi, orderApi, reportApi } from '@/api'
import type { CommentItem, GoodsItem } from '@/api/types'
import { EmptyState, ImageUpload, Pagination } from '@/components'
import { useUserStore } from '@/stores/user'
import { GOODS_STATUS } from '@/utils/constants'
import { formatPrice } from '@/utils'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

const goodsId = Number(route.params.id)
const goods = ref<GoodsItem | null>(null)
const loading = ref(false)
const notFound = ref(false)

const isOwner = computed(() => !!goods.value && goods.value.userId === user.profile?.id)
const statusTag = computed(() => GOODS_STATUS[goods.value?.status ?? ''] ?? { label: goods.value?.status ?? '', type: 'info' as const })

/** 移动端轮播矮一些，PC 高一些 */
const carouselHeight = computed(() => (window.innerWidth >= 768 ? '420px' : '260px'))

function formatTime(t?: string) {
  return t ? new Date(t).toLocaleString('zh-CN') : '-'
}

async function load() {
  loading.value = true
  try {
    goods.value = await goodsApi.detail(goodsId)
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
}

/* ---------- 联系卖家 ---------- */
const contactLoading = ref(false)

async function onContact() {
  if (!goods.value) return
  if (!user.isLoggedIn) {
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  if (!user.isCertified) {
    try {
      await ElMessageBox.confirm('需先完成实名认证才能私聊卖家', '提示', { type: 'warning' })
      router.push('/me/certification')
    } catch {
      // 用户取消
    }
    return
  }
  contactLoading.value = true
  try {
    const { conversationId } = await chatApi.createSession(goods.value.id)
    router.push(`/chat/${conversationId}`)
  } catch {
    // 错误提示已由拦截器处理
  } finally {
    contactLoading.value = false
  }
}

/* ---------- 立即购买 ---------- */
const buyVisible = ref(false)
const buySubmitting = ref(false)
const buyForm = ref({ appointmentPlace: '', appointmentTime: null as Date | null, remark: '' })

/** 打开下单弹窗前复用联系卖家的登录/实名校验 */
async function onBuy() {
  if (!goods.value) return
  if (!user.isLoggedIn) {
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  if (!user.isCertified) {
    try {
      await ElMessageBox.confirm('需先完成实名认证才能下单', '提示', { type: 'warning' })
      router.push('/me/certification')
    } catch {
      // 用户取消
    }
    return
  }
  buyForm.value = { appointmentPlace: '', appointmentTime: null, remark: '' }
  buyVisible.value = true
}

async function onSubmitBuy() {
  if (!goods.value) return
  const place = buyForm.value.appointmentPlace.trim()
  if (!place || place.length > 100) {
    ElMessage.warning('请填写1~100字的约定地点')
    return
  }
  buySubmitting.value = true
  try {
    const { id } = await orderApi.create({
      goodsId: goods.value.id,
      appointmentPlace: place,
      appointmentTime: buyForm.value.appointmentTime?.toISOString(),
      remark: buyForm.value.remark.trim() || undefined,
    })
    buyVisible.value = false
    ElMessage.success('下单成功，可与卖家沟通交易细节')
    router.push(`/orders/${id}`)
  } catch {
    // 错误提示已由拦截器处理（如商品已售 409）
  } finally {
    buySubmitting.value = false
  }
}

/* ---------- 举报 ---------- */
const reportVisible = ref(false)
const reportReason = ref('')
const reportImages = ref<string[]>([])
const reportSubmitting = ref(false)

async function onSubmitReport() {
  if (!goods.value) return
  const reason = reportReason.value.trim()
  if (!reason || reason.length > 300) {
    ElMessage.warning('请填写1~300字的举报理由')
    return
  }
  reportSubmitting.value = true
  try {
    await reportApi.create({
      targetType: '商品',
      targetId: goods.value.id,
      reason,
      evidenceImages: reportImages.value.length ? reportImages.value : undefined,
    })
    ElMessage.success('举报已提交，感谢反馈')
    reportVisible.value = false
    reportReason.value = ''
    reportImages.value = []
  } catch {
    // 重复举报（409）等提示已由拦截器处理
  } finally {
    reportSubmitting.value = false
  }
}

/* ---------- 留言区 ---------- */
const comments = ref<CommentItem[]>([])
const commentLoading = ref(false)
const commentPage = ref(1)
const commentPageSize = ref(10)
const commentTotal = ref(0)

const newComment = ref('')
const commentSubmitting = ref(false)

const replyingTo = ref<number | null>(null)
const replyingNickname = ref('')
const replyContent = ref('')
const replySubmitting = ref(false)

async function loadComments() {
  commentLoading.value = true
  try {
    const res = await commentApi.list(goodsId, { page: commentPage.value, pageSize: commentPageSize.value })
    comments.value = res.list
    commentTotal.value = res.total
  } catch {
    // 错误提示已由拦截器处理
  } finally {
    commentLoading.value = false
  }
}

async function onCreateComment() {
  const content = newComment.value.trim()
  if (!content || content.length > 500) {
    ElMessage.warning('留言内容需为1~500字')
    return
  }
  commentSubmitting.value = true
  try {
    await commentApi.create(goodsId, content)
    ElMessage.success('留言成功')
    newComment.value = ''
    commentPage.value = 1
    loadComments()
  } catch {
    // 错误提示已由拦截器处理
  } finally {
    commentSubmitting.value = false
  }
}

/** 点击"回复"：记录目标（顶层留言或某条回复的 id），展开输入框 */
function startReply(id: number, nickname?: string) {
  replyingTo.value = id
  replyingNickname.value = nickname || '匿名用户'
  replyContent.value = ''
}

function cancelReply() {
  replyingTo.value = null
  replyContent.value = ''
}

async function onSubmitReply() {
  const content = replyContent.value.trim()
  if (!replyingTo.value) return
  if (!content || content.length > 500) {
    ElMessage.warning('回复内容需为1~500字')
    return
  }
  replySubmitting.value = true
  try {
    await commentApi.reply(replyingTo.value, content)
    ElMessage.success('回复成功')
    cancelReply()
    loadComments()
  } catch {
    // 错误提示已由拦截器处理
  } finally {
    replySubmitting.value = false
  }
}

async function onDeleteComment(id: number) {
  try {
    await ElMessageBox.confirm('确定删除这条留言/回复吗？', '提示', { type: 'warning' })
  } catch {
    return
  }
  try {
    await commentApi.remove(id)
    ElMessage.success('已删除')
    loadComments()
  } catch {
    // 错误提示已由拦截器处理
  }
}

onMounted(() => {
  load()
  loadComments()
})
</script>
