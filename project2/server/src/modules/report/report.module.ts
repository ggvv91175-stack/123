import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageComment } from '../comment/entities/message-comment.entity';
import { Goods } from '../goods/entities/goods.entity';
import { User } from '../user/entities/user.entity';
import { WantBuy } from '../want/entities/want-buy.entity';
import { Report } from './entities/report.entity';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

/** 举报模块：用户举报（多态目标/待处理去重）+ 管理员列表/处理（同事务联动下架/封禁/删留言） */
@Module({
  imports: [
    TypeOrmModule.forFeature([Report, Goods, WantBuy, User, MessageComment]),
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
