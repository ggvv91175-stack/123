import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { CommentService } from './comment.service';
import { CreateCommentDto, QueryCommentDto } from './dto/comment.dto';

@ApiTags('商品留言')
@Controller()
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post('goods/:goodsId/comments')
  @ApiBearerAuth()
  @ApiOperation({ summary: '新增留言（登录），关联商品ID' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('goodsId', ParseIntPipe) goodsId: number,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentService.create(user.id, goodsId, dto);
  }

  @Post('comments/:id/replies')
  @ApiBearerAuth()
  @ApiOperation({ summary: '回复留言（登录）；回复的回复平铺到顶层留言下' })
  reply(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentService.reply(user.id, id, dto);
  }

  @OptionalAuth()
  @Get('goods/:goodsId/comments')
  @ApiOperation({
    summary: '商品留言列表（分页，含回复；在售公开，非在售仅本人/管理员）',
  })
  list(
    @Param('goodsId', ParseIntPipe) goodsId: number,
    @Query() query: QueryCommentDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.commentService.list(goodsId, query, user);
  }

  @Get('comments/my')
  @ApiBearerAuth()
  @ApiOperation({ summary: '我的留言列表（登录，含回复；附商品摘要，分页）' })
  myList(@CurrentUser() user: AuthUser, @Query() query: QueryCommentDto) {
    return this.commentService.myList(user.id, query);
  }

  @Delete('comments/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除留言（仅本人，软删除；顶层留言级联删除回复）' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.commentService.remove(user.id, id);
  }
}
