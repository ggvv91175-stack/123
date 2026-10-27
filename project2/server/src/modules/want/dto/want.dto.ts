import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { CAMPUSES, CONDITION_LEVELS } from '../../goods/entities/goods.entity';
import { WANT_STATUSES } from '../entities/want-buy.entity';

/** 查询参数空值处理：原始值为空串/纯空白 → undefined（用原始值判断，避免隐式转换把 '' 变成 0） */
const emptyToUndefined = ({ value, obj, key }: any) => {
  const raw = obj?.[key];
  return typeof raw === 'string' && raw.trim() === '' ? undefined : value;
};

/** 关键词：去首尾空白，空串视为未传 */
const normalizeKeyword = ({ value, obj, key }: any) => {
  const raw = typeof obj?.[key] === 'string' ? obj[key] : value;
  return typeof raw === 'string' ? raw.trim() || undefined : value;
};

export class CreateWantDto {
  @ApiProperty({ description: '物品名称（≤50字符）', example: '求购高等数学教材（同济第七版）' })
  @IsNotEmpty({ message: '物品名称不能为空' })
  @Length(1, 50, { message: '物品名称长度须为1~50字符' })
  itemName: string;

  @ApiProperty({ description: '预算（元），0.01~999999.99', example: 30 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '预算必须为数字，最多两位小数' })
  @Min(0.01, { message: '预算最小为0.01元' })
  @Max(999999.99, { message: '预算最大为999999.99元' })
  budget: number;

  @ApiPropertyOptional({ description: '期望成色（可选）', enum: CONDITION_LEVELS, example: '几乎全新' })
  @IsOptional()
  @IsIn(CONDITION_LEVELS, { message: '期望成色取值不合法' })
  expectedCondition?: (typeof CONDITION_LEVELS)[number];

  @ApiPropertyOptional({ description: '校区（可选）', enum: CAMPUSES, example: '东区' })
  @IsOptional()
  @IsIn(CAMPUSES, { message: '校区取值不合法' })
  campus?: (typeof CAMPUSES)[number];

  @ApiPropertyOptional({ description: '描述/备注（≤500字符）', example: '希望无笔记，东区图书馆面交' })
  @IsOptional()
  @IsString({ message: '描述必须为字符串' })
  @Length(0, 500, { message: '描述长度须为0~500字符' })
  remark?: string;
}

/** 编辑为全量更新，字段与创建一致；服务端仅允许「待接单」状态编辑 */
export class UpdateWantDto extends CreateWantDto {}

export class MyWantQueryDto {
  @ApiPropertyOptional({ description: '状态筛选，不传查全部', enum: WANT_STATUSES })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(WANT_STATUSES, { message: '状态取值不合法' })
  status?: (typeof WANT_STATUSES)[number];

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

export class QueryWantDto {
  @ApiPropertyOptional({ description: '关键词（命中物品名称或描述，模糊匹配）' })
  @Transform(normalizeKeyword)
  @IsOptional()
  @IsString()
  @Length(1, 50, { message: '关键词长度须为1~50字符' })
  keyword?: string;

  @ApiPropertyOptional({ description: '状态筛选，默认待接单', enum: WANT_STATUSES })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(WANT_STATUSES, { message: '状态取值不合法' })
  status?: (typeof WANT_STATUSES)[number];

  @ApiPropertyOptional({ description: '校区', enum: CAMPUSES })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(CAMPUSES, { message: '校区取值不合法' })
  campus?: (typeof CAMPUSES)[number];

  @ApiPropertyOptional({ description: '期望成色', enum: CONDITION_LEVELS })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(CONDITION_LEVELS, { message: '期望成色取值不合法' })
  expectedCondition?: (typeof CONDITION_LEVELS)[number];

  @ApiPropertyOptional({ description: '最低预算（元）' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '最低预算必须为数字' })
  @Min(0, { message: '最低预算不能为负数' })
  minBudget?: number;

  @ApiPropertyOptional({ description: '最高预算（元）' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '最高预算必须为数字' })
  @Min(0, { message: '最高预算不能为负数' })
  maxBudget?: number;

  @ApiPropertyOptional({
    description: '排序：time=时间倒序（默认） budget_asc budget_desc',
    enum: ['time', 'budget_asc', 'budget_desc'],
  })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(['time', 'budget_asc', 'budget_desc'], { message: '排序取值不合法' })
  sort?: 'time' | 'budget_asc' | 'budget_desc';

  @ApiPropertyOptional({ description: '页码，默认1', example: 1 })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsInt({ message: '页码必须为整数' })
  @Min(1, { message: '页码最小为1' })
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页条数，默认10，最大50', example: 10 })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsInt({ message: '每页条数必须为整数' })
  @Min(1, { message: '每页条数最小为1' })
  pageSize?: number = 10;
}
