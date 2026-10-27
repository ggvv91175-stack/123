import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_CERTIFIED_KEY } from '../decorators/require-certified.decorator';

/**
 * 实名状态守卫：配合 @RequireCertified() 使用。
 * 未通过实名认证的登录用户访问发布/私聊等接口 → 403。
 * 依赖 JwtAuthGuard 先行装配 req.user.isCertified（全局守卫注册顺序保证）。
 */
@Injectable()
export class CertifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_CERTIFIED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.isCertified) {
      throw new ForbiddenException('请先完成实名认证');
    }
    return true;
  }
}
