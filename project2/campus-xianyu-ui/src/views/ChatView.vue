<template>
  <div class="py-6">
    <!-- 整体卡片：填满视口剩余空间，内部左右分栏 -->
    <div class="page-card flex h-[calc(100vh-14rem)] min-h-[420px] !p-0 overflow-hidden">
      <!-- 会话列表：PC 固定左栏；移动端仅在无 sessionId 时显示 -->
      <aside
        class="w-full flex-col border-gray-200 md:flex md:w-80 md:border-r"
        :class="sessionId ? 'hidden' : 'flex'"
      >
        <div class="border-b px-4 py-3 text-base font-semibold text-gray-800">私聊消息</div>
        <div v-loading="sessionsLoading" class="flex-1 overflow-y-auto">
          <template v-if="sessions.length > 0">
            <div
              v-for="s in sessions"
              :key="s.id"
              class="flex cursor-pointer gap-3 border-b px-4 py-3 hover:bg-gray-50"
              :class="{ 'bg-gray-100': s.id === sessionId }"
              @click="router.push(`/chat/${s.id}`)"
            >
              <el-badge :value="s.unreadCount" :hidden="s.unreadCount <= 0" :max="99">
                <el-avatar :size="44" :src="s.peer?.avatar || undefined">
                  {{ s.peer?.nickname?.slice(0, 1) }}
                </el-avatar>
              </el-badge>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between">
                  <span class="truncate text-sm font-medium text-gray-800">
                    {{ s.peer?.nickname || '匿名用户' }}
                  </span>
                  <span class="ml-2 shrink-0 text-xs text-gray-400">
                    {{ formatSessionTime(s.lastMessageTime || s.createTime) }}
                  </span>
                </div>
                <div class="mt-0.5 truncate text-xs text-gray-500">
                  {{ s.lastMessage?.content || '暂无消息' }}
                </div>
                <div v-if="s.goods || s.want" class="mt-0.5 truncate text-xs text-gray-400">
                  {{ s.goods ? `商品：${s.goods.title}` : `求购：${s.want!.itemName}` }}
                </div>
              </div>
            </div>
          </template>
          <EmptyState v-else-if="!sessionsLoading" description="暂无私聊会话" :image-size="100" />
        </div>
      </aside>

      <!-- 聊天窗口：PC 右栏；移动端仅在有 sessionId 时显示 -->
      <section
        class="min-w-0 flex-1 flex-col md:flex"
        :class="sessionId ? 'flex' : 'hidden'"
      >
        <template v-if="sessionId">
          <!-- 会话无效 -->
          <div v-if="sessionInvalid" class="flex flex-1 items-center justify-center">
            <EmptyState description="会话不存在">
              <el-button type="primary" size="small" @click="router.push('/chat')">返回列表</el-button>
            </EmptyState>
          </div>

          <template v-else>
            <!-- 头部：返回（移动端）+ 对方信息 -->
            <div class="flex items-center gap-3 border-b px-4 py-3">
              <el-icon class="cursor-pointer text-lg text-gray-500 md:hidden" @click="router.push('/chat')">
                <ArrowLeft />
              </el-icon>
              <el-avatar :size="36" :src="currentSession?.peer?.avatar || undefined">
                {{ currentSession?.peer?.nickname?.slice(0, 1) }}
              </el-avatar>
              <span class="truncate text-sm font-medium text-gray-800">
                {{ currentSession?.peer?.nickname || '私聊会话' }}
              </span>
            </div>

            <!-- 关联商品/求购摘要卡 -->
            <div
              v-if="currentSession?.goods"
              class="mx-4 mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-2 text-sm hover:border-brand"
              @click="router.push(`/goods/${currentSession.goods!.id}`)"
            >
              <span class="truncate text-gray-700">商品：{{ currentSession.goods.title }}</span>
              <span class="shrink-0 font-medium text-red-500">{{ formatPrice(currentSession.goods.price) }}</span>
            </div>
            <div
              v-else-if="currentSession?.want"
              class="mx-4 mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-2 text-sm hover:border-brand"
              @click="router.push(`/wants/${currentSession.want!.id}`)"
            >
              <span class="truncate text-gray-700">求购：{{ currentSession.want.itemName }}</span>
              <span class="shrink-0 font-medium text-red-500">预算 {{ formatPrice(currentSession.want.budget) }}</span>
            </div>

            <!-- 消息区 -->
            <div ref="msgBoxRef" v-loading="historyLoading" class="flex-1 overflow-y-auto px-4 py-3">
              <div v-if="hasMore" class="mb-2 text-center">
                <el-button text type="primary" size="small" :loading="loadingMore" @click="loadMore">
                  加载更早消息
                </el-button>
              </div>
              <template v-if="messages.length > 0">
                <div
                  v-for="m in messages"
                  :key="m.id"
                  class="mb-3 flex"
                  :class="m.senderId === myId ? 'justify-end' : 'justify-start'"
                >
                  <div class="max-w-[75%]">
                    <div
                      class="rounded-lg px-3 py-2 text-sm leading-6"
                      :class="m.senderId === myId ? 'bg-brand text-white' : 'bg-gray-100 text-gray-800'"
                    >
                      <div class="whitespace-pre-wrap break-all">{{ m.content }}</div>
                    </div>
                    <div
                      class="mt-0.5 text-xs text-gray-400"
                      :class="m.senderId === myId ? 'text-right' : ''"
                    >
                      {{ formatMsgTime(m.createTime) }}
                      <template v-if="m.senderId === myId"> · {{ m.isRead ? '已读' : '未读' }}</template>
                    </div>
                  </div>
                </div>
              </template>
              <EmptyState
                v-else-if="!historyLoading"
                description="暂无消息，打个招呼吧"
                :image-size="100"
              />
            </div>

            <!-- 输入区 -->
            <div class="border-t p-3">
              <el-input
                v-model="input"
                type="textarea"
                :autosize="{ minRows: 1, maxRows: 4 }"
                maxlength="2000"
                placeholder="输入消息，回车发送（Shift+回车换行）"
                @keyup.enter.exact.prevent="onSend"
              />
              <div class="mt-2 text-right">
                <el-button
                  type="primary"
                  :loading="sending"
                  :disabled="!input.trim()"
                  @click="onSend"
                >
                  发送
                </el-button>
              </div>
            </div>
          </template>
        </template>

        <!-- PC 无 sessionId：占位提示 -->
        <div v-else class="flex flex-1 items-center justify-center">
          <EmptyState description="选择一个会话开始聊天" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { chatApi } from '@/api'
import type { ChatMessageView, ChatSessionView } from '@/api/types'
import { EmptyState } from '@/components'
import { useUserStore } from '@/stores/user'
import { connectWs, onMessage, sendWs } from '@/utils/ws'
import { formatPrice } from '@/utils'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

const myId = computed(() => user.profile?.id)

/** 当前会话ID（无 sessionId 参数时为 null，即会话列表视角） */
const sessionId = computed(() => {
  const n = Number(route.params.sessionId)
  return Number.isFinite(n) && n > 0 ? n : null
})

/* ---------- 会话列表 ---------- */
const sessions = ref<ChatSessionView[]>([])
const sessionsLoading = ref(false)

const currentSession = computed(() => sessions.value.find((s) => s.id === sessionId.value) || null)

async function loadSessions() {
  sessionsLoading.value = true
  try {
    const res = await chatApi.mySessions({ page: 1, pageSize: 50 })
    sessions.value = res.list
  } catch {
    // 错误提示已由拦截器处理
  } finally {
    sessionsLoading.value = false
  }
}

/* ---------- 聊天窗口 ---------- */
const messages = ref<ChatMessageView[]>([])
const historyLoading = ref(false)
const loadingMore = ref(false)
const historyPage = ref(1)
const historyTotal = ref(0)
const sessionInvalid = ref(false)
const msgBoxRef = ref<HTMLElement>()

const hasMore = computed(() => messages.value.length < historyTotal.value)

/** 拉取历史（倒序返回，reverse 后按时间正序渲染）；拉取即把对方消息标记已读 */
async function loadHistory(id: number) {
  historyLoading.value = true
  sessionInvalid.value = false
  try {
    const res = await chatApi.history(id, { page: 1, pageSize: 50 })
    messages.value = res.list.slice().reverse()
    historyPage.value = 1
    historyTotal.value = res.total
    // 进入会话后本地未读清零
    const s = sessions.value.find((x) => x.id === id)
    if (s) s.unreadCount = 0
    scrollToBottom()
  } catch {
    // 403/404：会话不存在或无权限
    sessionInvalid.value = true
  } finally {
    historyLoading.value = false
  }
}

/** 加载更早消息：prepend 并保持滚动位置不跳动 */
async function loadMore() {
  if (!sessionId.value || loadingMore.value) return
  loadingMore.value = true
  const box = msgBoxRef.value
  const prevHeight = box?.scrollHeight ?? 0
  const prevTop = box?.scrollTop ?? 0
  try {
    const res = await chatApi.history(sessionId.value, { page: historyPage.value + 1, pageSize: 50 })
    historyPage.value = res.page
    historyTotal.value = res.total
    messages.value = [...res.list.slice().reverse(), ...messages.value]
    await nextTick()
    if (box) box.scrollTop = box.scrollHeight - prevHeight + prevTop
  } catch {
    // 错误提示已由拦截器处理
  } finally {
    loadingMore.value = false
  }
}

function scrollToBottom() {
  nextTick(() => {
    const box = msgBoxRef.value
    if (box) box.scrollTop = box.scrollHeight
  })
}

/* ---------- 发送 ---------- */
const input = ref('')
const sending = ref(false)

async function onSend() {
  const id = sessionId.value
  const content = input.value.trim()
  if (!id || !content || content.length > 2000 || sending.value) return
  sending.value = true
  try {
    // 优先 WS（ack 回执）；连接未建立时降级 REST
    const socket = connectWs()
    const msg = socket?.connected
      ? await sendWs(id, content)
      : await chatApi.send(id, content)
    if (!messages.value.some((m) => m.id === msg.id)) messages.value.push(msg)
    input.value = ''
    scrollToBottom()
    updateSessionLastMessage(msg)
  } catch {
    // 错误提示已由拦截器处理
  } finally {
    sending.value = false
  }
}

/** 发送成功后同步会话列表的最后一条消息并置顶 */
function updateSessionLastMessage(msg: ChatMessageView) {
  const idx = sessions.value.findIndex((s) => s.id === msg.sessionId)
  if (idx < 0) return
  const s = sessions.value[idx]
  s.lastMessage = { senderId: msg.senderId, content: msg.content, msgType: msg.msgType, createTime: msg.createTime }
  s.lastMessageTime = msg.createTime
  sessions.value.splice(idx, 1)
  sessions.value.unshift(s)
}

/* ---------- WebSocket 实时 ---------- */
let offMessage: (() => void) | null = null

async function onWsMessage(msg: ChatMessageView) {
  // 会话列表：命中则更新摘要/未读并置顶，否则整体重拉
  const idx = sessions.value.findIndex((s) => s.id === msg.sessionId)
  if (idx >= 0) {
    const s = sessions.value[idx]
    s.lastMessage = { senderId: msg.senderId, content: msg.content, msgType: msg.msgType, createTime: msg.createTime }
    s.lastMessageTime = msg.createTime
    if (msg.senderId !== myId.value && msg.sessionId !== sessionId.value) s.unreadCount += 1
    sessions.value.splice(idx, 1)
    sessions.value.unshift(s)
  } else {
    loadSessions()
  }

  // 当前打开的会话：对方消息追加 + 触发已读标记
  if (msg.sessionId === sessionId.value) {
    if (!messages.value.some((m) => m.id === msg.id)) {
      messages.value.push(msg)
      scrollToBottom()
    }
    if (msg.senderId !== myId.value) {
      try {
        // 重拉第一页（服务端会同步把对方消息标记已读，并刷新本人消息已读态）
        const res = await chatApi.history(msg.sessionId, { page: 1, pageSize: 1 })
        const latest = res.list[0]
        const local = latest && messages.value.find((m) => m.id === latest.id)
        if (local && latest) local.isRead = latest.isRead
        const s = sessions.value.find((x) => x.id === msg.sessionId)
        if (s) s.unreadCount = 0
      } catch {
        // 静默失败，不影响聊天主流程
      }
    }
  }
}

/* ---------- 路由切换 ---------- */
watch(
  sessionId,
  (id) => {
    messages.value = []
    historyTotal.value = 0
    historyPage.value = 1
    input.value = ''
    sessionInvalid.value = false
    if (id) loadHistory(id)
  },
  { immediate: true },
)

/* ---------- 时间格式化 ---------- */
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}

/** 会话列表时间：今天显示 HH:mm，否则 MM-DD */
function formatSessionTime(t?: string | null) {
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  if (isSameDay(d, now)) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 消息气泡时间：今天 HH:mm，否则 MM-DD HH:mm */
function formatMsgTime(t?: string) {
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (isSameDay(d, new Date())) return hm
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`
}

onMounted(() => {
  loadSessions()
  connectWs()
  offMessage = onMessage(onWsMessage)
})

onUnmounted(() => {
  offMessage?.()
})
</script>
