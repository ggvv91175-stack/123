import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** 标记公开接口（注册/登录/商品列表等），JWT 守卫放行 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
