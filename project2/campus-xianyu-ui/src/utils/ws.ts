/**
 * WebSocket（socket.io）单例封装：
 * - 握手鉴权：auth.token 携带 JWT（与后端 ChatGateway 口径一致）；函数形式每次（重）连动态取最新 token，
 *   避免 token 刷新/吊销后重连仍持旧快照
 * - 断线自动重连（指数退避，最多 10 次）；断线/恢复/失败给用户可见提示
 * - 开发环境经 Vite 代理 /socket.io → localhost:8080（ws:true），同源连接即可
 * - 页面通过 onMessage 订阅 'message:new'；登出/401 时 disconnectWs
 */
import { io, type Socket } from 'socket.io-client'
import { ElMessage } from 'element-plus'
import { getToken } from '@/api/http'
import type { ChatMessageView } from '@/api/types'

let socket: Socket | null = null
/** 是否处于断线提示状态（避免重复弹提示） */
let disconnectNotified = false

/** 获取（或建立）全局 socket 连接；未登录返回 null */
export function connectWs(): Socket | null {
  if (!getToken()) return null
  if (socket?.connected) return socket
  if (socket) {
    // 已创建但未连接（重连中）直接复用
    return socket
  }
  socket = io('/', {
    // 函数形式：每次握手（含重连）都取最新 token
    auth: (cb) => cb({ token: getToken() }),
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  })
  // 鉴权失败（后端握手 exception）：不再重连，直接销毁
  socket.on('exception', (e: { code?: number; message?: string }) => {
    ElMessage.error(e?.message || '实时连接异常')
    disconnectWs()
  })
  // 网络断线：提示一次，等待自动重连
  socket.on('disconnect', (reason) => {
    // 服务端主动断开（鉴权失败）已由 exception 处理；客户端主动断开（登出/401）不提示
    if (reason === 'io server disconnect' || reason === 'io client disconnect') return
    if (!disconnectNotified) {
      disconnectNotified = true
      ElMessage.warning('实时连接已断开，正在重连…')
    }
  })
  // 重连成功：恢复提示
  socket.io.on('reconnect', () => {
    if (disconnectNotified) {
      disconnectNotified = false
      ElMessage.success('实时连接已恢复')
    }
  })
  // 重连次数耗尽：提示用户手动刷新
  socket.io.on('reconnect_failed', () => {
    disconnectNotified = false
    ElMessage.error('实时连接失败，请刷新页面重试')
    disconnectWs()
  })
  return socket
}

/** 断开并销毁连接（登出/401 时调用） */
export function disconnectWs(): void {
  socket?.removeAllListeners()
  socket?.disconnect()
  socket = null
  disconnectNotified = false
}

export type MessageHandler = (msg: ChatMessageView) => void

/** 订阅新消息推送；返回取消订阅函数 */
export function onMessage(handler: MessageHandler): () => void {
  const s = connectWs()
  if (!s) return () => undefined
  s.on('message:new', handler)
  return () => s.off('message:new', handler)
}

/** WS 发送消息（ack 回执）；失败时 reject Error(message) */
export function sendWs(sessionId: number, content: string): Promise<ChatMessageView> {
  return new Promise((resolve, reject) => {
    const s = connectWs()
    if (!s || !s.connected) {
      reject(new Error('实时连接未建立'))
      return
    }
    s.emit(
      'message:send',
      { sessionId, content },
      (ack: { code: number; message: string; data: ChatMessageView | null }) => {
        if (ack?.code === 0 && ack.data) resolve(ack.data)
        else reject(new Error(ack?.message || '发送失败'))
      },
    )
  })
}
