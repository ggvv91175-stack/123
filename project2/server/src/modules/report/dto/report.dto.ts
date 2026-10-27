import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  Length,
  Min,
} from 'class-validator';
import {
  HANDLE_ACTIONS,
  HandleAction,
  REPORT_STATUSES,
  ReportStatus,
  TARGET_TYPES,
  TargetType,
} from '../entities/report.entity';

/** 查询参数空值处理：原始值为空串/纯空白 → undefined（用原始值判断，避免隐式转换把 '' 变成 0） */
const emptyToUndefined = ({ value, obj, key }: any) => {
  const raw = obj?.[key];
  return typeof raw === 'string' && raw.trim() === '' ? undefined : value;
};

export class CreateReportDto {
  @ApiProperty({ description: '举报目标类型', enum: TARGET_TYPES, example: '商品' })
  @IsIn(TARGET_TYPES, { message: '举报目标类型取值不合法' })
  targetType: TargetType;

  @ApiProperty({ description: '举报目标ID', example: 1 })
  @IsInt({ message: '举报目标ID必须为整数' })
  targetId: number;

  @ApiProperty({ description: '举报理由（1~300字符）', example: '商品图片与实物不符，疑似诈骗' })
  @IsNotEmpty({ message: '举报理由不能为空' })
  @Length(1, 300, { message: '举报理由长度须为1~300字符' })
  reason: string;

  @ApiPropertyOptional({ description: '证据图片URL数组（≤3张，先经 /files/upload 上传）', type: [String] })
  @IsOptional()
  @IsArray({ message: '证据图片必须为URL数组' })
  @ArrayMaxSize(3, { message: '证据图片最多3张' })
  @IsUrl({ require_protocol: true }, { each: true, message: '证据图片URL格式不合法' })
  evidenceImages?: string[];
}

export class QueryReportDto {
  @ApiPropertyOptional({ description: '状态筛选，默认待处理', enum: REPORT_STATUSES })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(REPORT_STATUSES, { message: '状态取值不合法' })
  status?: ReportStatus;

  @ApiPropertyOptional({ description: '目标类型筛选', enum: TARGET_TYPES })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(TARGET_TYPES, { message: '目标类型取值不合法' })
  targetType?: TargetType;

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

export class HandleReportDto {
  @ApiProperty({
    description:
      '处理动作：下架商品(商品) / 封禁用户(用户) / 删除留言(留言) / 警告用户(通用) / 驳回举报(通用，需填说明)',
    enum: HANDLE_ACTIONS,
    example: '下架商品',
  })
  @IsIn(HANDLE_ACTIONS, { message: '处理动作取值不合法' })
  action: HandleAction;

  @ApiPropertyOptional({ description: '处理结果说明（驳回举报必填，≤300字符）', example: '经核实商品存在虚假宣传' })
  @IsOptional()
  @Length(1, 300, { message: '处理结果说明长度须为1~300字符' })
  result?: string;
}
