import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 订单状态（与 order_info.status CHECK 约束一致） */
export const ORDER_STATUSES = ['待沟通', '待交易', '已完成', '已取消'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * 订单状态机：
 * 待沟通 --confirm--> 待交易 --complete--> 已完成（终态，同事务联动商品置已售出）
 * 待沟通/待交易 --cancel--> 已取消（终态）
 * 已完成/已取消 任何流转 → 409
 */
@Entity('order_info')
export class OrderInfo {
  /** SQLite：INTEGER PRIMARY KEY AUTOINCREMENT，驱动读出即 number */
  @PrimaryGeneratedColumn()
  id: number;

  /** 订单号：XY+yyyyMMddHHmmss+6位随机，全局唯一 */
  @Column({ name: 'order_no', unique: true })
  orderNo: string;

  @Column({ name: 'goods_id', type: 'integer', nullable: true })
  goodsId: number | null;

  @Column({ name: 'want_id', type: 'integer', nullable: true })
  wantId: number | null;

  @Column({ name: 'buyer_id', type: 'integer' })
  buyerId: number;

  @Column({ name: 'seller_id', type: 'integer' })
  sellerId: number;

  /** SQLite 无 ENUM，取值由 init.sql CHECK 约束 + class-validator 双层保证 */
  @Column({ type: 'text', default: '待沟通' })
  status: OrderStatus;

  @Column({ name: 'appointment_time', type: 'datetime', nullable: true })
  appointmentTime: Date | null;

  @Column({ name: 'appointment_place', nullable: true })
  appointmentPlace: string;

  @Column({ nullable: true })
  remark: string;

  /** 乐观锁版本号（并发流转仅一次生效） */
  @Column({ default: 0 })
  version: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;
}
