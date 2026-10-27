import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import {
  CreateOrderDto,
  QueryOrderDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { OrderService } from './order.service';

@ApiTags('订单')
@ApiBearerAuth()
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({
    summary: '创建订单（登录，买家对在售商品下单），初始状态待沟通',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orderService.create(user.id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: '订单状态流转（仅交易双方）：confirm=待沟通→待交易 complete=待交易→已完成（联动商品已售出） cancel=取消',
  })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateStatus(user.id, id, dto);
  }

  @Get()
  @ApiOperation({
    summary: '我的订单列表：role=buy 我的买到 / role=sell 我的卖出，按时间倒序分页',
  })
  list(@CurrentUser() user: AuthUser, @Query() query: QueryOrderDto) {
    return this.orderService.list(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '订单详情（仅交易双方可见），附商品与双方摘要' })
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.orderService.detail(user.id, id);
  }
}
