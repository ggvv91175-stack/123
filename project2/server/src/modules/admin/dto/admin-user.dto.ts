import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

/** 查询参数空值处理：原始值为空串/纯空白 → undefined（用原始值判断，避免隐式转换把 '' 变成 0） */
const emptyToUndefined = ({ value, obj, key }: any) => {
  const raw = obj?.[key];
  return typeof raw === 'string' && raw.trim() === '' ? undefined : value;
};

export class QueryUserDto {
  @ApiPropertyOptional({ description: '关键词（学号/昵称模糊）' })
  @Transform(({ value, obj, key }: any) => {
    const raw = typeof obj?.[key] === 'string' ? obj[key] : value;
    return typeof raw === 'string' ? raw.trim() || undefined : value;
  })
  @IsOptional()
  @IsString()
  @Length(1, 50, { message: '关键词长度须为1~50字符' })
  keyword?: string;

  @ApiPropertyOptional({ description: '账号状态筛选', enum: ['正常', '禁用'] })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(['正常', '禁用'], { message: '账号状态取值不合法' })
  status?: '正常' | '禁用';

  @ApiPropertyOptional({ description: '角色筛选', enum: ['admin', 'student'] })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(['admin', 'student'], { message: '角色取值不合法' })
  role?: 'admin' | 'student';

  @ApiPropertyOptional({ description: '是否已实名：true/false' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsBoolean({ message: '是否实名必须为布尔值' })
  isCertified?: boolean;

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

export class UpdateUserStatusDto {
  @ApiProperty({
    description: '操作：disable=禁用（吊销全部Token） enable=解除禁用',
    enum: ['disable', 'enable'],
    example: 'disable',
  })
  @IsIn(['disable', 'enable'], { message: '操作取值不合法（disable/enable）' })
  action: 'disable' | 'enable';
}
