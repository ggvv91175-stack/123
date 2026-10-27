import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class ReviewCertificationDto {
  @ApiProperty({ example: 'pass', description: '审核结果：pass=通过，reject=驳回', enum: ['pass', 'reject'] })
  @IsIn(['pass', 'reject'], { message: '审核结果仅支持 pass/reject' })
  result: 'pass' | 'reject';

  @ApiPropertyOptional({ example: '证明材料模糊，请重新上传', description: '驳回理由（result=reject 时必填）' })
  @IsOptional()
  @IsString()
  @Length(1, 255, { message: '驳回理由1~255字' })
  reason?: string;
}

export class CertListQueryDto {
  @ApiPropertyOptional({ example: '待审核', description: '状态筛选', enum: ['待审核', '已通过', '已驳回'] })
  @IsOptional()
  @IsIn(['待审核', '已通过', '已驳回'], { message: '状态取值不合法' })
  status?: '待审核' | '已通过' | '已驳回';

  @ApiPropertyOptional({ example: 1, description: '页码（默认1）' })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 10, description: '每页条数（默认10，最大50）' })
  @IsOptional()
  pageSize?: number;
}
