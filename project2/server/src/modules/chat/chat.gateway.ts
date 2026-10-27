import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DataSource } from 'typeorm';
import { TokenBlacklistService } from '../../common/auth/token-blacklist.service';
import { User } from '../user/entities/user.entity';
import { ChatService } from './chat.service';
import { MsgType } from './entities/chat-message.entity';

/**
 * 私聊 WebSocket 网关（与 HTTP 同端口，默认 path=/socket.io）：
 * - 握手 JWT 鉴权：与全局 JwtAuthGuard 同口径（黑名单/禁用/tokenVersion），失败即断开
 * - 一对一推送：userId → 在线 socket 集合映射，仅发往接收人，绝不广播
 * - message:send 事件：WS 发送通道，与 REST 共用 service 持久化逻辑
 * 说明：cors origin 开发期放开，生产环境应与 CORS_ORIGIN 白名单对齐
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  /** userId → 该用户全部在线 socketId（多端同时在线各收一份） */
  private readonly online = new Map<number, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly blacklist: TokenBlacklistService,
    private readonly dataSource: DataSource,
    private readonly chatService: ChatService,
  ) {}

  /** 握手鉴权：token 取自 handshake.auth.token 或 query.token */
  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.query?.token as string);
    try {
      if (!token || this.blacklist.has(token)) throw new Error('unauthorized');
      const payload = await this.jwtService.verifyAsync<{
        id: number;
        tokenVersion: number;
      }>(token);
      const user = await this.dataSource.getRepository(User).findOne({
        where: { id: payload.id, isDeleted: false },
      });
      if (
        !user ||
        user.status === '禁用' ||
        user.tokenVersion !== payload.tokenVersion
      ) {
        throw new Error('unauthorized');
      }

      client.data.userId = user.id;
      const set = this.online.get(user.id) ?? new Set<string>();
      set.add(client.id);
      this.online.set(user.id, set);
      this.logger.log(`WS 上线: user=${user.id} socket=${client.id}`);
      client.emit('connected', { userId: user.id });
    } catch {
      client.emit('exception', { code: 401, message: '鉴权失败，连接已断开' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId as number | undefined;
    if (userId === undefined) return;
    const set = this.online.get(userId);
    if (set) {
      set.delete(client.id);
      if (!set.size) this.online.delete(userId);
    }
    this.logger.log(`WS 离线: user=${userId} socket=${client.id}`);
  }

  /**
   * 一对一推送：仅发往接收人的在线 socket；
   * 不在线则不推送（消息已持久化，待其上线后拉取历史）
   * @returns 实际送达的在线端数
   */
  pushToUser(userId: number, event: string, payload: unknown) {
    const set = this.online.get(userId);
    if (!set?.size) return 0;
    for (const sid of set) this.server.to(sid).emit(event, payload);
    return set.size;
  }

  /** WS 发送通道：ack 回执发送人 + message:new 推送接收人 */
  @SubscribeMessage('message:send')
  async onSend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { sessionId: number; content: string; msgType?: MsgType },
  ) {
    const userId = client.data.userId as number;
    if (
      !body ||
      typeof body.sessionId !== 'number' ||
      typeof body.content !== 'string' ||
      !body.content.trim() ||
      body.content.length > 2000
    ) {
      return { code: 400, message: '参数错误', data: null };
    }
    try {
      const view = await this.chatService.sendMessage(userId, body.sessionId, {
        content: body.content,
        msgType: body.msgType ?? '文本',
      });
      this.pushToUser(view.receiverId, 'message:new', view);
      return { code: 0, message: 'success', data: view };
    } catch (e: any) {
      const status = typeof e?.status === 'number' ? e.status : 500;
      return { code: status, message: e?.message ?? '发送失败', data: null };
    }
  }
}
