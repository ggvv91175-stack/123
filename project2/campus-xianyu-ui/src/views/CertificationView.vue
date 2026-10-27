<template>
  <div class="space-y-6 py-6">
    <div class="page-card">
      <div class="page-title">实名认证</div>

      <div v-loading="loading">
        <!-- 已通过 -->
        <template v-if="cert && cert.status === '已通过'">
          <el-result icon="success" title="实名认证已通过" sub-title="您已完成校园实名认证，可正常发布商品与求购">
            <template #extra>
              <el-button v-if="redirect" type="primary" @click="goBack">返回原页面</el-button>
            </template>
          </el-result>
          <el-descriptions :column="1" border class="mx-auto max-w-xl">
            <el-descriptions-item label="学号">{{ cert.studentNo }}</el-descriptions-item>
            <el-descriptions-item label="学院">{{ cert.college }}</el-descriptions-item>
            <el-descriptions-item v-if="cert.reviewTime" label="通过时间">
              {{ formatTime(cert.reviewTime) }}
            </el-descriptions-item>
          </el-descriptions>
        </template>

        <!-- 待审核 -->
        <template v-else-if="cert && cert.status === '待审核'">
          <el-result icon="warning" title="审核中，请耐心等待" sub-title="认证信息已提交，管理员将在1~3个工作日内完成审核" />
          <el-descriptions :column="1" border class="mx-auto max-w-xl">
            <el-descriptions-item label="学号">{{ cert.studentNo }}</el-descriptions-item>
            <el-descriptions-item label="学院">{{ cert.college }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ formatTime(cert.createTime) }}</el-descriptions-item>
            <el-descriptions-item v-if="cert.proofImages?.length" label="证明材料">
              <el-image
                v-for="img in cert.proofImages"
                :key="img"
                :src="img"
                :preview-src-list="cert.proofImages"
                fit="cover"
                class="mr-2 h-16 w-16 rounded"
              />
            </el-descriptions-item>
          </el-descriptions>
        </template>

        <!-- 已驳回 / 未提交：表单（已驳回显示理由并回填） -->
        <template v-else>
          <el-alert
            v-if="cert && cert.status === '已驳回'"
            type="error"
            :title="`认证已被驳回：${cert.rejectReason || '未填写理由'}`"
            description="请根据驳回理由修改后重新提交"
            show-icon
            :closable="false"
            class="mb-4"
          />

          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            label-position="top"
            class="mx-auto max-w-xl"
          >
            <el-form-item label="学号" prop="studentNo">
              <el-input v-model="form.studentNo" placeholder="请输入6~20位数字学号" maxlength="20" />
            </el-form-item>
            <el-form-item label="学院" prop="college">
              <el-input v-model="form.college" placeholder="请输入学院名称（1~64字）" maxlength="64" />
            </el-form-item>
            <el-form-item label="证明材料（校园卡/学生证照片，1~3张）" prop="proofImages">
              <ImageUpload v-model="form.proofImages" :limit="3" />
            </el-form-item>
            <el-button type="primary" :loading="submitting" class="w-full" @click="onSubmit">
              {{ cert && cert.status === '已驳回' ? '重新提交认证' : '提交认证' }}
            </el-button>
          </el-form>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { userApi } from '@/api'
import type { CertificationInfo } from '@/api/types'
import { useUserStore } from '@/stores/user'
import { ImageUpload } from '@/components'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

const loading = ref(false)
const submitting = ref(false)
const cert = ref<CertificationInfo | null>(null)
const redirect = (route.query.redirect as string) || ''

const formRef = ref<FormInstance>()
const form = reactive({
  studentNo: '',
  college: '',
  proofImages: [] as string[],
})

const rules: FormRules = {
  studentNo: [
    { required: true, message: '请输入学号', trigger: 'blur' },
    { pattern: /^\d{6,20}$/, message: '学号需为6~20位数字', trigger: 'blur' },
  ],
  college: [
    { required: true, message: '请输入学院', trigger: 'blur' },
    { min: 1, max: 64, message: '学院名称1~64位', trigger: 'blur' },
  ],
  proofImages: [
    {
      validator: (_rule, value: string[], callback) => {
        if (!value || value.length < 1) callback(new Error('请至少上传1张证明材料'))
        else callback()
      },
      trigger: 'change',
    },
  ],
}

function formatTime(t: string) {
  return new Date(t).toLocaleString('zh-CN')
}

async function load() {
  loading.value = true
  try {
    cert.value = await userApi.getCertification()
    if (cert.value && cert.value.status === '已通过') {
      // 同步全局实名状态
      await user.fetchProfile()
      if (redirect) {
        ElMessageBox.confirm('实名认证已通过，是否返回原页面继续操作？', '认证成功', {
          confirmButtonText: '返回原页面',
          cancelButtonText: '留在本页',
          type: 'success',
        })
          .then(() => router.push(redirect))
          .catch(() => undefined)
      }
    } else if (cert.value) {
      // 待审核/已驳回时回填已提交信息
      form.studentNo = cert.value.studentNo
      form.college = cert.value.college
      form.proofImages = cert.value.proofImages ? [...cert.value.proofImages] : []
    } else {
      // 未提交：默认回填账号学号
      form.studentNo = user.profile?.studentNo || ''
    }
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    loading.value = false
  }
}

async function onSubmit() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    await userApi.submitCertification({
      studentNo: form.studentNo.trim(),
      college: form.college.trim(),
      proofImages: form.proofImages,
    })
    ElMessage.success('已提交，等待审核')
    await load()
  } catch {
    // 409 重复提交等错误提示已由响应拦截器统一处理
  } finally {
    submitting.value = false
  }
}

function goBack() {
  router.push(redirect)
}

onMounted(load)
</script>
