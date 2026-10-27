import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { MessageComment } from '../comment/entities/message-comment.entity';
import { Goods } from '../goods/entities/goods.entity';
import { User } from '../user/entities/user.entity';
import { WantBuy } from '../want/entities/want-buy.entity';
import {
  CreateReportDto,
  HandleReportDto,
  QueryReportDto,
} from './dto/report.dto';
import {
  HandleAction,
  Report,
  TargetType,
} from './entities/report.entity';

/** 处理动作与目标类型的合法映射（防误操作） */
const ACTION_ALLOWED: Record<TargetType, HandleAction[]> = {
  商品: ['下架商品', '警告用户', '驳回举报'],
  求购: ['警告用户', '驳回举报'],
  用户: ['封禁用户', '警告用户', '驳回举报'],
  留言: ['删除留言', '警告用户', '驳回举报'],
};

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(Goods)
    private readonly goodsRepo: Repository<Goods>,
    @InjectRepository(WantBuy)
    private readonly wantRepo: Repository<WantBuy>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(MessageComment)
    private readonly commentRepo: Repository<MessageComment>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 用户举报（登录）：
   * - 目标必须存在（多态校验），不存在 → 404
   * - 不能举报自己发布的内容/自己 → 400
   * - 待处理去重：同举报人+类型+目标 已有待处理记录 → 409（表注释约定应用层实现）
   */
  async create(userId: number, dto: CreateReportDto) {
    const ownerId = await this.assertTargetExists(dto.targetType, dto.targetId);
    if (ownerId === userId) {
      throw new BadRequestException('不能举报自己发布的内容');
    }

    const duplicated = await this.reportRepo.findOne({
      where: {
        reporterId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        status: '待处理',
        isDeleted: false,
      },
    });
    if (duplicated) {
      throw new ConflictException('您已举报过该对象，请等待处理结果');
    }

    return this.reportRepo.save(
      this.reportRepo.create({
        reporterId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason.trim(),
        evidenceImages: dto.evidenceImages?.length ? dto.evidenceImages : null,
        status: '待处理',
      }),
    );
  }

  /** 管理员举报列表：默认待处理，按提交时间正序（先报先处理），附举报人摘要 */
  async list(query: QueryReportDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));
    const status = query.status ?? '待处理';

    const [records, total] = await this.reportRepo.findAndCount({
      where: {
        status,
        isDeleted: false,
        ...(query.targetType ? { targetType: query.targetType } : {}),
      },
      order: { createTime: 'ASC', id: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const userIds = [...new Set(records.map((r) => r.reporterId))];
    const users = userIds.length
      ? await this.userRepo.findBy({ id: In(userIds) })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      list: records.map((r) => ({
        ...r,
        reporter: userMap.get(r.reporterId)
          ? {
              nickname: userMap.get(r.reporterId)!.nickname,
              avatar: userMap.get(r.reporterId)!.avatar,
            }
          : null,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 处理举报（管理员，同事务联动）：
   * - 仅待处理可处理；条件更新防并发，未命中 → 409
   * - 动作与目标类型匹配校验（ACTION_ALLOWED）
   * - 联动：下架商品→违规下架；封禁用户→禁用+tokenVersion+1（吊销Token）；删除留言→标记已删除
   * - 驳回举报 → 已驳回（说明必填）；其余 → 已处理
   */
  async handle(adminId: number, id: number, dto: HandleReportDto) {
    const report = await this.reportRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!report) throw new NotFoundException('举报不存在');
    if (report.status !== '待处理') {
      throw new ConflictException(`该举报已处理，当前状态：${report.status}`);
    }
    if (!ACTION_ALLOWED[report.targetType].includes(dto.action)) {
      throw new BadRequestException(
        `该处理动作不适用于${report.targetType}类举报，可选：${ACTION_ALLOWED[report.targetType].join('/')}`,
      );
    }
    if (dto.action === '驳回举报' && !dto.result?.trim()) {
      throw new BadRequestException('驳回举报时必须填写处理说明');
    }

    const next = dto.action === '驳回举报' ? '已驳回' : '已处理';
    const resultText = dto.result?.trim() || null;

    await this.dataSource.transaction(async (manager) => {
      const updated = await manager.update(
        Report,
        { id, status: '待处理', isDeleted: false },
        {
          status: next,
          handleAction: dto.action,
          handleResult: resultText,
          handlerId: adminId,
          handleTime: new Date(),
        },
      );
      if (!updated.affected) {
        throw new ConflictException('该举报已被其他管理员处理');
      }

      // 联动处置（仅当目标仍处于可处置状态时生效，幂等安全）
      switch (dto.action) {
        case '下架商品':
          await manager
            .createQueryBuilder()
            .update(Goods)
            .set({
              status: '违规下架',
              rejectReason: resultText ?? '举报成立，违规下架',
              version: () => 'version + 1',
            })
            .where("id = :tid AND is_deleted = 0 AND status IN ('在售','已下架')", {
              tid: report.targetId,
            })
            .execute();
          break;
        case '封禁用户': {
          const target = await manager.findOne(User, {
            where: { id: report.targetId, isDeleted: false },
          });
          if (target?.role === 'admin') {
            throw new BadRequestException('不能封禁管理员账号');
          }
          // 禁用 + tokenVersion+1：已发 Token 全量失效（守卫实时校验）
          await manager
            .createQueryBuilder()
            .update(User)
            .set({ status: '禁用', tokenVersion: () => 'token_version + 1' })
            .where("id = :tid AND is_deleted = 0 AND status = '正常'", {
              tid: report.targetId,
            })
            .execute();
          break;
        }
        case '删除留言':
          await manager.update(
            MessageComment,
            { id: report.targetId, status: '正常', isDeleted: false },
            { status: '已删除' },
          );
          break;
        // 警告用户 / 驳回举报：仅留痕，无目标状态变更
      }
    });

    return { id, status: next, handleAction: dto.action };
  }

  /** 多态目标存在性校验，返回目标归属人ID（用于禁止举报自己） */
  private async assertTargetExists(type: TargetType, id: number) {
    switch (type) {
      case '商品': {
        const g = await this.goodsRepo.findOne({ where: { id, isDeleted: false } });
        if (!g) throw new NotFoundException('举报的商品不存在');
        return g.userId;
      }
      case '求购': {
        const w = await this.wantRepo.findOne({ where: { id, isDeleted: false } });
        if (!w) throw new NotFoundException('举报的求购不存在');
        return w.userId;
      }
      case '用户': {
        const u = await this.userRepo.findOne({ where: { id, isDeleted: false } });
        if (!u) throw new NotFoundException('举报的用户不存在');
        return u.id;
      }
      case '留言': {
        const c = await this.commentRepo.findOne({
          where: { id, status: '正常', isDeleted: false },
        });
        if (!c) throw new NotFoundException('举报的留言不存在');
        return c.userId;
      }
    }
  }
}
