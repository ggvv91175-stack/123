/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端 API 前缀，默认 /api/v1 */
  readonly VITE_API_BASE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
