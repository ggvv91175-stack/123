import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/** 允许的图片扩展名与 MIME 白名单 */
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * 魔数校验（防止伪造扩展名上传恶意文件）：
 * - jpeg: FF D8 FF
 * - png:  89 50 4E 47 0D 0A 1A 0A
 * - webp: 52 49 46 46 xx xx xx xx 57 45 42 50（RIFF....WEBP）
 */
function checkMagic(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return true;
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return true;
  return false;
}

@ApiTags('文件')
@Controller('files')
export class FilesController {
  private readonly uploadDir: string;

  constructor(config: ConfigService) {
    this.uploadDir = path.resolve(config.get<string>('UPLOAD_DIR') || './uploads');
  }

  @Post('upload')
  @ApiBearerAuth()
  @ApiOperation({ summary: '上传图片（jpg/jpeg/png/webp，≤5MB，登录可用）' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          // 确保上传目录存在（按 .env 的 UPLOAD_DIR 解析）
          const dir = path.resolve(process.env.UPLOAD_DIR || './uploads');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase();
          // 重命名：时间戳 + 随机串，避免原名冲突/路径注入
          cb(null, `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXT.includes(ext) || !ALLOWED_MIME.includes(file.mimetype)) {
          cb(new BadRequestException('仅支持 jpg/jpeg/png/webp 图片'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('请选择要上传的图片');

    // 二次校验文件头魔数（扩展名可伪造）
    const fd = fs.openSync(file.path, 'r');
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    if (!checkMagic(buf)) {
      fs.unlink(file.path, () => undefined); // 删除伪造文件
      throw new BadRequestException('文件内容与图片格式不符');
    }

    return { url: `/uploads/${file.filename}` };
  }
}
