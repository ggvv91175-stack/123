/** 统一响应体：{ code, message, data }，code=0 成功，非 0 与 HTTP 状态码一致 */
export interface Result<T = any> {
  code: number;
  message: string;
  data: T | null;
}

/** 统一分页响应 data 结构 */
export interface PageResult<T = any> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
