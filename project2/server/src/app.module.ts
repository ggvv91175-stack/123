import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import * as path from 'path';

import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { CertifiedGuard } from './common/guards/certified.guard';

import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { UserModule } from './modules/user/user.module';
import { GoodsModule } from './modules/goods/goods.module';
import { CategoryModule } from './modules/category/category.module';
import { WantModule } from './modules/want/want.module';
import { CommentModule } from './modules/comment/comment.module';
import { ChatModule } from './modules/chat/chat.module';
import { OrderModule } from './modules/order/order.module';
import { ReportModule } from './modules/report/report.module';
import { AdminModule } from './modules/admin/admin.module';
import { FilesModule } from './modules/files/files.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // 双数据库支持：DB_TYPE=mysql（Docker 编排/生产）| sqlite（本地开发默认）
        // 表结构统一由 sql 初始化脚本管理（MySQL: init.mysql.sql / SQLite: init.sql），禁止 ORM 自动同步
        if (config.get<string>('DB_TYPE') === 'mysql') {
          return {
            type: 'mysql' as const,
            host: config.get<string>('DB_HOST', 'localhost'),
            port: config.get<number>('DB_PORT', 3306),
            username: config.get<string>('DB_USER', 'root'),
            password: config.get<string>('DB_PASS', ''),
            database: config.get<string>('DB_NAME', 'campus_xianyu'),
            charset: 'utf8mb4',
            autoLoadEntities: true,
            synchronize: false,
          };
        }
        return {
          type: 'better-sqlite3' as const,
          database: path.resolve(
            config.get<string>('DB_FILE', './data/campus_xianyu.db'),
          ),
          autoLoadEntities: true,
          synchronize: false,
          // better-sqlite3 驱动默认开启 PRAGMA foreign_keys = ON
        };
      },
    }),
    AuthModule,
    HealthModule,
    UserModule,
    GoodsModule,
    CategoryModule,
    FilesModule,
    WantModule,
    // 以下为业务模块占位（后续阶段实现）
    CommentModule,
    ChatModule,
    OrderModule,
    ReportModule,
    AdminModule,
  ],
  providers: [
    // 全局异常过滤器：HttpException / SQLite 约束异常 / 未知异常 → 统一响应体
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    // 全局日志拦截器：方法、路径、耗时、状态码
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    // 全局统一返回体：{ code, message, data }
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    // 全局鉴权：JWT 守卫（@Public 放行）→ 角色守卫（@Roles 控制 /admin 等）→ 实名守卫（@RequireCertified 拦截发布/私聊）
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: CertifiedGuard },
  ],
})
export class AppModule {}
