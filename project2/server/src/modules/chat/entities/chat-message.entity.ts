import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 消息类型（与 chat_message.msg_type CHECK 约束一致） */
export const MSG_TYPES = ['文本', '图片'] as const;
export type MsgType = (typeof MSG_TYPES)[number];

/**
 * 私聊消息：
 * - 接收人不落库，由会话双方推导（接收人 = 会话中非发送方）
 * - 已读标记：接收人拉取历史消息时置 is_read=1
 */
@Entity('chat_message')
export class ChatMessage {
  /** SQLite：INTEGER PRIMARY KEY AUTOINCREMENT，驱动读出即 number */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'session_id', type: 'integer' })
  sessionId: number;

  @Column({ name: 'sender_id', type: 'integer' })
  senderId: number;

  @Column({ type: 'text' })
  content: string;

  /** SQLite 无 ENUM，取值由 init.sql CHECK 约束 + class-validator 双层保证 */
  @Column({ name: 'msg_type', type: 'text', default: '文本' })
  msgType: MsgType;

  /** SQLite：boolean 落库为 0/1，TypeORM 自动转换 */
  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;
}
