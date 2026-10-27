import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { PASSWORD_MSG, PASSWORD_REGEX } from '../../auth/dto/auth.dto';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: '小张同学', description: '昵称' })
  @IsOptional()
  @IsString()
  @Length(1, 32, { message: '昵称长度1~32位' })
  nickname?: string;

  @ApiPropertyOptional({ example: '/uploads/202610/abc.jpg', description: '头像URL' })
  @IsOptional()
  @IsString()
  @Length(1, 255, { message: '头像URL过长' })
  avatar?: string;

  @ApiPropertyOptional({ example: '计算机学院', description: '学院' })
  @IsOptional()
  @IsString()
  @Length(1, 64, { message: '学院名称过长' })
  college?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'abc12345', description: '原密码' })
  @IsString()
  @IsNotEmpty({ message: '原密码不能为空' })
  oldPassword: string;

  @ApiProperty({ example: 'xy2026abc', description: '新密码（8~32位，含字母+数字）' })
  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MSG })
  newPassword: string;
}

export class SubmitCertificationDto {
  @ApiProperty({ example: '20211231245', description: '认证学号' })
  @IsString()
  @Matches(/^\d{6,20}$/, { message: '学号需为6~20位数字' })
  studentNo: string;

  @ApiProperty({ example: '计算机学院', description: '学院' })
  @IsString()
  @Length(1, 64, { message: '学院名称1~64位' })
  college: string;

  @ApiProperty({
    example: ['/uploads/202610/card1.jpg'],
    description: '证明材料图片URL数组（校园卡/学生证，1~3张）',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: '请至少上传1张证明材料' })
  @ArrayMaxSize(3, { message: '证明材料最多3张' })
  @IsString({ each: true })
  proofImages: string[];
}
