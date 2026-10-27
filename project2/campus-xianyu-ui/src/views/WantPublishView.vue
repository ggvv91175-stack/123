<template>
  <div class="space-y-6 py-6">
    <div class="page-card mx-auto max-w-2xl">
      <div class="page-title">{{ isEdit ? '编辑求购' : '发布求购' }}</div>

      <el-form
        ref="formRef"
        v-loading="detailLoading"
        :model="form"
        :rules="rules"
        label-position="top"
      >
        <el-form-item label="物品名称" prop="itemName">
          <el-input v-model="form.itemName" maxlength="50" placeholder="想要求购什么？（50字以内）" clearable />
        </el-form-item>

        <el-form-item label="预算（元）" prop="budget">
          <el-input-number
            v-model="form.budget"
            :min="0.01"
            :max="999999.99"
            :precision="2"
            :controls="false"
            placeholder="0.01 ~ 999999.99"
            class="!w-56"
          />
        </el-form-item>

        <el-form-item label="期望成色（可选）" prop="expectedCondition">
          <el-select v-model="form.expectedCondition" placeholder="不限" clearable class="!w-56">
            <el-option v-for="c in CONDITION_LEVELS" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>

        <el-form-item label="校区（可选）" prop="campus">
          <el-select v-model="form.campus" placeholder="不限" clearable class="!w-56">
            <el-option v-for="c in CAMPUSES" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>

        <el-form-item label="描述 / 备注（可选）" prop="remark">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="5"
            maxlength="500"
            show-word-limit
            placeholder="补充说明，如期望交易地点、对物品的具体要求等（500字以内）"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="onSubmit">
            {{ isEdit ? '保存修改' : '发布求购' }}
          </el-button>
          <el-button @click="onCancel">取消</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { wantApi } from '@/api'
import type { WantPayload } from '@/api/types'
import { CAMPUSES, CONDITION_LEVELS } from '@/utils/constants'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

// 编辑模式：query 携带 id
const editId = computed(() => Number(route.query.id) || 0)
const isEdit = computed(() => editId.value > 0)

const formRef = ref<FormInstance>()
const detailLoading = ref(false)
const submitting = ref(false)

const form = reactive({
  itemName: '',
  budget: undefined as number | undefined,
  expectedCondition: '',
  campus: '',
  remark: '',
})

const rules: FormRules = {
  itemName: [
    { required: true, message: '请输入物品名称', trigger: 'blur' },
    { min: 1, max: 50, message: '物品名称长度须为1~50字符', trigger: 'blur' },
  ],
  budget: [
    { required: true, message: '请输入预算', trigger: 'blur' },
    {
      type: 'number',
      min: 0.01,
      max: 999999.99,
      message: '预算须在0.01~999999.99元之间',
      trigger: 'blur',
    },
  ],
  remark: [{ max: 500, message: '描述长度须为0~500字符', trigger: 'blur' }],
}

/** 编辑模式回填（后端仅允许待接单状态编辑） */
async function loadDetail() {
  detailLoading.value = true
  try {
    const data = await wantApi.detail(editId.value)
    if (data.status !== '待接单') {
      ElMessage.warning('仅待接单状态的求购可以编辑')
      router.replace(`/wants/${editId.value}`)
      return
    }
    form.itemName = data.itemName
    form.budget = data.budget
    form.expectedCondition = data.expectedCondition ?? ''
    form.campus = data.campus ?? ''
    form.remark = data.remark ?? ''
  } catch {
    // 错误提示已由拦截器处理，返回求购广场
    router.replace('/wants')
  } finally {
    detailLoading.value = false
  }
}

async function onSubmit() {
  await formRef.value?.validate()
  const payload: WantPayload = {
    itemName: form.itemName.trim(),
    budget: form.budget as number,
    expectedCondition: form.expectedCondition || undefined,
    campus: form.campus || undefined,
    remark: form.remark.trim() || undefined,
  }
  submitting.value = true
  try {
    if (isEdit.value) {
      await wantApi.update(editId.value, payload)
      ElMessage.success('已保存')
    } else {
      await wantApi.create(payload)
      ElMessage.success('发布成功')
    }
    router.push('/me/wants')
  } catch {
    // 错误提示已由拦截器处理
  } finally {
    submitting.value = false
  }
}

function onCancel() {
  router.back()
}

onMounted(async () => {
  // 实名兜底（路由守卫已拦截，这里防止认证状态被撤销等边界情况）
  if (!user.isCertified) {
    try {
      await ElMessageBox.confirm('发布求购需要先完成实名认证', '提示', {
        confirmButtonText: '去认证',
        cancelButtonText: '返回',
      })
      router.replace('/me/certification')
    } catch {
      router.back()
    }
    return
  }
  if (isEdit.value) await loadDetail()
})
</script>
