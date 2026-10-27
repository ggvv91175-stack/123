<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50">
    <el-card class="w-96">
      <template #header>
        <div class="text-center text-lg font-bold">校园版咸鱼 · 注册</div>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @keyup.enter="onSubmit">
        <el-form-item label="学号" prop="studentNo">
          <el-input v-model="form.studentNo" placeholder="请输入学号（6~20位数字）" clearable />
        </el-form-item>
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" placeholder="请输入昵称（1~32位）" clearable maxlength="32" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="8~32位，须含字母和数字" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" placeholder="请再次输入密码" show-password />
        </el-form-item>
        <el-button class="w-full" type="primary" :loading="loading" @click="onSubmit">注 册</el-button>
      </el-form>

      <div class="mt-3 text-center text-sm">
        <span class="text-gray-400">已有账号？</span>
        <router-link to="/login" class="text-brand hover:underline">去登录</router-link>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { authApi } from '@/api'

const router = useRouter()

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({ studentNo: '', nickname: '', password: '', confirmPassword: '' })

/** 与后端 RegisterDto 对齐的校验规则 */
const rules: FormRules = {
  studentNo: [
    { required: true, message: '请输入学号', trigger: 'blur' },
    { pattern: /^\d{6,20}$/, message: '学号需为6~20位数字', trigger: 'blur' },
  ],
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { min: 1, max: 32, message: '昵称长度1~32位', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    {
      pattern: /^(?=.*[A-Za-z])(?=.*\d)\S{8,32}$/,
      message: '密码需8~32位且同时包含字母和数字',
      trigger: 'blur',
    },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        if (value !== form.password) callback(new Error('两次输入的密码不一致'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
}

async function onSubmit() {
  await formRef.value?.validate()
  loading.value = true
  try {
    await authApi.register({
      studentNo: form.studentNo.trim(),
      nickname: form.nickname.trim(),
      password: form.password,
    })
    ElMessage.success('注册成功，请登录')
    router.push('/login')
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    loading.value = false
  }
}
</script>
