import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 举报目标类型（与 report.target_type CHECK 约束一致，多态不建外键） */
export const TARGET_TYPES = ['商品', '求购', '用户', '留言'] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

/** 举报状态 */
export const REPORT_STATUSES = ['待处理', '已处理', '已驳回'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** 处理动作 */
export const HANDLE_ACTIONS = [
  '下架商品',
  '封禁用户',
  '删除留言',
  '警告用户',
  '驳回举报',
] as const;
export type HandleAction = (typeof HANDLE_ACTIONS)[number];

/**
 * 举报（target 多态：商品/用户/留言/求购）：
 * - 重复待处理举报由应用层去重（同举报人+类型+目标 存在待处理 → 409）
 * - 处理动作与目标类型匹配校验在应用层完成
 */
@Entity('report')
export class Report {
  /** SQLite：INTEGER PRIMARY KEY AUTOINCREMENT，驱动读出即 number */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reporter_id', type: 'integer' })
  reporterId: number;

  @Column({ name: 'target_type', type: 'text' })
  targetType: TargetType;

  @Column({ name: 'target_id', type: 'integer' })
  targetId: number;

  @Column({ type: 'text' })
  reason: string;

  /** SQLite 无 JSON 列类型：simple-json 序列化为 TEXT */
  @Column({ name: 'evidence_images', type: 'simple-json', nullable: true })
  evidenceImages: string[] | null;

  @Column({ type: 'text', default: '待处理' })
  status: ReportStatus;

  @Column({ name: 'handle_action', type: 'text', nullable: true })
  handleAction: HandleAction | null;

  @Column({ name: 'handle_result', nullable: true })
  handleResult: string | null;

  @Column({ name: 'handler_id', type: 'integer', nullable: true })
  handlerId: number | null;

  @Column({ name: 'handle_time', type: 'datetime', nullable: true })
  handleTime: Date | null;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;
}
