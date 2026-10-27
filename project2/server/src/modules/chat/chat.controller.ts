import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { RequireCertified } from '../../common/decorators/require-certified.decorator';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import {
  CreateSessionDto,
  QueryMessageDto,
  QuerySessionDto,
  SendMessageDto,
} from './dto/chat.dto';

@ApiTags('私聊')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post('sessions')
  @RequireCertified()
  @ApiOperation({
    summary: '发起商品私聊会话（需实名）；同商品同买家幂等复用，返回 conversationId',
  })
  createSession(@CurrentUser() user: AuthUser, @Body() dto: CreateSessionDto) {
    return this.chatService.createSession(user.id, dto);
  }

  @Get('sessions')
  @ApiOperation({
    summary: '我的会话列表（按最近消息倒序，附对方摘要/商品或求购摘要/未读数/最后一条消息）',
  })
  mySessions(@CurrentUser() user: AuthUser, @Query() query: QuerySessionDto) {
    return this.chatService.mySessions(user.id, query);
  }

  @Get('sessions/:id/messages')
  @ApiOperation({
    summary: '历史消息（分页，仅参与者）；拉取即把对方消息标记已读',
  })
  history(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryMessageDto,
  ) {
    return this.chatService.history(user.id, id, query);
  }

  @Post('sessions/:id/messages')
  @ApiOperation({
    summary: '发送消息（REST 通道：持久化 + 一对一推送在线接收人）；WS 通道见网关 message:send 事件',
  })
  async send(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendMessageDto,
  ) {
    const view = await this.chatService.sendMessage(user.id, id, dto);
    this.chatGateway.pushToUser(view.receiverId, 'message:new', view);
    return view;
  }
}
