import axios from 'axios'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiResponse } from './types'

const TOKEN_KEY = 'campus_xianyu_token'

export const getToken = (): string => localStorage.getItem(TOKEN_KEY) ?? ''
export const saveToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY)

/** 401 处理回调（在 main.ts 注入：清理登录态并跳登录页，避免 http 层与 store/router 循环依赖） */
let onUnauthorized: () => void = () => undefined
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn
}

/** Mock 已移除（阶段11起全部对接真实后端） */
const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api/v1',
  timeout: 15000,
})

// 请求拦截：携带 JWT
instance.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 响应拦截：统一解包 {code,message,data}；业务错误与 HTTP 错误统一提示
instance.interceptors.response.use(
  (resp: AxiosResponse<ApiResponse<unknown>>) => {
    const body = resp.data
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) return body.data as never
      ElMessage.error(body.message || '请求失败')
      return Promise.reject(new Error(body.message || '请求失败'))
    }
    return resp.data as never
  },
  (error) => {
    const status = error.response?.status as number | undefined
    const msg = (error.response?.data as ApiResponse<unknown> | undefined)?.message
    switch (status) {
      case 401:
        ElMessage.error(msg || '登录已失效，请重新登录')
        onUnauthorized()
        break
      case 403:
        ElMessage.error(msg || '没有权限执行该操作')
        break
      case 404:
        ElMessage.error(msg || '请求的资源不存在')
        break
      case 409:
        ElMessage.error(msg || '操作冲突，请刷新后重试')
        break
      default:
        ElMessage.error(msg || '网络异常，请稍后重试')
    }
    return Promise.reject(error)
  },
)

/** 统一请求入口（响应已解包为 data） */
export function request<T>(config: AxiosRequestConfig): Promise<T> {
  return instance(config) as unknown as Promise<T>
}

export const get = <T>(url: string, params?: Record<string, unknown>): Promise<T> =>
  request<T>({ url, method: 'GET', params })

export const post = <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
  request<T>({ ...config, url, method: 'POST', data })

export const put = <T>(url: string, data?: unknown): Promise<T> =>
  request<T>({ url, method: 'PUT', data })

export const patch = <T>(url: string, data?: unknown): Promise<T> =>
  request<T>({ url, method: 'PATCH', data })

export const del = <T>(url: string): Promise<T> => request<T>({ url, method: 'DELETE' })
