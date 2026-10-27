import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Goods } from '../goods/entities/goods.entity';
import { User } from '../user/entities/user.entity';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { MessageComment } from './entities/message-comment.entity';

/** 留言模块：商品留言发表/回复/分页列表/软删除（本人删除，顶层级联） */
@Module({
  imports: [TypeOrmModule.forFeature([MessageComment, Goods, User])],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule {}
