import { SetMetadata } from '@nestjs/common';

export const REQUIRE_CERTIFIED_KEY = 'requireCertified';
/** 标记接口要求已实名认证（发布商品/私聊等），未认证拦截 403 */
export const RequireCertified = () => SetMetadata(REQUIRE_CERTIFIED_KEY, true);
