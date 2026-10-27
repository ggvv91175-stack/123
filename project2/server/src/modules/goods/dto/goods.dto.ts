import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
} from 'class-validator';
import {
  CAMPUSES,
  CONDITION_LEVELS,
  TRADE_METHODS,
} from '../entities/goods.entity';

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

/** 商品状态枚举（与 goods 表一致） */
export const GOODS_STATUSES = ['待审核', '已驳回', '在售', '已下架', '已售出', '违规下架'] as const;

export class CreateGoodsDto {
  @ApiProperty({ description: '标题（≤50字符）', example: '九成新高等数学教材（同济第七版）' })
  @IsNotEmpty({ message: '标题不能为空' })
  @Length(1, 50, { message: '标题长度须为1~50字符' })
  title: string;

  @ApiProperty({ description: '价格（元），0.01~999999.99', example: 25.5 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '价格必须为数字，最多两位小数' })
  @Min(0.01, { message: '价格最小为0.01元' })
  @Max(999999.99, { message: '价格最大为999999.99元' })
  price: number;

  @ApiProperty({ description: '分类ID', example: 1 })
  @IsInt({ message: '分类ID必须为整数' })
  categoryId: number;

  @ApiProperty({ description: '新旧程度', enum: CONDITION_LEVELS, example: '几乎全新' })
  @IsIn(CONDITION_LEVELS, { message: '新旧程度取值不合法' })
  conditionLevel: (typeof CONDITION_LEVELS)[number];

  @ApiProperty({ description: '校区', enum: CAMPUSES, example: '东区' })
  @IsIn(CAMPUSES, { message: '校区取值不合法' })
  campus: (typeof CAMPUSES)[number];

  @ApiProperty({ description: '交易方式', enum: TRADE_METHODS, example: '当面交易' })
  @IsIn(TRADE_METHODS, { message: '交易方式取值不合法' })
  tradeMethod: (typeof TRADE_METHODS)[number];

  @ApiProperty({ description: '图文描述（文本部分，≤5000字符）', example: '教材无笔记，东区图书馆当面交易' })
  @IsNotEmpty({ message: '描述不能为空' })
  @Length(1, 5000, { message: '描述长度须为1~5000字符' })
  description: string;

  @ApiPropertyOptional({ description: '图片URL数组（≤9张，先经 /files/upload 上传）', type: [String] })
  @IsOptional()
  @IsArray({ message: '图片必须为URL数组' })
  @ArrayMaxSize(9, { message: '图片最多9张' })
  @IsUrl({ require_protocol: true }, { each: true, message: '图片URL格式不合法' })
  images?: string[];
}

/** 编辑为全量更新，字段与创建一致；服务端校验后状态重置为「待审核」 */
export class UpdateGoodsDto extends CreateGoodsDto {}

export class UpdateGoodsStatusDto {
  @ApiProperty({ description: '操作：on=上架 off=下架 sold=标记已售出', enum: ['on', 'off', 'sold'], example: 'off' })
  @IsIn(['on', 'off', 'sold'], { message: '操作取值不合法（on/off/sold）' })
  action: 'on' | 'off' | 'sold';
}

export class QueryGoodsDto {
  @ApiPropertyOptional({ description: '关键词（命中标题或描述，模糊匹配）' })
  @Transform(normalizeKeyword)
  @IsOptional()
  @IsString()
  @Length(1, 50, { message: '关键词长度须为1~50字符' })
  keyword?: string;

  @ApiPropertyOptional({ description: '分类ID' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsInt({ message: '分类ID必须为整数' })
  categoryId?: number;

  @ApiPropertyOptional({ description: '最低价（元）' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '最低价必须为数字' })
  @Min(0, { message: '最低价不能为负数' })
  minPrice?: number;

  @ApiPropertyOptional({ description: '最高价（元）' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '最高价必须为数字' })
  @Min(0, { message: '最高价不能为负数' })
  maxPrice?: number;

  @ApiPropertyOptional({ description: '校区', enum: CAMPUSES })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(CAMPUSES, { message: '校区取值不合法' })
  campus?: (typeof CAMPUSES)[number];

  @ApiPropertyOptional({ description: '新旧程度', enum: CONDITION_LEVELS })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(CONDITION_LEVELS, { message: '新旧程度取值不合法' })
  condition?: (typeof CONDITION_LEVELS)[number];

  @ApiPropertyOptional({ description: '排序：time=时间倒序（默认） price_asc price_desc', enum: ['time', 'price_asc', 'price_desc'] })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(['time', 'price_asc', 'price_desc'], { message: '排序取值不合法' })
  sort?: 'time' | 'price_asc' | 'price_desc';

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

export class MyGoodsQueryDto {
  @ApiPropertyOptional({ description: '状态筛选，不传查全部', enum: GOODS_STATUSES })
  @IsOptional()
  @IsIn(GOODS_STATUSES, { message: '状态取值不合法' })
  status?: (typeof GOODS_STATUSES)[number];

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

export class AdminGoodsQueryDto extends MyGoodsQueryDto {}

export class ReviewGoodsDto {
  @ApiProperty({ description: '审核结果：pass=通过（在售） reject=驳回', enum: ['pass', 'reject'], example: 'pass' })
  @IsIn(['pass', 'reject'], { message: '审核结果取值不合法' })
  result: 'pass' | 'reject';

  @ApiPropertyOptional({ description: '驳回理由（驳回时必填，≤255字符）' })
  @IsOptional()
  @Length(1, 255, { message: '驳回理由长度须为1~255字符' })
  reason?: string;
}

export class TakedownGoodsDto {
  @ApiProperty({ description: '违规下架理由（必填，≤255字符）', example: '商品图片含违规信息' })
  @IsNotEmpty({ message: '违规下架必须填写理由' })
  @Length(1, 255, { message: '理由长度须为1~255字符' })
  reason: string;
}
