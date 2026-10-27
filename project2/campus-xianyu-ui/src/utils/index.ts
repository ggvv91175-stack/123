/** 通用工具 */

/** 学号脱敏：2021031245 -> 2021****245 */
export function maskStudentNo(no: string | null | undefined): string {
  if (!no || no === '-') return no || '-'
  if (no.length <= 7) return no
  return no.slice(0, 4) + '****' + no.slice(-3)
}

/** 文本敏感词命中检测（本地演示用），返回命中的词 */
export function checkSensitive(text: string, words: string[]): string[] {
  return words.filter((w) => !!text && text.includes(w))
}

/** 价格格式化：12.5 -> ¥12.50 */
export function formatPrice(price: number | string | null | undefined): string {
  const n = Number(price)
  return Number.isFinite(n) ? `¥${n.toFixed(2)}` : '¥--'
}
