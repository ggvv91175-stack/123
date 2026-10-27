import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ChangePasswordDto,
  SubmitCertificationDto,
  UpdateProfileDto,
} from './dto/user.dto';
import { UserService } from './user.service';

@ApiTags('user 用户与实名认证')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: '获取个人信息（含完整学号/手机号，仅本人）' })
  getMe(@CurrentUser() user: AuthUser) {
    return this.userService.getMe(user.id);
  }

  @Put('me')
  @ApiOperation({ summary: '修改昵称/头像/学院' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.userService.updateMe(user.id, dto);
  }

  @Put('me/password')
  @ApiOperation({ summary: '修改密码（需原密码；成功后旧 Token 全部失效）' })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.userService.changePassword(user.id, dto);
  }

  @Post('me/certification')
  @ApiOperation({ summary: '提交实名认证（学号+学院+证明材料），未认证→审核中；重复提交 409' })
  submitCertification(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitCertificationDto,
  ) {
    return this.userService.submitCertification(user.id, dto);
  }

  @Get('me/certification')
  @ApiOperation({ summary: '查询本人认证状态与驳回理由' })
  getMyCertification(@CurrentUser() user: AuthUser) {
    return this.userService.getMyCertification(user.id);
  }
}
