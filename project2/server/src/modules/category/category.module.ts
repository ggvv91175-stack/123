import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Goods } from '../goods/entities/goods.entity';
import { CategoryService } from './category.service';
import {
  AdminCategoryController,
  CategoryController,
} from './category.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Goods])],
  controllers: [CategoryController, AdminCategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
