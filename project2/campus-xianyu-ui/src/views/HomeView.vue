<template>
  <div class="space-y-6 py-6">
    <!-- 顶部 Hero：slogan + 搜索 + 发布入口 -->
    <div class="page-card flex flex-col items-center gap-4 py-10 text-center">
      <div>
        <div class="text-2xl font-bold text-gray-800">校园版咸鱼</div>
        <div class="mt-1 text-sm text-gray-500">闲置好物，校内流转，让每一件物品都物尽其用</div>
      </div>
      <div class="flex w-full max-w-xl gap-2">
        <el-input
          v-model="keyword"
          size="large"
          placeholder="搜索闲置好物，回车快速查找"
          clearable
          @keyup.enter="onSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button size="large" type="primary" @click="onSearch">搜索</el-button>
        <el-button size="large" type="success" @click="$router.push('/publish')">发布闲置</el-button>
      </div>
    </div>

    <!-- 分类快捷入口 -->
    <div class="page-card">
      <div class="page-title">热门分类</div>
      <div v-loading="categoryLoading" class="flex flex-wrap gap-3">
        <el-check-tag
          v-for="c in categories"
          :key="c.id"
          :checked="false"
          class="cursor-pointer !px-4 !py-2"
          @change="goCategory(c)"
        >
          {{ c.name }}
        </el-check-tag>
        <span v-if="!categoryLoading && categories.length === 0" class="text-sm text-gray-400">暂无分类</span>
      </div>
    </div>

    <!-- 最新闲置 -->
    <div class="page-card">
      <div class="flex items-center justify-between">
        <div class="page-title !mb-0">最新闲置</div>
        <el-button link type="primary" @click="$router.push('/goods')">查看更多</el-button>
      </div>
      <div v-loading="goodsLoading" class="mt-4 min-h-32">
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
        <EmptyState v-else-if="!goodsLoading" description="暂无在售商品，来发布第一件闲置吧">
          <el-button type="primary" size="small" @click="$router.push('/publish')">去发布</el-button>
        </EmptyState>
      </div>
    </div>

    <!-- 求购广场入口 -->
    <div
      class="page-card flex cursor-pointer items-center justify-between bg-gradient-to-r from-orange-50 to-amber-50"
      @click="$router.push('/wants')"
    >
      <div>
        <div class="text-lg font-bold text-gray-800">求购广场</div>
        <div class="mt-1 text-sm text-gray-500">找不到想要的？发布求购，让卖家主动联系你</div>
      </div>
      <el-button type="warning" round>去逛逛</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import { categoryApi, goodsApi } from '@/api'
import type { Category, GoodsItem } from '@/api/types'
import { EmptyState } from '@/components'
import { formatPrice } from '@/utils'

const router = useRouter()

const keyword = ref('')
const categories = ref<Category[]>([])
const categoryLoading = ref(false)
const goods = ref<GoodsItem[]>([])
const goodsLoading = ref(false)

/** 关键词搜索：跳商品列表页 */
function onSearch() {
  const kw = keyword.value.trim()
  router.push({ path: '/goods', query: kw ? { keyword: kw } : {} })
}

/** 分类快捷跳转 */
function goCategory(c: Category) {
  router.push({ path: '/goods', query: { categoryId: c.id, categoryName: c.name } })
}

async function loadCategories() {
  categoryLoading.value = true
  try {
    categories.value = await categoryApi.list()
  } catch {
    // 错误提示已由拦截器处理
  } finally {
    categoryLoading.value = false
  }
}

async function loadGoods() {
  goodsLoading.value = true
  try {
    const res = await goodsApi.list({ page: 1, pageSize: 8 })
    goods.value = res.list
  } catch {
    // 错误提示已由拦截器处理
  } finally {
    goodsLoading.value = false
  }
}

onMounted(() => {
  loadCategories()
  loadGoods()
})
</script>
