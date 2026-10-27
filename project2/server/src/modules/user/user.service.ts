import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { comparePassword, hashPassword } from '../../common/utils/bcrypt.util';
import { RealAuth } from './entities/real-auth.entity';
import { User } from './entities/user.entity';
import {
  ChangePasswordDto,
  SubmitCertificationDto,
  UpdateProfileDto,
} from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(RealAuth)
    private readonly realAuthRepo: Repository<RealAuth>,
  ) {}

  /** 个人信息（本人可见完整学号/手机号） */
  async getMe(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId, isDeleted: false } });
    if (!user) throw new NotFoundException('用户不存在');
    return {
      id: user.id,
      studentNo: user.studentNo,
      nickname: user.nickname,
      college: user.college,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
      isCertified: user.isCertified,
      createTime: user.createTime,
    };
  }

  /** 修改昵称/头像/学院（学号/角色/状态不可改） */
  async updateMe(userId: number, dto: UpdateProfileDto) {
    const user = await this.userRepo.findOne({ where: { id: userId, isDeleted: false } });
    if (!user) throw new NotFoundException('用户不存在');
    if (dto.nickname !== undefined) user.nickname = dto.nickname;
    if (dto.avatar !== undefined) user.avatar = dto.avatar;
    if (dto.college !== undefined) user.college = dto.college;
    await this.userRepo.save(user);
    return {};
  }

  /** 修改密码：校验原密码；成功后 tokenVersion+1 → 全部旧 Token 失效 */
  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id AND u.isDeleted = 0', { id: userId })
      .getOne();
    if (!user) throw new NotFoundException('用户不存在');

    if (!(await comparePassword(dto.oldPassword, user.passwordHash))) {
      throw new BadRequestException('原密码错误');
    }
    if (dto.oldPassword === dto.newPassword) {
      throw new BadRequestException('新密码不能与原密码相同');
    }
    user.passwordHash = await hashPassword(dto.newPassword);
    user.tokenVersion = user.tokenVersion + 1;
    await this.userRepo.save(user);
    return {};
  }

  /**
   * 提交实名认证：未认证 → 审核中
   * 已存在"待审核/已通过"记录 → 409；已驳回允许重新提交（插入新行，留痕）
   */
  async submitCertification(userId: number, dto: SubmitCertificationDto) {
    const latest = await this.getLatestCertification(userId);
    if (latest && latest.status !== '已驳回') {
      throw new ConflictException(`请勿重复提交，当前认证状态：${latest.status}`);
    }
    const record = this.realAuthRepo.create({
      userId,
      studentNo: dto.studentNo,
      college: dto.college,
      proofImages: dto.proofImages,
      status: '待审核',
    });
    const saved = await this.realAuthRepo.save(record);
    return { certificationId: saved.id };
  }

  /** 查询本人最新一条认证记录（无记录返回 null） */
  async getMyCertification(userId: number) {
    const latest = await this.getLatestCertification(userId);
    if (!latest) return null;
    return {
      id: latest.id,
      studentNo: latest.studentNo,
      college: latest.college,
      proofImages: latest.proofImages,
      status: latest.status,
      rejectReason: latest.rejectReason,
      reviewTime: latest.reviewTime,
      createTime: latest.createTime,
    };
  }

  private getLatestCertification(userId: number) {
    return this.realAuthRepo.findOne({
      where: { userId, isDeleted: false },
      order: { createTime: 'DESC' },
    });
  }
}
