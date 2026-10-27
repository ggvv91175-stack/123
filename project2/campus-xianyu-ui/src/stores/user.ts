import { defineStore } from 'pinia'
import { authApi, userApi } from '@/api'
import { clearToken, getToken, saveToken } from '@/api/http'
import { disconnectWs } from '@/utils/ws'
import type { UserProfile } from '@/api/types'

const PROFILE_KEY = 'campus_xianyu_profile'

function loadProfile(): UserProfile | null {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null') as UserProfile | null
  } catch {
    return null
  }
}

/** 全局用户状态：登录态 + 实名状态（token/profile 持久化到 localStorage，刷新不丢） */
export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken(),
    profile: loadProfile(),
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    isAdmin: (s) => s.profile?.role === 'admin',
    isCertified: (s) => !!s.profile?.isCertified,
  },
  actions: {
    async login(studentNo: string, password: string) {
      const data = await authApi.login({ studentNo, password })
      this.token = data.token
      saveToken(data.token)
      this.setProfile(data.user)
    },
    /** 刷新个人信息（实名状态变更后调用） */
    async fetchProfile() {
      this.setProfile(await userApi.me())
    },
    setProfile(profile: UserProfile | null) {
      this.profile = profile
      if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
      else localStorage.removeItem(PROFILE_KEY)
    },
    /** 清理登录态（跳转由调用方或 401 回调处理） */
    logout() {
      this.token = ''
      this.setProfile(null)
      clearToken()
      disconnectWs()
    },
  },
})
