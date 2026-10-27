<template>
  <div class="space-y-6 py-6">
    <!-- 顶部操作行 -->
    <div class="page-card flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="text-lg font-semibold">求购广场</div>
        <p class="mt-1 text-sm text-gray-500">看看同学们都在求购什么，有货就去接一单吧</p>
      </div>
      <el-button type="primary" @click="$router.push('/wants/publish')">发布求购</el-button>
    </div>

    <!-- 筛选区 -->
    <div class="page-card space-y-4">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
        <el-input
          v-model="keyword"
          placeholder="搜索物品名称 / 描述"
          clearable
          @clear="onFilterChange"
        />
        <el-select v-model="campus" placeholder="校区（全部）" clearable @change="onFilterChange">
          <el-option v-for="c in CAMPUSES" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select
          v-model="expectedCondition"
          placeholder="期望成色（全部）"
          clearable
          @change="onFilterChange"
        >
          <el-option v-for="c in CONDITION_LEVELS" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="sort" placeholder="排序" @change="onFilterChange">
          <el-option label="最新发布" value="time" />
          <el-option label="预算从低到高" value="budget_asc" />
          <el-option label="预算从高到低" value="budget_desc" />
        </el-select>
      </div>
      <PriceRange v-model:min="minBudget" v-model:max="maxBudget" @change="onFilterChange" />
    </div>

    <!-- 列表 -->
    <div v-loading="loading">
      <div v-if="list.length" class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div
          v-for="item in list"
          :key="item.id"
          class="page-card cursor-pointer transition-shadow hover:shadow-md"
          @click="$router.push(`/wants/${item.id}`)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="truncate text-base font-semibold">{{ item.itemName }}</div>
              <div class="mt-1 text-lg font-bold text-brand">{{ formatPrice(item.budget) }}</div>
            </div>
            <el-tag :type="WANT_STATUS[item.status]?.type ?? 'info'" size="small" class="shrink-0">
              {{ WANT_STATUS[item.status]?.label ?? item.status }}
            </el-tag>
          </div>

          <div class="mt-2 flex flex-wrap gap-1">
            <el-tag v-if="item.expectedCondition" size="small" type="warning" effect="plain">
              期望成色：{{ item.expectedCondition }}
            </el-tag>
            <el-tag v-if="item.campus" size="small" type="success" effect="plain">
              {{ item.campus }}
            </el-tag>
          </div>

          <p v-if="item.remark" class="mt-2 truncate text-sm text-gray-500">{{ item.remark }}</p>

          <div class="mt-3 flex items-center justify-between border-t pt-3 text-xs text-gray-400">
            <div class="flex items-center gap-2">
              <el-avatar :size="24" :src="item.publisher?.avatar ?? undefined">
                {{ item.publisher?.nickname?.charAt(0) ?? '?' }}
              </el-avatar>
              <span>{{ item.publisher?.nickname ?? '匿名用户' }}</span>
            </div>
            <span>{{ formatTime(item.createTime) }}</span>
          </div>
        </div>
      </div>

      <div v-else-if="!loading" class="page-card">
        <EmptyState description="暂无求购信息">
          <el-button type="primary" @click="$router.push('/wants/publish')">去发布</el-button>
        </EmptyState>
      </div>

      <Pagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="total"
        @change="onPageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { wantApi } from '@/api'
import type { WantItem, WantQuery } from '@/api/types'
import { Pagination, PriceRange, EmptyState } from '@/components'
import { CAMPUSES, CONDITION_LEVELS, WANT_STATUS } from '@/utils/constants'
import { formatPrice } from '@/utils'

type SortType = NonNullable<WantQuery['sort']>

const keyword = ref('')
const campus = ref('')
const expectedCondition = ref('')
const sort = ref<SortType>('time')
const minBudget = ref<number>()
const maxBudget = ref<number>()

const list = ref<WantItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)

function formatTime(t: string): string {
  return new Date(t).toLocaleString('zh-CN')
}

/** 组装查询参数：空串视为未选 */
function buildQuery(): WantQuery {
  return {
    keyword: keyword.value.trim() || undefined,
    campus: campus.value || undefined,
    expectedCondition: expectedCondition.value || undefined,
    minBudget: minBudget.value,
    maxBudget: maxBudget.value,
    sort: sort.value,
    page: page.value,
    pageSize: pageSize.value,
  }
}

async function load() {
  loading.value = true
  try {
    const data = await wantApi.list(buildQuery())
    list.value = data.list
    total.value = data.total
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    loading.value = false
  }
}

/** 筛选条件变化：重置到第一页再查询 */
function onFilterChange() {
  page.value = 1
  load()
}

function onPageChange(p: number, size: number) {
  page.value = p
  pageSize.value = size
  load()
}

// 关键词输入做简单防抖，避免逐字请求
let timer: ReturnType<typeof setTimeout> | undefined
watch(keyword, () => {
  clearTimeout(timer)
  timer = setTimeout(onFilterChange, 400)
})

onMounted(load)
</script>
