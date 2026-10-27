import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Length, Max, Min } from 'class-validator';

/** 分类状态枚举（与 category 表 CHECK 一致） */
export const CATEGORY_STATUSES = ['启用', '停用'] as const;

export class CreateCategoryDto {
  @ApiProperty({ description: '分类名（≤32字符，全局唯一）', example: '数码配件' })
  @Length(1, 32, { message: '分类名长度须为1~32字符' })
  name: string;

  @ApiPropertyOptional({ description: '展示排序（小在前），默认0', example: 6 })
  @IsOptional()
  @IsInt({ message: '排序必须为整数' })
  @Min(0, { message: '排序不能为负数' })
  @Max(999999, { message: '排序过大' })
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: '分类名（≤32字符，全局唯一）' })
  @IsOptional()
  @Length(1, 32, { message: '分类名长度须为1~32字符' })
  name?: string;

  @ApiPropertyOptional({ description: '展示排序（小在前）' })
  @IsOptional()
  @IsInt({ message: '排序必须为整数' })
  @Min(0, { message: '排序不能为负数' })
  @Max(999999, { message: '排序过大' })
  sortOrder?: number;

  @ApiPropertyOptional({ description: '状态：启用/停用', enum: CATEGORY_STATUSES })
  @IsOptional()
  @IsIn(CATEGORY_STATUSES, { message: '状态取值不合法' })
  status?: (typeof CATEGORY_STATUSES)[number];
}

export class AdminCategoryQueryDto {
  @ApiPropertyOptional({ description: '状态筛选：启用/停用，不传查全部', enum: CATEGORY_STATUSES })
  @IsOptional()
  @IsIn(CATEGORY_STATUSES, { message: '状态取值不合法' })
  status?: (typeof CATEGORY_STATUSES)[number];

  @ApiPropertyOptional({ description: '页码，默认1', example: 1 })
  @IsOptional()
  @IsInt({ message: '页码必须为整数' })
  @Min(1, { message: '页码最小为1' })
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页条数，默认10，最大50', example: 10 })
  @IsOptional()
  @IsInt({ message: '每页条数必须为整数' })
  @Min(1, { message: '每页条数最小为1' })
  pageSize?: number = 10;
}
