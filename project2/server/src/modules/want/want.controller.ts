import {
  Body,
  Controller,
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
import { RequireCertified } from '../../common/decorators/require-certified.decorator';
import { CreateWantDto, MyWantQueryDto, QueryWantDto, UpdateWantDto } from './dto/want.dto';
import { WantService } from './want.service';

@ApiTags('求购')
@ApiBearerAuth()
@Controller('wants')
export class WantController {
  constructor(private readonly wantService: WantService) {}

  @Post()
  @RequireCertified()
  @ApiOperation({ summary: '发布求购（需实名），初始状态为待接单' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWantDto) {
    return this.wantService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: '求购列表（默认仅待接单，支持关键词/校区/分页）' })
  list(@Query() query: QueryWantDto) {
    return this.wantService.list(query);
  }

  @Get('my')
  @ApiOperation({ summary: '我的求购列表（全部状态，支持状态筛选，分页）' })
  myList(@CurrentUser() user: AuthUser, @Query() query: MyWantQueryDto) {
    return this.wantService.myList(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '求购详情（含发布者摘要）' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.wantService.detail(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑求购（仅本人，且仅待接单可编辑）' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWantDto,
  ) {
    return this.wantService.update(user.id, id, dto);
  }

  @Patch(':id/close')
  @ApiOperation({ summary: '关闭求购（仅本人，待接单→已关闭）' })
  close(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.wantService.close(user.id, id);
  }

  @Post(':id/accept')
  @ApiOperation({
    summary: '卖家接单（非求购者本人），自动创建私聊会话并关联求购',
  })
  accept(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.wantService.accept(user.id, id);
  }
}
