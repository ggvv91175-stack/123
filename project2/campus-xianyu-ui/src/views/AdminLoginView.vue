<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-800">
    <el-card class="w-96">
      <template #header>
        <div class="text-center text-lg font-bold">校园咸鱼 · 管理员登录</div>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @keyup.enter="onSubmit">
        <el-form-item label="账号" prop="studentNo">
          <el-input v-model="form.studentNo" placeholder="请输入管理员账号" clearable />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-button class="w-full" type="primary" :loading="loading" @click="onSubmit">登 录</el-button>
      </el-form>

      <div class="mt-4 text-center">
        <router-link to="/login" class="text-sm text-gray-400 hover:text-brand">返回用户登录</router-link>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({ studentNo: '', password: '' })

const rules: FormRules = {
  studentNo: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function onSubmit() {
  await formRef.value?.validate()
  loading.value = true
  try {
    await user.login(form.studentNo.trim(), form.password)
    // 仅管理员可进入后台，非管理员登录后立即清理登录态
    if (!user.isAdmin) {
      user.logout()
      ElMessage.error('该账号不是管理员')
      return
    }
    ElMessage.success('登录成功')
    router.push((route.query.redirect as string) || '/admin')
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    loading.value = false
  }
}
</script>
