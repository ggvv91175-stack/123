import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Goods } from '../goods/entities/goods.entity';
import { User } from '../user/entities/user.entity';
import {
  CreateOrderDto,
  QueryOrderDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { OrderInfo, OrderStatus } from './entities/order-info.entity';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(OrderInfo)
    private readonly orderRepo: Repository<OrderInfo>,
    @InjectRepository(Goods)
    private readonly goodsRepo: Repository<Goods>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 创建订单（买家对在售商品下单）：
   * - 商品不存在 → 404；非在售 → 409；买自己的商品 → 400
   * - 约定时间若传不得早于当前时间
   * - 初始状态待沟通；订单号 XY+yyyyMMddHHmmss+6位随机（唯一索引兜底）
   * - 说明：下单不锁商品（同一商品可有多条待沟通订单），由卖家选择交易对象，
   *   complete 时同事务将商品置为已售出，其余订单由卖家自行取消
   */
  async create(userId: number, dto: CreateOrderDto) {
    const goods = await this.goodsRepo.findOne({
      where: { id: dto.goodsId, isDeleted: false },
    });
    if (!goods) throw new NotFoundException('商品不存在');
    if (goods.status !== '在售') {
      throw new ConflictException(`商品当前不可交易，状态：${goods.status}`);
    }
    if (goods.userId === userId) {
      throw new BadRequestException('不能购买自己发布的商品');
    }

    let appointmentTime: Date | null = null;
    if (dto.appointmentTime) {
      appointmentTime = new Date(dto.appointmentTime);
      if (appointmentTime.getTime() <= Date.now()) {
        throw new BadRequestException('约定时间不能早于当前时间');
      }
    }

    const order = await this.orderRepo.save(
      this.orderRepo.create({
        orderNo: this.genOrderNo(),
        goodsId: goods.id,
        wantId: null,
        buyerId: userId,
        sellerId: goods.userId,
        status: '待沟通',
        appointmentTime,
        appointmentPlace: dto.appointmentPlace.trim(),
        remark: dto.remark?.trim() || null,
      }),
    );
    return order;
  }

  /**
   * 订单状态流转（仅交易双方）：
   * - confirm：待沟通 → 待交易
   * - complete：待交易 → 已完成（终态；同事务联动商品置已售出）
   * - cancel：待沟通/待交易 → 已取消（终态）
   * 条件更新防并发（WHERE status IN 前态），未命中 → 409
   */
  async updateStatus(
    userId: number,
    id: number,
    dto: UpdateOrderStatusDto,
  ) {
    const order = await this.findParty(userId, id);

    const transitions: Record<
      UpdateOrderStatusDto['action'],
      { from: OrderStatus[]; to: OrderStatus }
    > = {
      confirm: { from: ['待沟通'], to: '待交易' },
      complete: { from: ['待交易'], to: '已完成' },
      cancel: { from: ['待沟通', '待交易'], to: '已取消' },
    };
    const { from, to } = transitions[dto.action];

    await this.dataSource.transaction(async (manager) => {
      const updated = await manager
        .createQueryBuilder()
        .update(OrderInfo)
        .set({ status: to, version: () => 'version + 1' })
        .where('id = :id AND is_deleted = 0 AND status IN (:...from)', {
          id,
          from,
        })
        .execute();
      if (!updated.affected) {
        throw new ConflictException(
          `当前状态（${order.status}）不允许该操作，仅 ${from.join('/')} 可执行`,
        );
      }
      // complete 联动：商品置已售出（仅在售/已下架才联动，终态不覆盖）
      if (dto.action === 'complete' && order.goodsId) {
        await manager
          .createQueryBuilder()
          .update(Goods)
          .set({ status: '已售出', version: () => 'version + 1' })
          .where('id = :gid AND is_deleted = 0 AND status IN (:...gs)', {
            gid: order.goodsId,
            gs: ['在售', '已下架'],
          })
          .execute();
      }
    });
    return { id, status: to };
  }

  /**
   * 我的订单列表：role=buy 我的买到 / role=sell 我的卖出
   * 附商品摘要（标题/价格/封面图）与对方摘要（昵称/头像），按创建时间倒序
   */
  async list(userId: number, query: QueryOrderDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));
    const role = query.role ?? 'buy';

    const where: any = {
      isDeleted: false,
      ...(role === 'buy' ? { buyerId: userId } : { sellerId: userId }),
      ...(query.status ? { status: query.status } : {}),
    };
    const [orders, total] = await this.orderRepo.findAndCount({
      where,
      order: { createTime: 'DESC', id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      list: await this.attachSummaries(orders, userId),
      total,
      page,
      pageSize,
    };
  }

  /** 订单详情（仅交易双方）：附商品摘要与买卖双方摘要 */
  async detail(userId: number, id: number) {
    const order = await this.findParty(userId, id);
    const [item] = await this.attachSummaries([order], userId);
    return item;
  }

  /** 校验订单存在且当前用户为交易双方之一，否则 404/403 */
  private async findParty(userId: number, id: number) {
    const order = await this.orderRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('仅交易双方可查看或操作订单');
    }
    return order;
  }

  /** 批量拼装商品摘要（标题/价格/封面图）与对方用户摘要 */
  private async attachSummaries(orders: OrderInfo[], viewerId: number) {
    if (!orders.length) return [];
    const goodsIds = orders.filter((o) => o.goodsId).map((o) => o.goodsId!);
    const userIds = [
      ...new Set(orders.flatMap((o) => [o.buyerId, o.sellerId])),
    ];

    const goodsList: Goods[] = goodsIds.length
      ? await this.goodsRepo.findBy({ id: In(goodsIds) })
      : [];
    const users = await this.userRepo.findBy({ id: In(userIds) });
    const goodsMap = new Map(goodsList.map((g) => [g.id, g]));
    const userMap = new Map(users.map((u) => [u.id, u]));

    const briefUser = (id: number) => {
      const u = userMap.get(id);
      return u ? { id: u.id, nickname: u.nickname, avatar: u.avatar } : null;
    };

    return orders.map((o) => {
      const g = o.goodsId ? goodsMap.get(o.goodsId) : undefined;
      const images = (g?.images as string[] | null) ?? null;
      return {
        ...o,
        goods: g
          ? {
              id: g.id,
              title: g.title,
              price: g.price,
              cover: images?.[0] ?? null,
              status: g.status,
            }
          : null,
        buyer: briefUser(o.buyerId),
        seller: briefUser(o.sellerId),
        // 列表/详情视角冗余字段：对方摘要（前端直接展示）
        peer: briefUser(o.buyerId === viewerId ? o.sellerId : o.buyerId),
      };
    });
  }

  /** 订单号：XY + yyyyMMddHHmmss + 6位随机数 */
  private genOrderNo() {
    const d = new Date();
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    const ts =
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      pad(d.getSeconds());
    const rand = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
    return `XY${ts}${rand}`;
  }
}
