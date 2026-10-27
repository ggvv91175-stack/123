<template>
  <div class="space-y-4">
    <!-- 筛选栏 + 新增 -->
    <el-card>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <el-form inline @submit.prevent>
          <el-form-item label="状态">
            <el-select v-model="query.status" placeholder="全部" clearable class="w-28" @change="onSearch">
              <el-option label="启用" value="启用" />
              <el-option label="停用" value="停用" />
            </el-select>
          </el-form-item>
        </el-form>
        <el-button type="primary" @click="openEdit()">新增分类</el-button>
      </div>
    </el-card>

    <!-- 分类表格 -->
    <el-card>
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="分类名称" min-width="160" />
        <el-table-column prop="sortOrder" label="排序" width="100" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === '启用' ? 'success' : 'info'">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" plain @click="onRemove(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty><EmptyState description="暂无分类" /></template>
      </el-table>
      <Pagination v-model:page="query.page" v-model:page-size="query.pageSize" :total="total" @change="load" />
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="editVisible" :title="editForm.id ? '编辑分类' : '新增分类'" width="420px" destroy-on-close>
      <el-form ref="formRef" :model="editForm" :rules="editRules" label-width="80px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="editForm.name" maxlength="32" show-word-limit placeholder="请输入分类名称" />
        </el-form-item>
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number v-model="editForm.sortOrder" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item v-if="editForm.id" label="状态">
          <el-radio-group v-model="editForm.status">
            <el-radio value="启用">启用</el-radio>
            <el-radio value="停用">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { adminApi } from '@/api'
import type { AdminCategoryQuery, Category } from '@/api/types'
import Pagination from '@/components/Pagination.vue'
import EmptyState from '@/components/EmptyState.vue'

const loading = ref(false)
const list = ref<Category[]>([])
const total = ref(0)

const query = reactive<Required<Pick<AdminCategoryQuery, 'page' | 'pageSize'>> & AdminCategoryQuery>({
  status: undefined,
  page: 1,
  pageSize: 10,
})

async function load() {
  loading.value = true
  try {
    const data = await adminApi.categories(query)
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function onSearch() {
  query.page = 1
  load()
}

// ---------------- 新增/编辑 ----------------

const formRef = ref<FormInstance>()
const editVisible = ref(false)
const submitting = ref(false)
const editForm = reactive<{ id?: number; name: string; sortOrder: number; status: '启用' | '停用' }>({
  id: undefined,
  name: '',
  sortOrder: 0,
  status: '启用',
})

const editRules: FormRules = {
  name: [
    { required: true, message: '请输入分类名称', trigger: 'blur' },
    { min: 1, max: 32, message: '长度 1~32 个字符', trigger: 'blur' },
  ],
}

function openEdit(row?: Category) {
  editForm.id = row?.id
  editForm.name = row?.name ?? ''
  editForm.sortOrder = row?.sortOrder ?? 0
  editForm.status = (row?.status as '启用' | '停用') ?? '启用'
  editVisible.value = true
}

async function onSubmit() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    const payload = { name: editForm.name.trim(), sortOrder: editForm.sortOrder }
    if (editForm.id) {
      await adminApi.updateCategory(editForm.id, { ...payload, status: editForm.status })
      ElMessage.success('已更新')
    } else {
      await adminApi.createCategory(payload)
      ElMessage.success('已新增')
    }
    editVisible.value = false
    load()
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    submitting.value = false
  }
}

// ---------------- 删除 ----------------

async function onRemove(row: Category) {
  await ElMessageBox.confirm(`确定删除分类「${row.name}」吗？被商品引用的分类无法删除。`, '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
  await adminApi.removeCategory(row.id)
  ElMessage.success('已删除')
  load()
}

onMounted(load)
</script>
