import { SetMetadata } from '@nestjs/common';

export const OPTIONAL_AUTH_KEY = 'optionalAuth';
/**
 * 标记可选登录接口（如商品详情）：
 * - 无 Authorization 头 → 匿名放行，req.user 为空
 * - 携带 Token → 走完整校验并装配 req.user（Token 非法仍 401）
 */
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH_KEY, true);
