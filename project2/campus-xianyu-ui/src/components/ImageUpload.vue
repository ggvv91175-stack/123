<template>
  <div>
    <el-upload
      v-model:file-list="fileList"
      list-type="picture-card"
      :limit="limit"
      :http-request="doUpload"
      :before-upload="beforeUpload"
      :on-remove="onRemove"
      :on-preview="onPreview"
      accept=".jpg,.jpeg,.png,.webp"
    >
      <el-icon><Plus /></el-icon>
    </el-upload>
    <div v-if="tip" class="mt-1 text-xs text-gray-400">{{ tip }}</div>
    <el-image-viewer v-if="previewUrl" :url-list="[previewUrl]" @close="previewUrl = ''" />
  </div>
</template>

<script setup lang="ts">
/**
 * 图片上传组件（封装 el-upload picture-card，直传后端 POST /files/upload）
 * 用法：<ImageUpload v-model="images" :limit="5" />
 * modelValue 为已上传图片的 url 数组
 */
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { UploadFile, UploadFiles, UploadRequestOptions } from 'element-plus'
import { filesApi } from '@/api'

/** el-upload onError 的错误类型（UploadAjaxError 未从包根导出，用参数推导） */
type UploadError = Parameters<UploadRequestOptions['onError']>[0]

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    /** 最大图片数量 */
    limit?: number
    /** 提示文案 */
    tip?: string
  }>(),
  { limit: 5, tip: '支持 jpg/png/webp，单张不超过 5MB' },
)

const emit = defineEmits<{
  'update:modelValue': [urls: string[]]
}>()

const fileList = ref<Array<{ name: string; url: string }>>([])
const previewUrl = ref('')

// 外部 modelValue 变化（如表单重置）时同步回显
watch(
  () => props.modelValue,
  (urls) => {
    fileList.value = urls.map((url, i) => ({ name: `image-${i + 1}`, url }))
  },
  { immediate: true },
)

/** 上传前校验（与后端白名单一致） */
function beforeUpload(file: File): boolean {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    ElMessage.error('仅支持 jpg/jpeg/png/webp 图片')
    return false
  }
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('图片不能超过 5MB')
    return false
  }
  return true
}

async function doUpload(options: UploadRequestOptions) {
  try {
    const { url } = await filesApi.upload(options.file)
    emit('update:modelValue', [...props.modelValue, url])
    options.onSuccess(url)
  } catch (err) {
    options.onError(err as UploadError)
  }
}

function onRemove(_file: UploadFile, files: UploadFiles) {
  emit(
    'update:modelValue',
    files.map((f) => f.url).filter((u): u is string => !!u),
  )
}

function onPreview(file: UploadFile) {
  previewUrl.value = file.url ?? ''
}
</script>
