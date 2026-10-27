<template>
  <div class="space-y-6 py-6">
    <!-- 筛选区 -->
    <div class="page-card">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <el-input
          v-model="query.keyword"
          placeholder="搜索商品关键词"
          clearable
          @change="onFilterChange"
          @clear="onFilterChange"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="query.categoryId" placeholder="全部分类" clearable @change="onFilterChange">
          <el-option label="全部分类" :value="undefined" />
          <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
        <el-select v-model="query.campus" placeholder="全部校区" clearable @change="onFilterChange">
          <el-option label="全部校区" :value="undefined" />
          <el-option v-for="c in CAMPUSES" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="query.condition" placeholder="全部成色" clearable @change="onFilterChange">
          <el-option label="全部成色" :value="undefined" />
          <el-option v-for="c in CONDITION_LEVELS" :key="c" :label="c" :value="c" />
        </el-select>
      </div>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
        <PriceRange v-model:min="query.minPrice" v-model:max="query.maxPrice" @change="onFilterChange" />
        <el-select v-model="query.sort" class="!w-40" @change="onFilterChange">
          <el-option label="最新优先" value="time" />
          <el-option label="价格从低到高" value="price_asc" />
          <el-option label="价格从高到低" value="price_desc" />
        </el-select>
      </div>
    </div>

    <!-- 结果区 -->
    <div class="page-card">
      <div v-loading="loading" class="min-h-32">
        <div v-if="goods.length > 0" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div
            v-for="g in goods"
            :key="g.id"
            class="cursor-pointer overflow-hidden rounded-lg border transition-shadow hover:shadow-md"
            @click="$router.push(`/goods/${g.id}`)"
          >
            <el-image v-if="g.images?.length" :src="g.images[0]" fit="cover" class="h-36 w-full" />
            <div v-else class="flex h-36 w-full items-center justify-center bg-gray-100 text-sm text-gray-400">
              暂无图片
            </div>
            <div class="space-y-1 p-2">
              <div class="truncate text-sm text-gray-800">{{ g.title }}</div>
              <div class="text-base font-bold text-red-500">{{ formatPrice(g.price) }}</div>
              <div class="flex gap-1">
                <el-tag size="small" type="info">{{ g.campus }}</el-tag>
                <el-tag size="small">{{ g.conditionLevel }}</el-tag>
              </div>
            </div>
          </div>
        </div>
        <EmptyState v-else-if="!loading" description="没有找到相关商品">
          <el-button size="small" @click="clearFilters">清除筛选</el-button>
        </EmptyState>
      </div>
      <Pagination v-model:page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[12, 24, 48]" @change="load" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import { categoryApi, goodsApi } from '@/api'
import type { Category, GoodsItem, GoodsQuery } from '@/api/types'
import { EmptyState, Pagination, PriceRange } from '@/components'
import { CAMPUSES, CONDITION_LEVELS } from '@/utils/constants'
import { formatPrice } from '@/utils'

const route = useRoute()

const categories = ref<Category[]>([])
const goods = ref<GoodsItem[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(12)
const total = ref(0)

/** 筛选条件（从路由 query 初始化 keyword/categoryId） */
const query = reactive<GoodsQuery>({
  keyword: (route.query.keyword as string) || undefined,
  categoryId: route.query.categoryId ? Number(route.query.categoryId) : undefined,
  minPrice: undefined,
  maxPrice: undefined,
  campus: undefined,
  condition: undefined,
  sort: 'time',
})

/** 任一筛选条件变化：重置页码并重新查询 */
function onFilterChange() {
  page.value = 1
  load()
}

function clearFilters() {
  query.keyword = undefined
  query.categoryId = undefined
  query.minPrice = undefined
  query.maxPrice = undefined
  query.campus = undefined
  query.condition = undefined
  query.sort = 'time'
  page.value = 1
  load()
}

async function load() {
  loading.value = true
  try {
    const res = await goodsApi.list({
      ...query,
      keyword: query.keyword?.trim() || undefined,
      page: page.value,
      pageSize: pageSize.value,
    })
    goods.value = res.list
    total.value = res.total
  } catch {
    // 错误提示已由拦截器处理
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    categories.value = await categoryApi.list()
  } catch {
    // 错误提示已由拦截器处理
  }
  load()
})
</script>
