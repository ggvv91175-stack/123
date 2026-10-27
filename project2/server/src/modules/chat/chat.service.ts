import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, QueryFailedError, Repository } from 'typeorm';
import { Goods } from '../goods/entities/goods.entity';
import { User } from '../user/entities/user.entity';
import { WantBuy } from '../want/entities/want-buy.entity';
import {
  CreateSessionDto,
  QueryMessageDto,
  QuerySessionDto,
  SendMessageDto,
} from './dto/chat.dto';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatSession } from './entities/chat-session.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionRepo: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    @InjectRepository(Goods)
    private readonly goodsRepo: Repository<Goods>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(WantBuy)
    private readonly wantRepo: Repository<WantBuy>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 发起商品会话（需实名）：
   * - 商品不存在 → 404；与自己会话 → 400
   * - 幂等：uk_session_goods(goods_id, buyer_id) 唯一键，重复发起复用原会话
   * - 求购会话由阶段4接单接口自动创建（want.service.accept），不经本接口
   */
  async createSession(userId: number, dto: CreateSessionDto) {
    const goods = await this.goodsRepo.findOne({
      where: { id: dto.goodsId, isDeleted: false },
    });
    if (!goods) throw new NotFoundException('商品不存在');
    if (goods.userId === userId) {
      throw new BadRequestException('不能与自己发起私聊');
    }

    const existed = await this.sessionRepo.findOne({
      where: { goodsId: goods.id, buyerId: userId, isDeleted: false },
    });
    // 统一契约：返回 conversationId（与 want.service.accept 一致）
    if (existed) return { conversationId: existed.id, reused: true };

    try {
      const session = await this.sessionRepo.save(
        this.sessionRepo.create({
          goodsId: goods.id,
          wantId: null,
          buyerId: userId,
          sellerId: goods.userId,
        }),
      );
      return { conversationId: session.id, reused: false };
    } catch (e) {
      // 并发同时发起：撞唯一索引后回读复用（兜底幂等）
      if (e instanceof QueryFailedError) {
        const session = await this.sessionRepo.findOne({
          where: { goodsId: goods.id, buyerId: userId, isDeleted: false },
        });
        if (session) return { conversationId: session.id, reused: true };
      }
      throw e;
    }
  }

  /**
   * 我的会话列表（分页）：
   * - 我作为买家或卖家的会话，按最近消息时间（无消息按创建时间）倒序
   * - 附：对方摘要、商品/求购摘要、未读数（对方发送且未读）、最后一条消息
   */
  async mySessions(userId: number, query: QuerySessionDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));

    const [sessions, total] = await this.sessionRepo
      .createQueryBuilder('s')
      .where('s.is_deleted = 0')
      .andWhere('(s.buyer_id = :uid OR s.seller_id = :uid)', { uid: userId })
      .orderBy('COALESCE(s.last_message_time, s.create_time)', 'DESC')
      .addOrderBy('s.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    if (!sessions.length) return { list: [], total, page, pageSize };

    const sids = sessions.map((s) => s.id);

    // 未读数批量聚合：对方发送且未读
    const unreadRows: { sessionId: number; cnt: string }[] =
      await this.messageRepo
        .createQueryBuilder('m')
        .select('m.session_id', 'sessionId')
        .addSelect('COUNT(*)', 'cnt')
        .where('m.session_id IN (:...sids)', { sids })
        .andWhere('m.sender_id != :uid', { uid: userId })
        .andWhere('m.is_read = 0')
        .andWhere('m.is_deleted = 0')
        .groupBy('m.session_id')
        .getRawMany();
    const unreadMap = new Map(
      unreadRows.map((r) => [Number(r.sessionId), Number(r.cnt)]),
    );

    // 最后一条消息批量取：id 自增，MAX(id) 即最新（sids 来自库内主键，无注入风险）
    const lastRows: {
      id: number;
      sessionId: number;
      senderId: number;
      content: string;
      msgType: string;
      createTime: string;
    }[] = await this.messageRepo.query(
      `SELECT m.id, m.session_id AS sessionId, m.sender_id AS senderId,
              m.content, m.msg_type AS msgType, m.create_time AS createTime
         FROM chat_message m
        INNER JOIN (
          SELECT session_id, MAX(id) AS mid
            FROM chat_message
           WHERE session_id IN (${sids.join(',')}) AND is_deleted = 0
           GROUP BY session_id
        ) t ON m.id = t.mid`,
    );
    const lastMap = new Map(lastRows.map((r) => [Number(r.sessionId), r]));

    // 对方用户摘要 + 商品/求购摘要
    const peerIds = [
      ...new Set(
        sessions.map((s) => (s.buyerId === userId ? s.sellerId : s.buyerId)),
      ),
    ];
    const goodsIds = sessions.filter((s) => s.goodsId).map((s) => s.goodsId);
    const wantIds = sessions.filter((s) => s.wantId).map((s) => s.wantId);

    const users = await this.userRepo.findBy({ id: In(peerIds) });
    const goodsList: Goods[] = goodsIds.length
      ? await this.goodsRepo.findBy({ id: In(goodsIds) })
      : [];
    const wantList: WantBuy[] = wantIds.length
      ? await this.wantRepo.findBy({ id: In(wantIds) })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    const goodsMap = new Map(goodsList.map((g) => [g.id, g]));
    const wantMap = new Map(wantList.map((w) => [w.id, w]));

    const list = sessions.map((s) => {
      const peerId = s.buyerId === userId ? s.sellerId : s.buyerId;
      const peer = userMap.get(peerId);
      const goods = s.goodsId ? goodsMap.get(s.goodsId) : undefined;
      const want = s.wantId ? wantMap.get(s.wantId) : undefined;
      const last = lastMap.get(s.id);
      return {
        id: s.id,
        goodsId: s.goodsId,
        wantId: s.wantId,
        peer: peer
          ? { id: peer.id, nickname: peer.nickname, avatar: peer.avatar }
          : null,
        goods: goods
          ? { id: goods.id, title: goods.title, price: goods.price, status: goods.status }
          : null,
        want: want
          ? { id: want.id, itemName: want.itemName, budget: want.budget, status: want.status }
          : null,
        unreadCount: unreadMap.get(s.id) ?? 0,
        lastMessage: last
          ? {
              senderId: Number(last.senderId),
              content: last.content,
              msgType: last.msgType,
              createTime: last.createTime,
            }
          : null,
        lastMessageTime: s.lastMessageTime,
        createTime: s.createTime,
      };
    });

    return { list, total, page, pageSize };
  }

  /**
   * 发送消息（REST/WS 共用持久化逻辑）：
   * - 仅会话参与者可发，否则 403
   * - 同事务：写消息 + 刷新会话 last_message_time
   * - 返回完整消息视图（含推导的接收人）；一对一推送由调用方完成
   */
  async sendMessage(userId: number, sessionId: number, dto: SendMessageDto) {
    const session = await this.findParticipant(userId, sessionId);

    const saved = await this.dataSource.transaction(async (manager) => {
      const msg = await manager.save(
        manager.create(ChatMessage, {
          sessionId,
          senderId: userId,
          content: dto.content.trim(),
          msgType: dto.msgType ?? '文本',
        }),
      );
      await manager.update(
        ChatSession,
        { id: sessionId },
        { lastMessageTime: msg.createTime },
      );
      return msg;
    });

    const receiverId =
      session.buyerId === userId ? session.sellerId : session.buyerId;
    return this.toMessageView(saved, receiverId);
  }

  /**
   * 历史消息（分页，参与者）：
   * - 按时间倒序（最近在前），pageSize 上限 50
   * - 拉取即把对方发送的未读消息标记已读（先标记后查询，响应即已读态）
   */
  async history(userId: number, sessionId: number, query: QueryMessageDto) {
    const session = await this.findParticipant(userId, sessionId);

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));

    await this.messageRepo.update(
      { sessionId, senderId: Not(userId), isRead: false },
      { isRead: true },
    );

    const [list, total] = await this.messageRepo.findAndCount({
      where: { sessionId, isDeleted: false },
      order: { createTime: 'DESC', id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      list: list.map((m) =>
        this.toMessageView(
          m,
          m.senderId === session.buyerId ? session.sellerId : session.buyerId,
        ),
      ),
      total,
      page,
      pageSize,
    };
  }

  /** 校验会话存在且当前用户为参与者，否则 404/403 */
  private async findParticipant(userId: number, sessionId: number) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, isDeleted: false },
    });
    if (!session) throw new NotFoundException('会话不存在');
    if (session.buyerId !== userId && session.sellerId !== userId) {
      throw new ForbiddenException('仅会话参与者可操作');
    }
    return session;
  }

  /** 消息视图：补充推导出的接收人（会话中非发送方） */
  private toMessageView(m: ChatMessage, receiverId: number) {
    return {
      id: m.id,
      sessionId: m.sessionId,
      senderId: m.senderId,
      receiverId,
      msgType: m.msgType,
      content: m.content,
      isRead: m.isRead,
      createTime: m.createTime,
    };
  }
}
