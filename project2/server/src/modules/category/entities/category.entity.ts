import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CategoryStatus = '启用' | '停用';

@Entity('category')
export class Category {
  /** SQLite：INTEGER PRIMARY KEY AUTOINCREMENT，驱动读出即 number */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  /** SQLite 无 ENUM，取值由 init.sql CHECK 约束 + class-validator 双层保证 */
  @Column({ type: 'text', default: '启用' })
  status: CategoryStatus;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;
}
