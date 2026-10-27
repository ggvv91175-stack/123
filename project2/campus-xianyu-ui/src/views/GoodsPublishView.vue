<template>
  <div class="space-y-6 py-6">
    <div class="page-card mx-auto max-w-2xl">
      <div class="page-title">{{ isEdit ? '编辑商品' : '发布闲置' }}</div>
      <el-alert
        v-if="isEdit"
        type="warning"
        :closable="false"
        show-icon
        title="编辑后商品需重新进入审核"
        class="mb-4"
      />

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" v-loading="detailLoading">
        <el-form-item label="商品标题" prop="title">
          <el-input v-model="form.title" maxlength="50" show-word-limit placeholder="一句话描述你的闲置（1~50字）" />
        </el-form-item>

        <el-form-item label="价格（元）" prop="price">
          <el-input-number v-model="form.price" :min="0.01" :max="999999.99" :precision="2" :controls="false" placeholder="0.01 ~ 999999.99" class="!w-48" />
        </el-form-item>

        <el-form-item label="分类" prop="categoryId">
          <el-select v-model="form.categoryId" placeholder="请选择分类" class="w-full">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="成色" prop="conditionLevel">
          <el-radio-group v-model="form.conditionLevel">
            <el-radio v-for="c in CONDITION_LEVELS" :key="c" :value="c">{{ c }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="校区" prop="campus">
          <el-select v-model="form.campus" placeholder="请选择校区" class="w-full">
            <el-option v-for="c in CAMPUSES" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>

        <el-form-item label="交易方式" prop="tradeMethod">
          <el-radio-group v-model="form.tradeMethod">
            <el-radio v-for="t in TRADE_METHODS" :key="t" :value="t">{{ t }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="商品描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="6"
            maxlength="5000"
            show-word-limit
            placeholder="详细描述商品情况、入手渠道、瑕疵等（1~5000字）"
          />
        </el-form-item>

        <el-form-item label="商品图片（可选，最多9张）">
          <ImageUpload v-model="form.images" :limit="9" />
        </el-form-item>

        <el-button class="w-full" type="primary" size="large" :loading="submitting" @click="onSubmit">
          {{ isEdit ? '保存修改' : '发布商品' }}
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { categoryApi, goodsApi } from '@/api'
import type { Category } from '@/api/types'
import { ImageUpload } from '@/components'
import { useUserStore } from '@/stores/user'
import { CAMPUSES, CONDITION_LEVELS, TRADE_METHODS } from '@/utils/constants'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

/** 路由带 id 即编辑模式 */
const goodsId = route.params.id ? Number(route.params.id) : null
const isEdit = computed(() => goodsId !== null)

const formRef = ref<FormInstance>()
const categories = ref<Category[]>([])
const detailLoading = ref(false)
const submitting = ref(false)

const form = reactive({
  title: '',
  price: undefined as number | undefined,
  categoryId: undefined as number | undefined,
  conditionLevel: '',
  campus: '',
  tradeMethod: '',
  description: '',
  images: [] as string[],
})

/** 校验规则与后端 GoodsPayload 对齐 */
const rules: FormRules = {
  title: [
    { required: true, message: '请输入商品标题', trigger: 'blur' },
    { min: 1, max: 50, message: '标题长度1~50字', trigger: 'blur' },
  ],
  price: [
    { required: true, message: '请输入价格', trigger: 'blur' },
    {
      validator: (_rule, value: number | undefined, callback) => {
        if (value === undefined || value === null) return callback(new Error('请输入价格'))
        if (value < 0.01 || value > 999999.99) return callback(new Error('价格需在0.01~999999.99之间'))
        callback()
      },
      trigger: 'blur',
    },
  ],
  categoryId: [{ required: true, message: '请选择分类', trigger: 'change' }],
  conditionLevel: [{ required: true, message: '请选择成色', trigger: 'change' }],
  campus: [{ required: true, message: '请选择校区', trigger: 'change' }],
  tradeMethod: [{ required: true, message: '请选择交易方式', trigger: 'change' }],
  description: [
    { required: true, message: '请输入商品描述', trigger: 'blur' },
    { min: 1, max: 5000, message: '描述长度1~5000字', trigger: 'blur' },
  ],
}

async function onSubmit() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    const payload = {
      title: form.title.trim(),
      price: form.price!,
      categoryId: form.categoryId!,
      conditionLevel: form.conditionLevel,
      campus: form.campus,
      tradeMethod: form.tradeMethod,
      description: form.description.trim(),
      images: form.images.length ? form.images : undefined,
    }
    if (isEdit.value && goodsId !== null) {
      await goodsApi.update(goodsId, payload)
      ElMessage.success('已保存，重新进入审核')
    } else {
      await goodsApi.create(payload)
      ElMessage.success('发布成功，等待审核')
    }
    router.push('/me/goods')
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    submitting.value = false
  }
}

/** 编辑模式：加载详情回填表单 */
async function loadDetail() {
  if (goodsId === null) return
  detailLoading.value = true
  try {
    const g = await goodsApi.detail(goodsId)
    form.title = g.title
    form.price = g.price
    form.categoryId = g.categoryId
    form.conditionLevel = g.conditionLevel
    form.campus = g.campus
    form.tradeMethod = g.tradeMethod
    form.description = g.description
    form.images = g.images ?? []
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    detailLoading.value = false
  }
}

onMounted(async () => {
  // 实名兜底（路由守卫已拦一层，这里双保险）
  if (!user.isCertified) {
    try {
      await ElMessageBox.confirm('发布商品需要先完成实名认证', '提示', { type: 'warning' })
      router.push('/me/certification')
    } catch {
      router.back()
    }
    return
  }
  try {
    categories.value = await categoryApi.list()
  } catch {
    // 错误提示已由响应拦截器统一处理
  }
  loadDetail()
})
</script>
