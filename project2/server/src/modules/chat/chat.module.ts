import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Goods } from '../goods/entities/goods.entity';
import { User } from '../user/entities/user.entity';
import { WantBuy } from '../want/entities/want-buy.entity';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatSession } from './entities/chat-session.entity';

/**
 * 私聊模块：
 * - REST：发起会话（幂等）/会话列表（未读数）/历史消息（拉取即已读）/发送消息
 * - WebSocket：JWT 握手鉴权 + message:send 事件 + message:new 一对一推送
 * - 求购接单自动建会话由阶段4 want.service.accept 实现（同事务），本模块复用其结果
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ChatSession, ChatMessage, Goods, User, WantBuy]),
    AuthModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
