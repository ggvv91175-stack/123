import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  CAMPUSES,
  CONDITION_LEVELS,
  Campus,
  ConditionLevel,
} from '../../goods/entities/goods.entity';

/** 求购状态（与 want_buy.status CHECK 约束一致） */
export const WANT_STATUSES = ['待接单', '已接单', '已关闭'] as const;
export type WantStatus = (typeof WANT_STATUSES)[number];

/**
 * 求购状态机：
 * 待接单 --卖家接单--> 已接单（终态，同事务自动创建 chat_session）
 * 待接单 --本人关闭--> 已关闭（终态）
 * 已接单/已关闭 --编辑/关闭/接单--> 409
 */
@Entity('want_buy')
export class WantBuy {
  /** SQLite：INTEGER PRIMARY KEY AUTOINCREMENT，驱动读出即 number */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ name: 'item_name' })
  itemName: string;

  /** SQLite：REAL 存储预算；精度由 class-validator（两位小数/上下限）保证 */
  @Column({ type: 'real' })
  budget: number;

  /** SQLite 无 ENUM，取值由 init.sql CHECK 约束 + class-validator 双层保证 */
  @Column({ name: 'expected_condition', type: 'text', nullable: true })
  expectedCondition: ConditionLevel;

  @Column({ type: 'text', nullable: true })
  campus: Campus;

  @Column({ nullable: true })
  remark: string;

  @Column({ type: 'text', default: '待接单' })
  status: WantStatus;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;
}
