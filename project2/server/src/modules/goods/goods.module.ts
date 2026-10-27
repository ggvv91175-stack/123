import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../category/entities/category.entity';
import { Goods } from './entities/goods.entity';
import { AdminGoodsController } from './admin-goods.controller';
import { GoodsController } from './goods.controller';
import { GoodsService } from './goods.service';

@Module({
  imports: [TypeOrmModule.forFeature([Goods, Category])],
  controllers: [GoodsController, AdminGoodsController],
  providers: [GoodsService],
  exports: [GoodsService],
})
export class GoodsModule {}
