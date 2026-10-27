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
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateReportDto,
  HandleReportDto,
  QueryReportDto,
} from './dto/report.dto';
import { ReportService } from './report.service';

@ApiTags('举报')
@ApiBearerAuth()
@Controller()
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  // ---------------- 用户侧 ----------------

  @Post('reports')
  @ApiOperation({
    summary: '提交举报（登录）：商品/求购/用户/留言；待处理重复举报去重 → 409',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.reportService.create(user.id, dto);
  }

  // ---------------- 管理员侧 ----------------

  @Get('admin/reports')
  @Roles('admin')
  @ApiOperation({ summary: '举报列表（admin，默认待处理，按提交时间正序）' })
  list(@Query() query: QueryReportDto) {
    return this.reportService.list(query);
  }

  @Patch('admin/reports/:id/handle')
  @Roles('admin')
  @ApiOperation({
    summary: '处理举报（admin）：下架商品/封禁用户/删除留言/警告用户/驳回举报，同事务联动目标状态',
  })
  handle(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: HandleReportDto,
  ) {
    return this.reportService.handle(admin.id, id, dto);
  }
}
