import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';

/** 文件模块：图片上传（本地存储 + 魔数校验） */
@Module({
  controllers: [FilesController],
})
export class FilesModule {}
