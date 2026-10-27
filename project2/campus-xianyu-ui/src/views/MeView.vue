<template>
  <div class="space-y-6 py-6">
    <!-- 资料卡 -->
    <div class="page-card">
      <div class="page-title">个人中心</div>
      <div class="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <el-avatar :size="72" :src="user.profile?.avatar || undefined">
          {{ user.profile?.nickname?.charAt(0) || '我' }}
        </el-avatar>
        <div class="flex-1 space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-lg font-semibold">{{ user.profile?.nickname || '-' }}</span>
            <el-tag :type="user.isCertified ? 'success' : 'warning'" size="small">
              {{ user.isCertified ? '已实名' : '未实名' }}
            </el-tag>
          </div>
          <div class="text-sm text-gray-500">学号：{{ user.profile?.studentNo || '-' }}</div>
          <div class="text-sm text-gray-500">学院：{{ user.profile?.college || '未填写' }}</div>
          <div v-if="user.profile?.createTime" class="text-sm text-gray-400">
            注册时间：{{ formatTime(user.profile.createTime) }}
          </div>
        </div>
        <div class="flex gap-2">
          <el-button type="primary" plain @click="openEdit">编辑资料</el-button>
          <el-button plain @click="openPwd">修改密码</el-button>
        </div>
      </div>
    </div>

    <!-- 快捷入口 -->
    <div class="page-card">
      <div class="page-title">我的服务</div>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div
          v-for="entry in entries"
          :key="entry.path"
          class="cursor-pointer rounded-lg border border-gray-100 p-4 text-center transition hover:border-brand hover:shadow-sm"
          @click="router.push(entry.path)"
        >
          <el-icon :size="26" class="text-brand"><component :is="entry.icon" /></el-icon>
          <div class="mt-2 text-sm text-gray-700">{{ entry.label }}</div>
        </div>
      </div>
    </div>

    <!-- 编辑资料对话框 -->
    <el-dialog v-model="editVisible" title="编辑资料" width="480px" destroy-on-close>
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-position="top">
        <el-form-item label="头像" prop="avatar">
          <ImageUpload v-model="editAvatar" :limit="1" tip="支持 jpg/png/webp，单张不超过 5MB" />
        </el-form-item>
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="editForm.nickname" maxlength="32" show-word-limit placeholder="1~32位昵称" />
        </el-form-item>
        <el-form-item label="学院" prop="college">
          <el-input v-model="editForm.college" maxlength="64" placeholder="选填，不超过64字" clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editLoading" @click="onSaveProfile">保存</el-button>
      </template>
    </el-dialog>

    <!-- 修改密码对话框 -->
    <el-dialog v-model="pwdVisible" title="修改密码" width="480px" destroy-on-close>
      <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-position="top">
        <el-form-item label="原密码" prop="oldPassword">
          <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="请输入原密码" />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="8~32位，需同时包含字母和数字" />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="请再次输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdLoading" @click="onChangePassword">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { ChatDotRound, Goods, ShoppingCart, Stamp } from '@element-plus/icons-vue'
import { userApi } from '@/api'
import { useUserStore } from '@/stores/user'
import { ImageUpload } from '@/components'

const router = useRouter()
const user = useUserStore()

const entries = [
  { label: '我的发布', path: '/me/goods', icon: Goods },
  { label: '我的求购', path: '/me/wants', icon: ShoppingCart },
  { label: '我的留言', path: '/me/comments', icon: ChatDotRound },
  { label: '实名认证', path: '/me/certification', icon: Stamp },
]

function formatTime(t: string) {
  return new Date(t).toLocaleString('zh-CN')
}

// ---------------- 编辑资料 ----------------
const editVisible = ref(false)
const editLoading = ref(false)
const editFormRef = ref<FormInstance>()
const editForm = reactive({ nickname: '', college: '' })
const editAvatar = ref<string[]>([])

const editRules: FormRules = {
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { min: 1, max: 32, message: '昵称长度1~32位', trigger: 'blur' },
  ],
  college: [{ max: 64, message: '学院名称过长（不超过64字）', trigger: 'blur' }],
}

function openEdit() {
  editForm.nickname = user.profile?.nickname || ''
  editForm.college = user.profile?.college || ''
  editAvatar.value = user.profile?.avatar ? [user.profile.avatar] : []
  editVisible.value = true
}

async function onSaveProfile() {
  await editFormRef.value?.validate()
  editLoading.value = true
  try {
    await userApi.updateMe({
      nickname: editForm.nickname.trim(),
      college: editForm.college.trim() || undefined,
      avatar: editAvatar.value[0],
    })
    await user.fetchProfile()
    ElMessage.success('资料已更新')
    editVisible.value = false
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    editLoading.value = false
  }
}

// ---------------- 修改密码 ----------------
const pwdVisible = ref(false)
const pwdLoading = ref(false)
const pwdFormRef = ref<FormInstance>()
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

// 与后端 ChangePasswordDto 对齐：8~32位且同时包含字母和数字
const pwdRules: FormRules = {
  oldPassword: [{ required: true, message: '原密码不能为空', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    {
      pattern: /^(?=.*[A-Za-z])(?=.*\d)\S{8,32}$/,
      message: '密码需8~32位且同时包含字母和数字',
      trigger: 'blur',
    },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        if (value !== pwdForm.newPassword) callback(new Error('两次输入的新密码不一致'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
}

function openPwd() {
  pwdForm.oldPassword = ''
  pwdForm.newPassword = ''
  pwdForm.confirmPassword = ''
  pwdVisible.value = true
}

async function onChangePassword() {
  await pwdFormRef.value?.validate()
  pwdLoading.value = true
  try {
    await userApi.changePassword({
      oldPassword: pwdForm.oldPassword,
      newPassword: pwdForm.newPassword,
    })
    ElMessage.success('密码已修改，请重新登录')
    pwdVisible.value = false
    user.logout()
    router.push('/login')
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    pwdLoading.value = false
  }
}

// 进入页面刷新最新资料（实名状态等可能已变化）
onMounted(() => {
  user.fetchProfile().catch(() => undefined)
})
</script>
