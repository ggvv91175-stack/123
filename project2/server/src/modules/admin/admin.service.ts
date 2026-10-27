import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Goods } from '../goods/entities/goods.entity';
import { Report } from '../report/entities/report.entity';
import { RealAuth } from '../user/entities/real-auth.entity';
import { User } from '../user/entities/user.entity';
import { WantBuy } from '../want/entities/want-buy.entity';
import { QueryUserDto, UpdateUserStatusDto } from './dto/admin-user.dto';
import { QueryAdminWantDto } from './dto/admin-want.dto';
import { CertListQueryDto, ReviewCertificationDto } from './dto/review-certification.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(RealAuth)
    private readonly realAuthRepo: Repository<RealAuth>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Goods)
    private readonly goodsRepo: Repository<Goods>,
    @InjectRepository(WantBuy)
    private readonly wantRepo: Repository<WantBuy>,
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    private readonly dataSource: DataSource,
  ) {}

  /** 认证审核列表：默认待审核，按提交时间正序（先提先审），附申请人摘要 */
  async certificationList(query: CertListQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));
    const status = query.status ?? '待审核';

    const [records, total] = await this.realAuthRepo.findAndCount({
      where: { status, isDeleted: false },
      order: { createTime: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const userIds = [...new Set(records.map((r) => r.userId))];
    const users = userIds.length
      ? await this.userRepo.findBy({ id: In(userIds) })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      list: records.map((r) => ({
        id: r.id,
        userId: r.userId,
        studentNo: r.studentNo,
        college: r.college,
        proofImages: r.proofImages,
        status: r.status,
        rejectReason: r.rejectReason,
        reviewTime: r.reviewTime,
        createTime: r.createTime,
        applicant: userMap.get(r.userId)
          ? { nickname: userMap.get(r.userId)!.nickname, avatar: userMap.get(r.userId)!.avatar }
          : null,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 审核实名认证：
   * - 通过 → 认证记录置"已通过" + user.is_certified=1（同事务）
   * - 驳回 → 必须填写驳回理由，记录留痕回显
   * - 非"待审核"记录重复审核 → 409
   */
  async reviewCertification(adminId: number, id: number, dto: ReviewCertificationDto) {
    if (dto.result === 'reject' && !dto.reason?.trim()) {
      throw new BadRequestException('驳回时必须填写驳回理由');
    }

    await this.dataSource.transaction(async (manager) => {
      const cert = await manager.findOne(RealAuth, { where: { id, isDeleted: false } });
      if (!cert) throw new NotFoundException('认证记录不存在');
      if (cert.status !== '待审核') {
        throw new ConflictException(`该认证已审核，当前状态：${cert.status}`);
      }

      cert.status = dto.result === 'pass' ? '已通过' : '已驳回';
      cert.rejectReason = dto.result === 'reject' ? dto.reason!.trim() : null;
      cert.reviewerId = adminId;
      cert.reviewTime = new Date();
      await manager.save(cert);

      if (dto.result === 'pass') {
        await manager.update(
          User,
          { id: cert.userId, isDeleted: false },
          { isCertified: true, college: cert.college },
        );
      }
    });

    return { status: dto.result === 'pass' ? '已通过' : '已驳回' };
  }

  // ---------------- 用户管理 ----------------

  /**
   * 用户列表（admin）：
   * - 关键词模糊匹配学号/昵称；状态/角色/实名筛选；按注册时间倒序
   * - password_hash 由实体 select:false 保证不泄露
   */
  async userList(query: QueryUserDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));

    const qb = this.userRepo
      .createQueryBuilder('u')
      .where('u.is_deleted = 0');
    if (query.keyword) {
      qb.andWhere('(u.student_no LIKE :kw OR u.nickname LIKE :kw)', {
        kw: `%${query.keyword}%`,
      });
    }
    if (query.status) qb.andWhere('u.status = :st', { st: query.status });
    if (query.role) qb.andWhere('u.role = :role', { role: query.role });
    if (query.isCertified !== undefined) {
      qb.andWhere('u.is_certified = :ic', { ic: query.isCertified ? 1 : 0 });
    }

    const [list, total] = await qb
      .orderBy('u.create_time', 'DESC')
      .addOrderBy('u.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { list, total, page, pageSize };
  }

  /**
   * 禁用/解禁账号（admin）：
   * - 不能操作管理员账号 → 400
   * - 禁用：status=禁用 且 tokenVersion+1（守卫实时校验，已发 Token 全量失效）
   * - 幂等校验：已是目标状态 → 409
   */
  async updateUserStatus(id: number, dto: UpdateUserStatusDto) {
    const user = await this.userRepo.findOne({ where: { id, isDeleted: false } });
    if (!user) throw new NotFoundException('用户不存在');
    if (user.role === 'admin') {
      throw new BadRequestException('不能操作管理员账号');
    }

    const to = dto.action === 'disable' ? '禁用' : '正常';
    if (user.status === to) {
      throw new ConflictException(`该账号已是${to}状态`);
    }

    if (dto.action === 'disable') {
      await this.userRepo
        .createQueryBuilder()
        .update(User)
        .set({ status: '禁用', tokenVersion: () => 'token_version + 1' })
        .where('id = :id', { id })
        .execute();
    } else {
      // 解禁不回落 tokenVersion（旧 Token 本就失效，重新登录即可）
      await this.userRepo.update({ id }, { status: '正常' });
    }
    return { id, status: to };
  }

  // ---------------- 求购管理 ----------------

  /**
   * 求购列表（admin）：关键词模糊匹配名称/备注；状态筛选；按创建时间倒序，附发布者摘要
   */
  async wantList(query: QueryAdminWantDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));

    const qb = this.wantRepo
      .createQueryBuilder('w')
      .where('w.is_deleted = 0');
    if (query.keyword) {
      qb.andWhere('(w.item_name LIKE :kw OR w.remark LIKE :kw)', {
        kw: `%${query.keyword}%`,
      });
    }
    if (query.status) qb.andWhere('w.status = :st', { st: query.status });

    const [records, total] = await qb
      .orderBy('w.create_time', 'DESC')
      .addOrderBy('w.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const userIds = [...new Set(records.map((r) => r.userId))];
    const users = userIds.length
      ? await this.userRepo.findBy({ id: In(userIds) })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      list: records.map((w) => ({
        ...w,
        publisher: userMap.get(w.userId)
          ? {
              nickname: userMap.get(w.userId)!.nickname,
              avatar: userMap.get(w.userId)!.avatar,
              isCertified: userMap.get(w.userId)!.isCertified,
            }
          : null,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 违规下架求购（admin）：待接单 → 已关闭（复用现有状态机，无新增状态，避免改 CHECK 约束）
   * - 条件更新防并发；已接单/已关闭 → 409
   */
  async takedownWant(id: number) {
    const updated = await this.wantRepo.update(
      { id, isDeleted: false, status: '待接单' },
      { status: '已关闭' },
    );

    if (!updated.affected) {
      const want = await this.wantRepo.findOne({ where: { id, isDeleted: false } });
      if (!want) throw new NotFoundException('求购不存在');
      throw new ConflictException(
        `该求购当前状态（${want.status}）不可下架，仅待接单可下架`,
      );
    }
    return { id, status: '已关闭' };
  }

  // ---------------- 数据看板 ----------------

  /** 平台数据看板（admin）：用户/商品/求购总量与待办（待审核认证、待审核商品、待处理举报） */
  async dashboardStats() {
    const [
      userTotal,
      goodsTotal,
      goodsOnSale,
      wantTotal,
      wantOpen,
      pendingCertifications,
      pendingGoods,
      pendingReports,
    ] = await Promise.all([
      this.userRepo.count({ where: { isDeleted: false } }),
      this.goodsRepo.count({ where: { isDeleted: false } }),
      this.goodsRepo.count({ where: { isDeleted: false, status: '在售' } }),
      this.wantRepo.count({ where: { isDeleted: false } }),
      this.wantRepo.count({ where: { isDeleted: false, status: '待接单' } }),
      this.realAuthRepo.count({ where: { isDeleted: false, status: '待审核' } }),
      this.goodsRepo.count({ where: { isDeleted: false, status: '待审核' } }),
      this.reportRepo.count({ where: { isDeleted: false, status: '待处理' } }),
    ]);

    return {
      userTotal,
      goodsTotal,
      goodsOnSale,
      wantTotal,
      wantOpen,
      pending: {
        certifications: pendingCertifications,
        goods: pendingGoods,
        reports: pendingReports,
      },
    };
  }
}
