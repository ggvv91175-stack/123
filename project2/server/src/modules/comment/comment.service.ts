import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Goods } from '../goods/entities/goods.entity';
import { User } from '../user/entities/user.entity';
import { CreateCommentDto, QueryCommentDto } from './dto/comment.dto';
import { MessageComment } from './entities/message-comment.entity';

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(MessageComment)
    private readonly commentRepo: Repository<MessageComment>,
    @InjectRepository(Goods)
    private readonly goodsRepo: Repository<Goods>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /** 新增留言（登录）：商品必须存在且未删除，否则 404 */
  async create(userId: number, goodsId: number, dto: CreateCommentDto) {
    const goods = await this.goodsRepo.findOne({
      where: { id: goodsId, isDeleted: false },
    });
    if (!goods) throw new NotFoundException('商品不存在');

    const comment = this.commentRepo.create({
      goodsId,
      userId,
      parentId: null,
      replyToUserId: null,
      content: dto.content.trim(),
    });
    return this.commentRepo.save(comment);
  }

  /**
   * 回复留言（登录）：
   * - 父留言必须存在且正常，否则 404
   * - 仅两层结构：回复的回复平铺到顶层留言下，replyToUserId 记录直接被回复人
   */
  async reply(userId: number, parentId: number, dto: CreateCommentDto) {
    const parent = await this.commentRepo.findOne({
      where: { id: parentId, isDeleted: false },
    });
    if (!parent || parent.status !== '正常') {
      throw new NotFoundException('留言不存在或已删除');
    }

    const reply = this.commentRepo.create({
      goodsId: parent.goodsId,
      userId,
      parentId: parent.parentId ?? parent.id,
      replyToUserId: parent.userId,
      content: dto.content.trim(),
    });
    return this.commentRepo.save(reply);
  }

  /**
   * 商品留言列表（分页，可选登录）：
   * - 可见性与商品详情一致：在售所有人可见；非在售仅本人/管理员，其余 404（避免泄露）
   * - 顶层留言按时间倒序分页；每条附全部正常回复（按时间正序）与双方用户摘要
   */
  async list(goodsId: number, query: QueryCommentDto, user?: AuthUser) {
    const goods = await this.goodsRepo.findOne({
      where: { id: goodsId, isDeleted: false },
    });
    if (!goods) throw new NotFoundException('商品不存在');
    if (goods.status !== '在售') {
      const canView =
        user && (user.id === goods.userId || user.role === 'admin');
      if (!canView) throw new NotFoundException('商品不存在');
    }

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));

    const [roots, total] = await this.commentRepo.findAndCount({
      where: {
        goodsId,
        parentId: IsNull(),
        status: '正常',
        isDeleted: false,
      },
      order: { createTime: 'DESC', id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const rootIds = roots.map((r) => r.id);
    const replies = rootIds.length
      ? await this.commentRepo.find({
          where: { parentId: In(rootIds), status: '正常', isDeleted: false },
          order: { createTime: 'ASC', id: 'ASC' },
        })
      : [];

    // 批量拼装留言人/被回复人摘要（昵称/头像）
    const userIds = [
      ...new Set(
        [...roots, ...replies]
          .flatMap((c) => [c.userId, c.replyToUserId])
          .filter((id): id is number => typeof id === 'number'),
      ),
    ];
    const users = userIds.length
      ? await this.userRepo.findBy({ id: In(userIds) })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    const brief = (id: number | null) => {
      const u = id === null ? undefined : userMap.get(id);
      return u ? { id: u.id, nickname: u.nickname, avatar: u.avatar } : null;
    };

    const replyGroups = new Map<number, MessageComment[]>();
    for (const r of replies) {
      const arr = replyGroups.get(r.parentId!) ?? [];
      arr.push(r);
      replyGroups.set(r.parentId!, arr);
    }

    const list = roots.map((r) => ({
      id: r.id,
      content: r.content,
      createTime: r.createTime,
      user: brief(r.userId),
      replies: (replyGroups.get(r.id) ?? []).map((rp) => ({
        id: rp.id,
        content: rp.content,
        createTime: rp.createTime,
        user: brief(rp.userId),
        replyToUser: brief(rp.replyToUserId),
      })),
    }));

    return { list, total, page, pageSize };
  }

  /**
   * 我的留言列表（登录）：本人发布的正常留言/回复，按时间倒序分页
   * 附商品摘要（id/标题/状态/首图）与被回复人摘要，便于"我的留言"页跳转与展示
   */
  async myList(userId: number, query: QueryCommentDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));

    const [rows, total] = await this.commentRepo.findAndCount({
      where: { userId, status: '正常', isDeleted: false },
      order: { createTime: 'DESC', id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const goodsIds = [...new Set(rows.map((c) => c.goodsId))];
    const goodsList = goodsIds.length
      ? await this.goodsRepo.findBy({ id: In(goodsIds) })
      : [];
    const goodsMap = new Map(goodsList.map((g) => [g.id, g]));

    const replyToIds = [
      ...new Set(
        rows
          .map((c) => c.replyToUserId)
          .filter((id): id is number => typeof id === 'number'),
      ),
    ];
    const users = replyToIds.length
      ? await this.userRepo.findBy({ id: In(replyToIds) })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const list = rows.map((c) => {
      const g = goodsMap.get(c.goodsId);
      const replyTo = c.replyToUserId ? userMap.get(c.replyToUserId) : null;
      return {
        id: c.id,
        goodsId: c.goodsId,
        content: c.content,
        isReply: c.parentId !== null,
        replyToUser: replyTo
          ? { id: replyTo.id, nickname: replyTo.nickname, avatar: replyTo.avatar }
          : null,
        createTime: c.createTime,
        goods: g
          ? {
              id: g.id,
              title: g.title,
              status: g.status,
              image: g.images?.[0] ?? null,
            }
          : null,
      };
    });

    return { list, total, page, pageSize };
  }

  /**
   * 删除留言（仅本人，软删除）：
   * - status 标记「已删除」，不物理删
   * - 删除顶层留言时同事务级联软删其下所有正常回复，避免树断裂
   */
  async remove(userId: number, id: number) {
    const comment = await this.commentRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!comment || comment.status !== '正常') {
      throw new NotFoundException('留言不存在');
    }
    if (comment.userId !== userId) {
      throw new ForbiddenException('只能删除本人的留言');
    }

    await this.dataSource.transaction(async (manager) => {
      if (comment.parentId === null) {
        await manager.update(
          MessageComment,
          { parentId: id, status: '正常' },
          { status: '已删除' },
        );
      }
      await manager.update(MessageComment, { id }, { status: '已删除' });
    });
    return { id };
  }
}
