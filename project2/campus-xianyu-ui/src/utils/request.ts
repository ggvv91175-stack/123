import axios from 'axios'
// 如果你后面响应拦截器需要 401 跳登录，就保留router；暂时不用可以注释/删掉这行
// import router from '../router'

export interface ApiResponse<T = unknown> {
    code: number
    message: string
    data: T
}

// 在 CloudStudio/Vite proxy 模式下使用相对路径，生产部署时可通过环境变量配置
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'

const request = axios.create({
    baseURL: API_BASE,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    },
})

// 响应拦截器示例（用到router的场景：401 跳转登录页，需要就打开注释）
// request.interceptors.response.use(
//   (res) => {
//     return res.data
//   },
//   (err) => {
//     if (err.response?.status === 401) {
//       // router.push('/login')
//     }
//     return Promise.reject(err)
//   }
// )

// ✅ 关键：导出 request，其他页面才能 import 使用，消除 TS6133 报错
export default request
