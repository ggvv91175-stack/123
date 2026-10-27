import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TokenBlacklistService } from '../../common/auth/token-blacklist.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * 认证模块：
 * - 全局注册 JwtModule（密钥/有效期来自环境变量）
 * - 注册/登录/退出（黑名单）接口
 * - 导出 TokenBlacklistService 供全局 JwtAuthGuard 使用
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '2h') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenBlacklistService],
  exports: [TokenBlacklistService],
})
export class AuthModule {}
