import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 留言状态（与 message_comment.status CHECK 约束一致）：删除为标记不物理删 */
export const COMMENT_STATUSES = ['正常', '已删除'] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];

/**
 * 商品留言（两层结构）：
 * - 顶层留言：parentId = null
 * - 回复：parentId = 顶层留言ID；回复的回复平铺到同一顶层下
 * - replyToUserId：直接被回复人（冗余，便于"xx 回复 yy"展示）
 */
@Entity('message_comment')
export class MessageComment {
  /** SQLite：INTEGER PRIMARY KEY AUTOINCREMENT，驱动读出即 number */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'goods_id', type: 'integer' })
  goodsId: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ name: 'parent_id', type: 'integer', nullable: true })
  parentId: number | null;

  @Column({ name: 'reply_to_user_id', type: 'integer', nullable: true })
  replyToUserId: number | null;

  @Column({ type: 'text' })
  content: string;

  /** SQLite 无 ENUM，取值由 init.sql CHECK 约束 + 应用层双层保证 */
  @Column({ type: 'text', default: '正常' })
  status: CommentStatus;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;
}
