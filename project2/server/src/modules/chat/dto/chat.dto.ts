import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { MSG_TYPES, MsgType } from '../entities/chat-message.entity';

/** 查询参数空值处理：原始值为空串/纯空白 → undefined（用原始值判断，避免隐式转换把 '' 变成 0） */
const emptyToUndefined = ({ value, obj, key }: any) => {
  const raw = obj?.[key];
  return typeof raw === 'string' && raw.trim() === '' ? undefined : value;
};

export class CreateSessionDto {
  @ApiProperty({ description: '商品ID（从商品详情页发起私聊）', example: 1 })
  @IsInt({ message: '商品ID必须为整数' })
  goodsId: number;
}

export class SendMessageDto {
  @ApiProperty({ description: '消息内容：文本≤2000字符；图片为URL', example: '你好，这本书还在吗？' })
  @IsNotEmpty({ message: '消息内容不能为空' })
  @IsString({ message: '消息内容必须为字符串' })
  @Length(1, 2000, { message: '消息内容长度须为1~2000字符' })
  content: string;

  @ApiPropertyOptional({ description: '消息类型', enum: MSG_TYPES, default: '文本' })
  @IsOptional()
  @IsIn(MSG_TYPES, { message: '消息类型取值不合法' })
  msgType?: MsgType = '文本';
}

export class QuerySessionDto {
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

export class QueryMessageDto extends QuerySessionDto {}
