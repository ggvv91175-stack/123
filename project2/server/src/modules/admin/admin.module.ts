import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Goods } from '../goods/entities/goods.entity';
import { Report } from '../report/entities/report.entity';
import { RealAuth } from '../user/entities/real-auth.entity';
import { User } from '../user/entities/user.entity';
import { WantBuy } from '../want/entities/want-buy.entity';
import { AdminCertificationController } from './admin-certification.controller';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/** 平台管理模块：实名认证审核、用户管理（列表/禁用）、数据看板统计；全部 @Roles('admin') */
@Module({
  imports: [TypeOrmModule.forFeature([RealAuth, User, Goods, WantBuy, Report])],
  controllers: [AdminCertificationController, AdminController],
  providers: [AdminService],
})
export class AdminModule {}
