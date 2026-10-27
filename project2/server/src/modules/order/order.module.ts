import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Goods } from '../goods/entities/goods.entity';
import { User } from '../user/entities/user.entity';
import { OrderInfo } from './entities/order-info.entity';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

/** 订单模块：创建订单（在售商品）、状态机流转（乐观锁/联动商品已售出）、双方列表与详情 */
@Module({
  imports: [TypeOrmModule.forFeature([OrderInfo, Goods, User])],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
