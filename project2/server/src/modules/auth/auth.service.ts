import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { maskStudentNo } from '../../common/utils/mask.util';
import { comparePassword, hashPassword } from '../../common/utils/bcrypt.util';
import { TokenBlacklistService } from '../../common/auth/token-blacklist.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly blacklist: TokenBlacklistService,
  ) {}

  /** 注册：学号唯一（409），密码 bcrypt 加密 */
  async register(dto: RegisterDto): Promise<{ userId: number }> {
    const exists = await this.userRepo.findOne({
      where: { studentNo: dto.studentNo, isDeleted: false },
    });
    if (exists) throw new ConflictException('该学号已注册');

    const user = this.userRepo.create({
      studentNo: dto.studentNo,
      passwordHash: await hashPassword(dto.password),
      nickname: dto.nickname,
      phone: dto.phone ?? null,
      role: 'student',
    });
    const saved = await this.userRepo.save(user);
    return { userId: saved.id };
  }

  /** 登录：校验密码 → 签发 JWT（载荷含 tokenVersion，改密/禁用后旧 Token 失效） */
  async login(dto: LoginDto) {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.studentNo = :no AND u.isDeleted = 0', { no: dto.studentNo })
      .getOne();

    if (!user || !(await comparePassword(dto.password, user.passwordHash))) {
      throw new BadRequestException('学号或密码错误');
    }
    if (user.status === '禁用') {
      throw new ForbiddenException('账号已被禁用，请联系管理员');
    }

    const payload = {
      id: user.id,
      studentNo: user.studentNo,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };
    const token = await this.jwtService.signAsync(payload);
    return {
      token,
      expiresIn: this.parseExpiresIn(),
      user: this.buildUserSummary(user),
    };
  }

  /** 退出登录：Token 加入黑名单 */
  logout(token: string): void {
    const decoded = this.jwtService.decode(token) as { exp?: number } | null;
    const expiresAtMs = decoded?.exp ? decoded.exp * 1000 : Date.now() + 2 * 3600 * 1000;
    this.blacklist.add(token, expiresAtMs);
  }

  /** 对外用户摘要：学号脱敏，永不返回密码哈希/手机号 */
  buildUserSummary(user: User) {
    return {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      college: user.college,
      isCertified: user.isCertified,
      role: user.role,
      studentNoMasked: maskStudentNo(user.studentNo),
    };
  }

  /** '2h'/'30m'/'7200' → 秒数 */
  private parseExpiresIn(): number {
    const raw = this.config.get<string>('JWT_EXPIRES_IN', '2h');
    const m = /^(\d+)([smh]?)$/.exec(raw);
    if (!m) return 7200;
    const n = Number(m[1]);
    return m[2] === 'h' ? n * 3600 : m[2] === 'm' ? n * 60 : n;
  }
}
