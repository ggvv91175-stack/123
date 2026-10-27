import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatSession } from '../chat/entities/chat-session.entity';
import { WantBuy } from './entities/want-buy.entity';
import { WantController } from './want.controller';
import { WantService } from './want.service';

/** 求购模块：发布/编辑/关闭、列表/详情、卖家接单（自动创建会话） */
@Module({
  imports: [TypeOrmModule.forFeature([WantBuy, ChatSession])],
  controllers: [WantController],
  providers: [WantService],
  exports: [WantService],
})
export class WantModule {}
