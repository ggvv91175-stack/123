import { Injectable } from '@nestjs/common';

/**
 * Token 黑名单（内存版）：
 * - 退出登录时将 Token 加入黑名单，有效期至其原过期时间
 * - 服务重启黑名单清空属可接受兜底（JWT 2h 短有效期 + 禁用/tokenVersion 实时校验）
 */
@Injectable()
export class TokenBlacklistService {
  private readonly blacklist = new Map<string, number>(); // token -> 过期时间戳(ms)

  add(token: string, expiresAtMs: number): void {
    this.blacklist.set(token, expiresAtMs);
  }

  has(token: string): boolean {
    const exp = this.blacklist.get(token);
    if (exp === undefined) return false;
    if (Date.now() > exp) {
      this.blacklist.delete(token);
      return false;
    }
    return true;
  }
}
