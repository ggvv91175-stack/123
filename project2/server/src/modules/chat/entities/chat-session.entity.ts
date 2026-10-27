import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 私聊会话（goods_id / want_id 互斥可空）：
 * - 商品发起：填 goods_id（阶段5实现）
 * - 求购接单：填 want_id，buyer_id=求购者，seller_id=接单人（阶段4实现）
 * 唯一键 uk_session_want (want_id, buyer_id) 保证同一求购仅一条会话。
 */
@Entity('chat_session')
export class ChatSession {
  /** SQLite：INTEGER PRIMARY KEY AUTOINCREMENT，驱动读出即 number */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'goods_id', type: 'integer', nullable: true })
  goodsId: number;

  @Column({ name: 'want_id', type: 'integer', nullable: true })
  wantId: number;

  @Column({ name: 'buyer_id', type: 'integer' })
  buyerId: number;

  @Column({ name: 'seller_id', type: 'integer' })
  sellerId: number;

  @Column({ name: 'last_message_time', type: 'datetime', nullable: true })
  lastMessageTime: Date;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;
}
