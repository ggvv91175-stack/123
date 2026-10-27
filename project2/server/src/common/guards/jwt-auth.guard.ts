import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { TokenBlacklistService } from '../auth/token-blacklist.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';
import { AuthUser } from '../decorators/current-user.decorator';
import { User } from '../../modules/user/entities/user.entity';

interface JwtPayload {
  id: number;
  studentNo: string;
  role: 'admin' | 'student';
  tokenVersion: number;
}

/**
 * 全局 JWT 守卫：
 * 1. @Public() 接口直接放行
 * 2. 黑名单 Token（已退出登录）→ 401
 * 3. Token 缺失/过期/伪造 → 401
 * 4. 实时校验数据库用户状态：禁用 → 401；tokenVersion 不一致（改密后旧 Token）→ 401
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly blacklist: TokenBlacklistService,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const header: string = req.headers['authorization'] || '';
    const [type, token] = header.split(' ');
    if (type !== 'Bearer' || !token) {
      // @OptionalAuth 接口允许匿名访问：无 Token 直接放行（req.user 为空）
      const isOptional = this.reflector.getAllAndOverride<boolean>(
        OPTIONAL_AUTH_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (isOptional) return true;
      throw new UnauthorizedException('请先登录');
    }
    if (this.blacklist.has(token)) {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }

    // 实时校验用户状态与 Token 版本（禁用/改密即时生效）
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: payload.id, isDeleted: false },
    });
    if (!user) throw new UnauthorizedException('账号不存在');
    if (user.status === '禁用') {
      throw new UnauthorizedException('账号已被禁用，请联系管理员');
    }
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }

    req.user = {
      id: user.id,
      studentNo: user.studentNo,
      role: user.role,
      isCertified: user.isCertified,
    } satisfies AuthUser;
    req.token = token;
    return true;
  }
}
