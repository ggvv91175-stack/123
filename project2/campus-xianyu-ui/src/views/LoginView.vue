<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50">
    <el-card class="w-96">
      <template #header>
        <div class="text-center text-lg font-bold">校园版咸鱼 · 登录</div>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @keyup.enter="onSubmit">
        <el-form-item label="学号" prop="studentNo">
          <el-input v-model="form.studentNo" placeholder="请输入学号（admin 为管理员）" clearable />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-button class="w-full" type="primary" :loading="loading" @click="onSubmit">登 录</el-button>
      </el-form>

      <div class="mt-3 text-center text-sm">
        <span class="text-gray-400">还没有账号？</span>
        <router-link to="/register" class="text-brand hover:underline">立即注册</router-link>
      </div>

      <div class="mt-4 text-center text-xs text-gray-400">
        种子账号：admin/admin123（管理员）、20211231245/abc12345（已实名）、20211231246/abc12345（未实名）
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
  studentNo: [{ required: true, message: '请输入学号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function onSubmit() {
  await formRef.value?.validate()
  loading.value = true
  try {
    await user.login(form.studentNo.trim(), form.password)
    ElMessage.success('登录成功')
    router.push((route.query.redirect as string) || '/')
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    loading.value = false
  }
}
</script>
