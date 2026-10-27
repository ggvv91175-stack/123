import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequireCertified } from '../../common/decorators/require-certified.decorator';
import {
  CreateGoodsDto,
  MyGoodsQueryDto,
  QueryGoodsDto,
  UpdateGoodsDto,
  UpdateGoodsStatusDto,
} from './dto/goods.dto';
import { GoodsService } from './goods.service';

@ApiTags('商品')
@Controller('goods')
export class GoodsController {
  constructor(private readonly goodsService: GoodsService) {}

  @Post()
  @RequireCertified()
  @ApiBearerAuth()
  @ApiOperation({ summary: '发布商品（需实名），初始状态为待审核' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGoodsDto) {
    return this.goodsService.create(user.id, dto);
  }

  @Get('my')
  @ApiBearerAuth()
  @ApiOperation({ summary: '我的发布列表（全部状态，分页）' })
  myList(@CurrentUser() user: AuthUser, @Query() query: MyGoodsQueryDto) {
    return this.goodsService.myList(user.id, query);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: '公开商品列表（仅在售，支持筛选/排序/分页）' })
  publicList(@Query() query: QueryGoodsDto) {
    return this.goodsService.publicList(query);
  }

  @OptionalAuth()
  @Get(':id')
  @ApiOperation({
    summary: '商品详情（在售所有人可见；非在售仅本人/管理员可见）',
  })
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user?: AuthUser) {
    return this.goodsService.detail(id, user);
  }

  @Put(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '编辑商品（仅本人，编辑后重新进入待审核）' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGoodsDto,
  ) {
    return this.goodsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除商品（仅本人，逻辑删除）' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.goodsService.remove(user.id, id);
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: '上下架/标记已售出（仅本人）：on=上架 off=下架 sold=已售出' })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGoodsStatusDto,
  ) {
    return this.goodsService.updateStatus(user.id, id, dto);
  }
}
