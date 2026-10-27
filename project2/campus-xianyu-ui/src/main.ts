import { createApp } from 'vue'
import type { Component } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as Icons from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import { setUnauthorizedHandler } from './api/http'
import { useUserStore } from './stores/user'
import './styles/tailwind.css'
import './styles/global.css'

const app = createApp(App)
for (const [name, comp] of Object.entries(Icons)) {
  app.component(name, comp as Component)
}

const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(ElementPlus, { locale: zhCn })

// 401 统一处理：清理登录态并跳登录页（带回跳地址）；在此处注入以避免 http 层与 store/router 循环依赖
setUnauthorizedHandler(() => {
  const store = useUserStore()
  store.logout()
  const current = router.currentRoute.value
  if (current.name !== 'login') {
    router.push({ path: '/login', query: { redirect: current.fullPath } })
  }
})

app.mount('#app')
