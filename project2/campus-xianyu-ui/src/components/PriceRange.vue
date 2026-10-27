<template>
  <div class="flex flex-wrap items-center gap-2">
    <el-input-number
      v-model="minVal"
      :min="0"
      :precision="2"
      :controls="false"
      placeholder="最低价"
      class="!w-28"
      @change="onChange"
    />
    <span class="text-gray-400">-</span>
    <el-input-number
      v-model="maxVal"
      :min="0"
      :precision="2"
      :controls="false"
      placeholder="最高价"
      class="!w-28"
      @change="onChange"
    />
    <el-check-tag
      v-for="p in PRESETS"
      :key="p.label"
      :checked="isActive(p)"
      class="cursor-pointer"
      @change="applyPreset(p)"
    >
      {{ p.label }}
    </el-check-tag>
    <el-button v-if="min !== undefined || max !== undefined" link type="info" size="small" @click="clear">
      清空
    </el-button>
  </div>
</template>

<script setup lang="ts">
/**
 * 价格区间筛选组件（商品/求购列表筛选条用）
 * 用法：<PriceRange v-model:min="minPrice" v-model:max="maxPrice" @change="load" />
 */
import { ref, watch } from 'vue'

interface Preset {
  label: string
  min?: number
  max?: number
}

const PRESETS: Preset[] = [
  { label: '0~50', min: 0, max: 50 },
  { label: '50~100', min: 50, max: 100 },
  { label: '100~500', min: 100, max: 500 },
  { label: '500以上', min: 500, max: undefined },
]

const props = defineProps<{
  min?: number
  max?: number
}>()

const emit = defineEmits<{
  'update:min': [min: number | undefined]
  'update:max': [max: number | undefined]
  /** 区间确认（输入失焦/回车、点击快捷区间） */
  change: []
}>()

const minVal = ref<number | undefined>(props.min)
const maxVal = ref<number | undefined>(props.max)

watch(
  () => [props.min, props.max] as const,
  ([min, max]) => {
    minVal.value = min
    maxVal.value = max
  },
)

function commit(min: number | undefined, max: number | undefined) {
  // 防御：最低价高于最高价时交换
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min]
  emit('update:min', min)
  emit('update:max', max)
  emit('change')
}

function onChange() {
  commit(minVal.value ?? undefined, maxVal.value ?? undefined)
}

function applyPreset(p: Preset) {
  commit(p.min, p.max)
}

function clear() {
  commit(undefined, undefined)
}

function isActive(p: Preset): boolean {
  return props.min === p.min && props.max === p.max
}
</script>
