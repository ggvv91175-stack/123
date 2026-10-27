import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, MoreThan, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Category } from '../category/entities/category.entity';
import { Goods, GoodsStatus } from './entities/goods.entity';
import {
  AdminGoodsQueryDto,
  CreateGoodsDto,
  MyGoodsQueryDto,
  QueryGoodsDto,
  UpdateGoodsDto,
  UpdateGoodsStatusDto,
} from './dto/goods.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class GoodsService {
  constructor(
    @InjectRepository(Goods)
    private readonly goodsRepo: Repository<Goods>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * 发布商品（需实名）：
   * - 分类必须存在且启用
   * - 防重复提交：同用户同标题 30 秒内已有未删记录 → 幂等返回已有商品
   * - 初始状态：待审核
   */
  async create(userId: number, dto: CreateGoodsDto) {
    const category = await this.categoryRepo.findOne({
      where: { id: dto.categoryId, isDeleted: false },
    });
    if (!category || category.status !== '启用') {
      throw new BadRequestException('分类不存在或已停用');
    }

    const duplicated = await this.goodsRepo.findOne({
      where: {
        userId,
        title: dto.title.trim(),
        isDeleted: false,
        createTime: MoreThan(new Date(Date.now() - 30 * 1000)),
      },
    });
    if (duplicated) return duplicated;

    const goods = this.goodsRepo.create({
      ...dto,
      title: dto.title.trim(),
      userId,
      status: '待审核',
    });
    return this.goodsRepo.save(goods);
  }

  /**
   * 编辑商品（仅本人，全量更新）：
   * - 仅 待审核/已驳回/在售/已下架 可编辑，已售出/违规下架 → 409
   * - 编辑后重置为待审核、清空驳回理由（需重新审核）
   */
  async update(userId: number, id: number, dto: UpdateGoodsDto) {
    const goods = await this.findOwned(userId, id);

    const editable: GoodsStatus[] = ['待审核', '已驳回', '在售', '已下架'];
    if (!editable.includes(goods.status)) {
      throw new ConflictException(`当前状态（${goods.status}）不可编辑`);
    }

    const category = await this.categoryRepo.findOne({
      where: { id: dto.categoryId, isDeleted: false },
    });
    if (!category || category.status !== '启用') {
      throw new BadRequestException('分类不存在或已停用');
    }

    Object.assign(goods, dto, { title: dto.title.trim() });
    goods.status = '待审核';
    goods.rejectReason = null;
    goods.version += 1;
    return this.goodsRepo.save(goods);
  }

  /** 删除商品（仅本人，逻辑删） */
  async remove(userId: number, id: number) {
    const goods = await this.findOwned(userId, id);
    goods.isDeleted = true;
    await this.goodsRepo.save(goods);
    return { id };
  }

  /**
   * 上下架/已售出状态机（仅本人）：
   * - on：已下架 → 在售
   * - off：在售 → 已下架
   * - sold：在售/已下架 → 已售出（终态）
   */
  async updateStatus(userId: number, id: number, dto: UpdateGoodsStatusDto) {
    const goods = await this.findOwned(userId, id);

    const transitions: Record<UpdateGoodsStatusDto['action'], { from: GoodsStatus[]; to: GoodsStatus }> = {
      on: { from: ['已下架'], to: '在售' },
      off: { from: ['在售'], to: '已下架' },
      sold: { from: ['在售', '已下架'], to: '已售出' },
    };
    const { from, to } = transitions[dto.action];
    if (!from.includes(goods.status)) {
      throw new ConflictException(
        `当前状态（${goods.status}）不允许该操作，仅 ${from.join('/')} 可执行`,
      );
    }

    goods.status = to;
    goods.version += 1;
    await this.goodsRepo.save(goods);
    return { id, status: to };
  }

  /** 我的发布列表：全部状态，按更新时间倒序 */
  async myList(userId: number, query: MyGoodsQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));

    const [list, total] = await this.goodsRepo.findAndCount({
      where: {
        userId,
        isDeleted: false,
        ...(query.status ? { status: query.status } : {}),
      },
      order: { updateTime: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { list, total, page, pageSize };
  }

  /**
   * 公开商品列表：仅在售，支持关键词（标题/描述）、分类、价格区间、校区、新旧程度筛选
   * 排序：time（默认）/ price_asc / price_desc；附发布者摘要（昵称/实名）
   */
  async publicList(query: QueryGoodsDto) {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      throw new BadRequestException('最低价不能大于最高价');
    }

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));

    const qb = this.goodsRepo
      .createQueryBuilder('g')
      .where('g.is_deleted = 0')
      .andWhere("g.status = '在售'");

    // 关键词：SQLite 无中文全文索引，统一参数化 LIKE 模糊匹配（数据量级小可接受）
    if (query.keyword) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('g.title LIKE :kw', { kw: `%${query.keyword}%` }).orWhere(
            'g.description LIKE :kw',
            { kw: `%${query.keyword}%` },
          );
        }),
      );
    }
    if (query.categoryId !== undefined) {
      qb.andWhere('g.category_id = :cid', { cid: query.categoryId });
    }
    if (query.minPrice !== undefined) {
      qb.andWhere('g.price >= :minPrice', { minPrice: query.minPrice });
    }
    if (query.maxPrice !== undefined) {
      qb.andWhere('g.price <= :maxPrice', { maxPrice: query.maxPrice });
    }
    if (query.campus) qb.andWhere('g.campus = :campus', { campus: query.campus });
    if (query.condition) {
      qb.andWhere('g.condition_level = :cond', { cond: query.condition });
    }

    const orderMap = {
      time: { column: 'g.create_time', dir: 'DESC' as const },
      price_asc: { column: 'g.price', dir: 'ASC' as const },
      price_desc: { column: 'g.price', dir: 'DESC' as const },
    };
    const order = orderMap[query.sort ?? 'time'];
    qb.orderBy(order.column, order.dir).addOrderBy('g.id', 'DESC');

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

  /**
   * 商品详情（可选登录）：
   * - 不存在/已删除 → 404
   * - 在售 → 所有人可见
   * - 非在售 → 仅本人或管理员可见，其余 404（避免泄露待审核/驳回内容）
   */
  async detail(id: number, user?: AuthUser) {
    const goods = await this.goodsRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!goods) throw new NotFoundException('商品不存在');

    if (goods.status !== '在售') {
      const canView =
        user && (user.id === goods.userId || user.role === 'admin');
      if (!canView) throw new NotFoundException('商品不存在');
    }

    const [publisher] = await this.attachPublisher([goods]);
    return publisher;
  }

  /** 校验商品存在且归属当前用户，否则 404/403 */
  private async findOwned(userId: number, id: number) {
    const goods = await this.goodsRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!goods) throw new NotFoundException('商品不存在');
    if (goods.userId !== userId) {
      throw new ForbiddenException('只能操作本人发布的商品');
    }
    return goods;
  }

  /** 批量拼装发布者摘要（昵称/头像/是否实名） */
  private async attachPublisher(list: Goods[]) {
    if (!list.length) return [];
    const userIds = [...new Set(list.map((g) => g.userId))];
    const users = await this.userRepo.findBy({ id: In(userIds) });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return list.map((g) => ({
      ...g,
      publisher: userMap.get(g.userId)
        ? {
            nickname: userMap.get(g.userId)!.nickname,
            avatar: userMap.get(g.userId)!.avatar,
            isCertified: userMap.get(g.userId)!.isCertified,
          }
        : null,
    }));
  }

  // ---------------- 管理员审核 ----------------

  /** 管理员商品列表：默认待审核，按提交时间正序（先提先审），附发布者摘要 */
  async adminList(query: AdminGoodsQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));
    const status = query.status ?? '待审核';

    const [list, total] = await this.goodsRepo.findAndCount({
      where: { status, isDeleted: false },
      order: { createTime: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      list: await this.attachPublisher(list),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 审核商品：
   * - 仅待审核可审，条件更新防并发重复审核
   * - pass → 在售；reject → 已驳回（理由必填）
   */
  async review(id: number, result: 'pass' | 'reject', reason?: string) {
    if (result === 'reject' && !reason?.trim()) {
      throw new BadRequestException('驳回时必须填写驳回理由');
    }

    const next: GoodsStatus = result === 'pass' ? '在售' : '已驳回';
    const affected = await this.goodsRepo.update(
      { id, isDeleted: false, status: '待审核' },
      {
        status: next,
        rejectReason: result === 'reject' ? reason!.trim() : null,
      },
    );

    if (!affected.affected) {
      const goods = await this.goodsRepo.findOne({
        where: { id, isDeleted: false },
      });
      if (!goods) throw new NotFoundException('商品不存在');
      throw new ConflictException(`该商品已审核，当前状态：${goods.status}`);
    }
    return { id, status: next };
  }

  /** 违规下架：在售/已下架 → 违规下架（终态，理由必填） */
  async takedown(id: number, reason: string) {
    const goods = await this.goodsRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!goods) throw new NotFoundException('商品不存在');
    if (!['在售', '已下架'].includes(goods.status)) {
      throw new ConflictException(
        `当前状态（${goods.status}）不可违规下架，仅在售/已下架可执行`,
      );
    }

    goods.status = '违规下架';
    goods.rejectReason = reason.trim();
    goods.version += 1;
    await this.goodsRepo.save(goods);
    return { id, status: '违规下架' };
  }
}
