import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CertStatus = '待审核' | '已通过' | '已驳回';

@Entity('real_auth')
export class RealAuth {
  /** SQLite：INTEGER PRIMARY KEY AUTOINCREMENT，驱动读出即 number */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ name: 'student_no' })
  studentNo: string;

  @Column()
  college: string;

  /** SQLite 无 JSON 列类型，simple-json 序列化为 TEXT 存取 */
  @Column({ name: 'proof_images', type: 'simple-json', nullable: true })
  proofImages: string[];

  /** SQLite 无 ENUM，取值由 init.sql CHECK 约束 + class-validator 双层保证 */
  @Column({ type: 'text', default: '待审核' })
  status: CertStatus;

  @Column({ name: 'reject_reason', nullable: true })
  rejectReason: string;

  @Column({ name: 'reviewer_id', type: 'integer', nullable: true })
  reviewerId: number;

  @Column({ name: 'review_time', type: 'datetime', nullable: true })
  reviewTime: Date;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;
}
