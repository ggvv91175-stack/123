import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { CertListQueryDto, ReviewCertificationDto } from './dto/review-certification.dto';

@ApiTags('admin 平台管理-认证审核')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/certifications')
export class AdminCertificationController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: '实名认证审核列表（默认待审核，分页）' })
  list(@Query() query: CertListQueryDto) {
    return this.adminService.certificationList(query);
  }

  @Patch(':id/review')
  @ApiOperation({ summary: '审核实名认证：pass 通过 / reject 驳回（驳回必填理由）' })
  review(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewCertificationDto,
  ) {
    return this.adminService.reviewCertification(admin.id, id, dto);
  }
}
