import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { WANT_STATUSES, WantStatus } from '../../want/entities/want-buy.entity';

/** 查询参数空值处理：原始值为空串/纯空白 → undefined */
const emptyToUndefined = ({ value, obj, key }: any) => {
  const raw = obj?.[key];
  return typeof raw === 'string' && raw.trim() === '' ? undefined : value;
};

export class QueryAdminWantDto {
  @ApiPropertyOptional({ description: '关键词（求购名称/备注模糊）' })
  @Transform(({ value, obj, key }: any) => {
    const raw = typeof obj?.[key] === 'string' ? obj[key] : value;
    return typeof raw === 'string' ? raw.trim() || undefined : value;
  })
  @IsOptional()
  @IsString()
  @Length(1, 50, { message: '关键词长度须为1~50字符' })
  keyword?: string;

  @ApiPropertyOptional({ description: '状态筛选，不传查全部', enum: WANT_STATUSES })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(WANT_STATUSES, { message: '求购状态取值不合法' })
  status?: WantStatus;

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
