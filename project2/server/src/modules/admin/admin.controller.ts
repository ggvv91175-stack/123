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
import { AdminService } from './admin.service';
import { QueryUserDto, UpdateUserStatusDto } from './dto/admin-user.dto';
import { QueryAdminWantDto } from './dto/admin-want.dto';

@ApiTags('admin 平台管理-用户与看板')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({
    summary: '用户列表（admin）：学号/昵称模糊、状态/角色/实名筛选、分页',
  })
  userList(@Query() query: QueryUserDto) {
    return this.adminService.userList(query);
  }

  @Patch('users/:id/status')
  @ApiOperation({
    summary: '禁用/解禁账号（admin）：禁用时 tokenVersion+1，已发 Token 全量失效',
  })
  updateUserStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(id, dto);
  }

  @Get('wants')
  @ApiOperation({ summary: '求购列表（admin）：关键词/状态筛选、分页，附发布者摘要' })
  wantList(@Query() query: QueryAdminWantDto) {
    return this.adminService.wantList(query);
  }

  @Patch('wants/:id/takedown')
  @ApiOperation({ summary: '违规下架求购（admin）：待接单→已关闭，其余状态 → 409' })
  takedownWant(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.takedownWant(id);
  }

  @Get('dashboard/stats')
  @ApiOperation({
    summary: '平台数据看板（admin）：用户/商品/求购总数与待办统计',
  })
  dashboardStats() {
    return this.adminService.dashboardStats();
  }
}
