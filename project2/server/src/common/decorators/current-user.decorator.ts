import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** 登录用户上下文（JwtAuthGuard 实时从数据库装配） */
export interface AuthUser {
  id: number;
  studentNo: string;
  role: 'admin' | 'student';
  /** 是否已实名认证（供 CertifiedGuard 使用） */
  isCertified: boolean;
}

/** 从请求中取出当前登录用户：@CurrentUser() user: AuthUser */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);
