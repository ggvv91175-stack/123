import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Length,
  Min,
} from 'class-validator';
import { ORDER_STATUSES, OrderStatus } from '../entities/order-info.entity';

/** 查询参数空值处理：原始值为空串/纯空白 → undefined（用原始值判断，避免隐式转换把 '' 变成 0） */
const emptyToUndefined = ({ value, obj, key }: any) => {
  const raw = obj?.[key];
  return typeof raw === 'string' && raw.trim() === '' ? undefined : value;
};

export class CreateOrderDto {
  @ApiProperty({ description: '商品ID（买家对在售商品下单）', example: 1 })
  @IsInt({ message: '商品ID必须为整数' })
  goodsId: number;

  @ApiProperty({ description: '约定地点/校区（1~100字符）', example: '东区图书馆门口' })
  @IsNotEmpty({ message: '约定地点不能为空' })
  @Length(1, 100, { message: '约定地点长度须为1~100字符' })
  appointmentPlace: string;

  @ApiPropertyOptional({ description: '约定时间（ISO8601，不得早于当前时间）', example: '2026-10-26T18:30:00+08:00' })
  @IsOptional()
  @IsDateString({}, { message: '约定时间格式不合法（ISO8601）' })
  appointmentTime?: string;

  @ApiPropertyOptional({ description: '备注（≤500字符）', example: '希望当面验货' })
  @IsOptional()
  @Length(0, 500, { message: '备注长度须为0~500字符' })
  remark?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: '流转动作：confirm=待沟通→待交易 complete=待交易→已完成 cancel=待沟通/待交易→已取消',
    enum: ['confirm', 'complete', 'cancel'],
    example: 'confirm',
  })
  @IsIn(['confirm', 'complete', 'cancel'], {
    message: '操作取值不合法（confirm/complete/cancel）',
  })
  action: 'confirm' | 'complete' | 'cancel';
}

export class QueryOrderDto {
  @ApiPropertyOptional({ description: '视角：buy=我的买到（默认） sell=我的卖出', enum: ['buy', 'sell'] })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(['buy', 'sell'], { message: '视角取值不合法（buy/sell）' })
  role?: 'buy' | 'sell' = 'buy';

  @ApiPropertyOptional({ description: '状态筛选，不传查全部', enum: ORDER_STATUSES })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(ORDER_STATUSES, { message: '状态取值不合法' })
  status?: OrderStatus;

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
