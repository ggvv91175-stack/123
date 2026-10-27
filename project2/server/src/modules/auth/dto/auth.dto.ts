import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, Length, IsOptional } from 'class-validator';

/** 密码规则：8~32 位，须含字母和数字 */
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)\S{8,32}$/;
export const PASSWORD_MSG = '密码需8~32位且同时包含字母和数字';

export class RegisterDto {
  @ApiProperty({ example: '20211231247', description: '学号（登录账号，唯一）' })
  @IsString()
  @Matches(/^\d{6,20}$/, { message: '学号需为6~20位数字' })
  studentNo: string;

  @ApiProperty({ example: 'abc12345', description: '密码（8~32位，含字母+数字）' })
  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MSG })
  password: string;

  @ApiProperty({ example: '小王', description: '昵称' })
  @IsString()
  @Length(1, 32, { message: '昵称长度1~32位' })
  nickname: string;

  @ApiPropertyOptional({ example: '13800138000', description: '手机号（可选，仅本人可见）' })
  @IsOptional()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  phone?: string;
}

export class LoginDto {
  @ApiProperty({ example: '20211231245', description: '学号' })
  @IsString()
  @IsNotEmpty({ message: '学号不能为空' })
  studentNo: string;

  @ApiProperty({ example: 'abc12345', description: '密码' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;
}
