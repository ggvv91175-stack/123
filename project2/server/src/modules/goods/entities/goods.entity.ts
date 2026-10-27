import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const CONDITION_LEVELS = ['全新', '几乎全新', '轻微使用', '明显使用痕迹'] as const;
export const CAMPUSES = ['东区', '西区', '南区', '北区'] as const;
export const TRADE_METHODS = ['当面交易', '宿舍自提', '校内其他'] as const;

export type ConditionLevel = (typeof CONDITION_LEVELS)[number];
export type Campus = (typeof CAMPUSES)[number];
export type TradeMethod = (typeof TRADE_METHODS)[number];

/**
 * 商品状态机：
 * 待审核 --审核通过--> 在售
 * 待审核 --驳回--> 已驳回（可编辑重提）
 * 在售 <--上架/下架--> 已下架
 * 在售/已下架 --标记已售出--> 已售出（终态）
 * 在售/已下架 --管理员违规下架--> 违规下架（终态，不可重提）
 */
export type GoodsStatus = '待审核' | '已驳回' | '在售' | '已下架' | '已售出' | '违规下架';

@Entity('goods')
export class Goods {
  /** SQLite：INTEGER PRIMARY KEY AUTOINCREMENT，驱动读出即 number */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column()
  title: string;

  /** SQLite：REAL 存储价格；金额精度由 class-validator（两位小数/上下限）保证 */
  @Column({ type: 'real' })
  price: number;

  @Column({ name: 'category_id', type: 'integer' })
  categoryId: number;

  /** SQLite 无 ENUM，取值由 init.sql CHECK 约束 + class-validator 双层保证 */
  @Column({ name: 'condition_level', type: 'text' })
  conditionLevel: ConditionLevel;

  @Column({ type: 'text' })
  campus: Campus;

  @Column({ name: 'trade_method', type: 'text' })
  tradeMethod: TradeMethod;

  @Column({ type: 'text' })
  description: string;

  /** SQLite 无 JSON 列类型，simple-json 序列化为 TEXT 存取 */
  @Column({ type: 'simple-json', nullable: true })
  images: string[];

  @Column({ type: 'text', default: '待审核' })
  status: GoodsStatus;

  @Column({ name: 'reject_reason', nullable: true })
  rejectReason: string;

  @Column({ default: 0 })
  version: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;
}
