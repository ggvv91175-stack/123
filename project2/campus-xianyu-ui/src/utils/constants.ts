/**
 * 字典常量：与后端枚举保持一致
 * 来源：server/src/modules/goods/entities/goods.entity.ts、report/order 实体状态常量
 */

export const CAMPUSES = ['东区', '西区', '南区', '北区'] as const

export const CONDITION_LEVELS = ['全新', '几乎全新', '轻微使用', '明显使用痕迹'] as const

export const TRADE_METHODS = ['当面交易', '宿舍自提', '校内其他'] as const

type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'

/** 商品状态 → el-tag 类型 */
export const GOODS_STATUS: Record<string, { label: string; type: TagType }> = {
  待审核: { label: '待审核', type: 'warning' },
  已驳回: { label: '已驳回', type: 'danger' },
  在售: { label: '在售', type: 'success' },
  已下架: { label: '已下架', type: 'info' },
  已售出: { label: '已售出', type: 'primary' },
  违规下架: { label: '违规下架', type: 'danger' },
}

/** 求购状态 */
export const WANT_STATUS: Record<string, { label: string; type: TagType }> = {
  待接单: { label: '待接单', type: 'warning' },
  已接单: { label: '已接单', type: 'success' },
  已关闭: { label: '已关闭', type: 'info' },
}

/** 订单状态（状态机：待沟通→待交易→已完成） */
export const ORDER_STATUS: Record<string, { label: string; type: TagType }> = {
  待沟通: { label: '待沟通', type: 'warning' },
  待交易: { label: '待交易', type: 'primary' },
  已完成: { label: '已完成', type: 'success' },
  已取消: { label: '已取消', type: 'info' },
}

/** 举报状态与处理动作 */
export const REPORT_STATUS: Record<string, { label: string; type: TagType }> = {
  待处理: { label: '待处理', type: 'warning' },
  已处理: { label: '已处理', type: 'success' },
  已驳回: { label: '已驳回', type: 'info' },
}

/** 实名认证状态 */
export const CERT_STATUS: Record<string, { label: string; type: TagType }> = {
  待审核: { label: '待审核', type: 'warning' },
  已通过: { label: '已通过', type: 'success' },
  已驳回: { label: '已驳回', type: 'danger' },
}
