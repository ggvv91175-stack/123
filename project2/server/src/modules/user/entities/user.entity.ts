import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user')
export class User {
  /** SQLite：INTEGER PRIMARY KEY AUTOINCREMENT，驱动读出即 number */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'student_no', unique: true })
  studentNo: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column()
  nickname: string;

  @Column({ nullable: true })
  college: string;

  @Column({ nullable: true })
  phone: string;

  /** SQLite 无 ENUM，取值由 init.sql CHECK 约束 + class-validator 双层保证 */
  @Column({ type: 'text', default: 'student' })
  role: 'admin' | 'student';

  @Column({ type: 'text', default: '正常' })
  status: '正常' | '禁用';

  @Column({ nullable: true })
  avatar: string;

  /** SQLite：boolean 落库为 0/1，TypeORM 自动转换 */
  @Column({ name: 'is_certified', type: 'boolean', default: false })
  isCertified: boolean;

  @Column({ name: 'token_version', default: 0 })
  tokenVersion: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;
}
