import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AdminGoodsQueryDto,
  ReviewGoodsDto,
  TakedownGoodsDto,
} from './dto/goods.dto';
import { GoodsService } from './goods.service';

@ApiTags('商品审核')
@Roles('admin')
@Controller('admin/goods')
export class AdminGoodsController {
  constructor(private readonly goodsService: GoodsService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: '商品审核列表（默认待审核，按提交时间正序）' })
  adminList(@Query() query: AdminGoodsQueryDto) {
    return this.goodsService.adminList(query);
  }

  @Patch(':id/review')
  @ApiBearerAuth()
  @ApiOperation({ summary: '审核商品：pass→在售，reject→已驳回（理由必填）' })
  review(@Param('id', ParseIntPipe) id: number, @Body() dto: ReviewGoodsDto) {
    return this.goodsService.review(id, dto.result, dto.reason);
  }

  @Patch(':id/takedown')
  @ApiBearerAuth()
  @ApiOperation({ summary: '违规下架（在售/已下架→违规下架，理由必填）' })
  takedown(@Param('id', ParseIntPipe) id: number, @Body() dto: TakedownGoodsDto) {
    return this.goodsService.takedown(id, dto.reason);
  }
}
