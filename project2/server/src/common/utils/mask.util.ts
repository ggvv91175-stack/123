/** 学号脱敏：前4位 + **** + 后3位，如 2021****245 */
export function maskStudentNo(no: string): string {
  if (!no || no.length <= 7) return no ? no[0] + '****' : '';
  return no.slice(0, 4) + '****' + no.slice(-3);
}
