<template>
  <div class="space-y-4">
    <!-- 筛选栏 -->
    <el-card>
      <el-form inline @submit.prevent>
        <el-form-item label="关键词">
          <el-input
            v-model="query.keyword"
            placeholder="学号 / 昵称"
            clearable
            class="w-48"
            @keyup.enter="onSearch"
            @clear="onSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable class="w-28" @change="onSearch">
            <el-option label="正常" value="正常" />
            <el-option label="禁用" value="禁用" />
          </el-select>
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="query.role" placeholder="全部" clearable class="w-28" @change="onSearch">
            <el-option label="学生" value="student" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item label="实名">
          <el-select v-model="query.isCertified" placeholder="全部" clearable class="w-28" @change="onSearch">
            <el-option label="已实名" :value="true" />
            <el-option label="未实名" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSearch">搜索</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 用户表格 -->
    <el-card>
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column label="学号" width="140">
          <template #default="{ row }">{{ maskStudentNo(row.studentNo || row.studentNoMasked) }}</template>
        </el-table-column>
        <el-table-column prop="nickname" label="昵称" min-width="120" show-overflow-tooltip />
        <el-table-column label="角色" width="90">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'danger' : 'primary'">
              {{ row.role === 'admin' ? '管理员' : '学生' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="实名" width="90">
          <template #default="{ row }">
            <el-tag :type="row.isCertified ? 'success' : 'info'">{{ row.isCertified ? '已实名' : '未实名' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === '禁用' ? 'danger' : 'success'">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <!-- 管理员账号不允许禁用/解禁操作 -->
            <el-button
              v-if="row.role !== 'admin'"
              size="small"
              :type="row.status === '禁用' ? 'success' : 'danger'"
              plain
              @click="onToggleStatus(row)"
            >
              {{ row.status === '禁用' ? '解禁' : '禁用' }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty><EmptyState description="暂无用户" /></template>
      </el-table>
      <Pagination v-model:page="query.page" v-model:page-size="query.pageSize" :total="total" @change="load" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminApi } from '@/api'
import type { AdminUserQuery, UserProfile } from '@/api/types'
import { maskStudentNo } from '@/utils'
import Pagination from '@/components/Pagination.vue'
import EmptyState from '@/components/EmptyState.vue'

const loading = ref(false)
const list = ref<UserProfile[]>([])
const total = ref(0)

const query = reactive<Required<Pick<AdminUserQuery, 'page' | 'pageSize'>> & AdminUserQuery>({
  keyword: undefined,
  status: undefined,
  role: undefined,
  isCertified: undefined,
  page: 1,
  pageSize: 10,
})

async function load() {
  loading.value = true
  try {
    const data = await adminApi.users(query)
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

/** 禁用/解禁：禁用会吊销该用户全部登录态，二次确认 */
async function onToggleStatus(row: UserProfile) {
  const isDisable = row.status !== '禁用'
  await ElMessageBox.confirm(
    isDisable
      ? `确定禁用用户「${row.nickname}」吗？禁用后将吊销其全部登录态。`
      : `确定解禁用户「${row.nickname}」吗？`,
    isDisable ? '禁用确认' : '解禁确认',
    { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' },
  )
  await adminApi.updateUserStatus(row.id, isDisable ? 'disable' : 'enable')
  ElMessage.success(isDisable ? '已禁用' : '已解禁')
  load()
}

function formatTime(t?: string) {
  return t ? new Date(t).toLocaleString('zh-CN') : '-'
}

onMounted(load)
</script>
