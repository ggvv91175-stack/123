import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Goods } from '../goods/entities/goods.entity';
import {
  AdminCategoryQueryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/category.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Goods)
    private readonly goodsRepo: Repository<Goods>,
  ) {}

  /** 公开分类列表：仅启用，按 sortOrder 正序 */
  async publicList() {
    return this.categoryRepo.find({
      where: { status: '启用', isDeleted: false },
      order: { sortOrder: 'ASC', id: 'ASC' },
      select: ['id', 'name', 'sortOrder'],
    });
  }

  /** 管理员分类列表：含停用，分页 */
  async adminList(query: AdminCategoryQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));

    const [list, total] = await this.categoryRepo.findAndCount({
      where: {
        isDeleted: false,
        ...(query.status ? { status: query.status } : {}),
      },
      order: { sortOrder: 'ASC', id: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { list, total, page, pageSize };
  }

  /** 新增分类：分类名全局唯一（含已删除记录，因 uk_category_name 物理唯一） */
  async create(dto: CreateCategoryDto) {
    const name = dto.name.trim();
    // 查全表（含逻辑删除），避免撞唯一索引返回 500
    const exists = await this.categoryRepo.findOne({ where: { name } });
    if (exists) throw new ConflictException('分类名已被占用');

    const category = this.categoryRepo.create({
      name,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.categoryRepo.save(category);
  }

  /** 编辑分类：改名需查重；停用不影响历史商品 */
  async update(id: number, dto: UpdateCategoryDto) {
    const category = await this.categoryRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!category) throw new NotFoundException('分类不存在');

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name !== category.name) {
        const exists = await this.categoryRepo.findOne({ where: { name } });
        if (exists) throw new ConflictException('分类名已被占用');
        category.name = name;
      }
    }
    if (dto.sortOrder !== undefined) category.sortOrder = dto.sortOrder;
    if (dto.status !== undefined) category.status = dto.status;

    return this.categoryRepo.save(category);
  }

  /** 删除分类（逻辑删）：存在未删除商品引用时拒绝 */
  async remove(id: number) {
    const category = await this.categoryRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!category) throw new NotFoundException('分类不存在');

    const refCount = await this.goodsRepo.count({
      where: { categoryId: id, isDeleted: false },
    });
    if (refCount > 0) {
      throw new ConflictException('该分类已被商品引用，无法删除');
    }

    category.isDeleted = true;
    await this.categoryRepo.save(category);
    return { id };
  }
}
