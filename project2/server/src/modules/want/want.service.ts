import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { ChatSession } from '../chat/entities/chat-session.entity';
import { WantBuy } from './entities/want-buy.entity';
import {
  CreateWantDto,
  MyWantQueryDto,
  QueryWantDto,
  UpdateWantDto,
} from './dto/want.dto';

@Injectable()
export class WantService {
  constructor(
    @InjectRepository(WantBuy)
    private readonly wantRepo: Repository<WantBuy>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /** 发布求购（需实名）：初始状态「待接单」 */
  async create(userId: number, dto: CreateWantDto) {
    const want = this.wantRepo.create({
      ...dto,
      itemName: dto.itemName.trim(),
      userId,
      status: '待接单',
    });
    return this.wantRepo.save(want);
  }

  /** 编辑求购（仅本人）：仅「待接单」可编辑，已接单/已关闭 → 409 */
  async update(userId: number, id: number, dto: UpdateWantDto) {
    const want = await this.findOwned(userId, id);
    if (want.status !== '待接单') {
      throw new ConflictException(
        `该求购已被接单或已关闭，无法编辑（当前状态：${want.status}）`,
      );
    }

    Object.assign(want, dto, { itemName: dto.itemName.trim() });
    return this.wantRepo.save(want);
  }

  /** 关闭求购（仅本人）：待接单 → 已关闭 */
  async close(userId: number, id: number) {
    const want = await this.findOwned(userId, id);
    if (want.status !== '待接单') {
      throw new ConflictException(
        `当前状态（${want.status}）不可关闭，仅待接单可关闭`,
      );
    }

    want.status = '已关闭';
    await this.wantRepo.save(want);
    return { id, status: '已关闭' };
  }

  /**
   * 求购组合检索（登录）：关键词/校区/期望成色/预算区间/状态 + 分页 + 排序
   * - 默认仅「待接单」，默认按创建时间倒序（走 idx_want_status(status, create_time DESC)）
   * - 关键词：SQLite 无中文全文索引，统一参数化 LIKE 模糊匹配
   */
  async list(query: QueryWantDto) {
    if (
      query.minBudget !== undefined &&
      query.maxBudget !== undefined &&
      query.minBudget > query.maxBudget
    ) {
      throw new BadRequestException('最低预算不能大于最高预算');
    }

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));

    const qb = this.wantRepo
      .createQueryBuilder('w')
      .where('w.is_deleted = 0')
      .andWhere('w.status = :status', { status: query.status ?? '待接单' });

    if (query.keyword) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('w.item_name LIKE :kw', { kw: `%${query.keyword}%` }).orWhere(
            'w.remark LIKE :kw',
            { kw: `%${query.keyword}%` },
          );
        }),
      );
    }
    if (query.campus) {
      qb.andWhere('w.campus = :campus', { campus: query.campus });
    }
    if (query.expectedCondition) {
      qb.andWhere('w.expected_condition = :cond', {
        cond: query.expectedCondition,
      });
    }
    if (query.minBudget !== undefined) {
      qb.andWhere('w.budget >= :minBudget', { minBudget: query.minBudget });
    }
    if (query.maxBudget !== undefined) {
      qb.andWhere('w.budget <= :maxBudget', { maxBudget: query.maxBudget });
    }

    const orderMap = {
      time: { column: 'w.create_time', dir: 'DESC' as const },
      budget_asc: { column: 'w.budget', dir: 'ASC' as const },
      budget_desc: { column: 'w.budget', dir: 'DESC' as const },
    };
    const order = orderMap[query.sort ?? 'time'];
    qb.orderBy(order.column, order.dir).addOrderBy('w.id', 'DESC');

    const [list, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      list: await this.attachPublisher(list),
      total,
      page,
      pageSize,
    };
  }

  /** 求购详情（登录）：不存在/已删除 → 404，附发布者摘要 */
  async detail(id: number) {
    const want = await this.wantRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!want) throw new NotFoundException('求购不存在');

    const [detail] = await this.attachPublisher([want]);
    return detail;
  }

  /**
   * 卖家接单：
   * - 不能接自己的求购 → 403
   * - 仅「待接单」可接，条件更新防并发（并发仅一人成功）
   * - 同事务自动创建 chat_session 并关联 want_id（buyer_id=求购者，seller_id=接单人）
   * - 会话已存在则复用（幂等）
   */
  async accept(userId: number, id: number) {
    return this.dataSource.transaction(async (manager) => {
      const want = await manager.findOne(WantBuy, {
        where: { id, isDeleted: false },
      });
      if (!want) throw new NotFoundException('求购不存在');
      if (want.userId === userId) {
        throw new ForbiddenException('不能接自己的求购');
      }
      if (want.status !== '待接单') {
        throw new ConflictException(
          `该求购已被接单或已关闭，当前状态：${want.status}`,
        );
      }

      const updated = await manager.update(
        WantBuy,
        { id, isDeleted: false, status: '待接单' },
        { status: '已接单' },
      );
      if (!updated.affected) {
        throw new ConflictException('该求购已被他人接单，请刷新后重试');
      }

      // 唯一键 uk_session_want(want_id, buyer_id) 保证同一求购仅一条会话
      let session = await manager.findOne(ChatSession, {
        where: { wantId: id, buyerId: want.userId, isDeleted: false },
      });
      if (!session) {
        session = await manager.save(
          manager.create(ChatSession, {
            goodsId: null,
            wantId: id,
            buyerId: want.userId,
            sellerId: userId,
          }),
        );
      }

      return { conversationId: session.id, wantId: id, status: '已接单' };
    });
  }

  /** 我的求购列表（登录）：全部状态，可按状态筛选，按创建时间倒序分页 */
  async myList(userId: number, query: MyWantQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));

    const [list, total] = await this.wantRepo.findAndCount({
      where: {
        userId,
        isDeleted: false,
        ...(query.status ? { status: query.status } : {}),
      },
      order: { createTime: 'DESC', id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { list, total, page, pageSize };
  }

  /** 校验求购存在且归属当前用户，否则 404/403 */
  private async findOwned(userId: number, id: number) {
    const want = await this.wantRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!want) throw new NotFoundException('求购不存在');
    if (want.userId !== userId) {
      throw new ForbiddenException('只能操作本人发布的求购');
    }
    return want;
  }

  /** 批量拼装发布者摘要（昵称/头像/是否实名） */
  private async attachPublisher(list: WantBuy[]) {
    if (!list.length) return [];
    const userIds = [...new Set(list.map((w) => w.userId))];
    const users = await this.userRepo.findBy({ id: In(userIds) });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return list.map((w) => ({
      ...w,
      publisher: userMap.get(w.userId)
        ? {
            nickname: userMap.get(w.userId)!.nickname,
            avatar: userMap.get(w.userId)!.avatar,
            isCertified: userMap.get(w.userId)!.isCertified,
          }
        : null,
    }));
  }
}
