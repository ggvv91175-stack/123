import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RealAuth } from './entities/real-auth.entity';
import { User } from './entities/user.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';

/**
 * 用户与实名认证模块（全局模块）：
 * - 导出 User/RealAuth 仓库与 UserService，供 auth/admin 及后续业务模块复用
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User, RealAuth])],
  controllers: [UserController],
  providers: [UserService],
  exports: [TypeOrmModule, UserService],
})
export class UserModule {}
