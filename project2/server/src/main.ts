import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  // SQLite 模式：确保数据文件目录存在（better-sqlite3 不会自动建目录）；MySQL 模式无需处理
  const config0 = new ConfigService();
  if (config0.get<string>('DB_TYPE') !== 'mysql') {
    const dbFile = path.resolve(
      config0.get<string>('DB_FILE') || './data/campus_xianyu.db',
    );
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // 全局路由前缀：/api/v1
  app.setGlobalPrefix('api/v1');

  // 静态托管上传目录：/uploads/**（不受全局前缀影响）
  const uploadDir = path.resolve(config.get<string>('UPLOAD_DIR') || './uploads');
  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });

  // CORS：来源由环境变量控制，支持多域名逗号分隔
  const origins = (config.get<string>('CORS_ORIGIN') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
  });

  // 全局参数校验：白名单剔除多余字段、自动类型转换
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger 文档：/api-docs
  const docConfig = new DocumentBuilder()
    .setTitle('校园版咸鱼 API')
    .setDescription('校园二手交易平台后端接口文档（SQLite 版）')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, docConfig);
  SwaggerModule.setup('api-docs', app, document);

  const port = config.get<number>('APP_PORT') || 8080;
  await app.listen(port);
  Logger.log(`服务已启动: http://localhost:${port}/api/v1`, 'Bootstrap');
  Logger.log(`Swagger: http://localhost:${port}/api-docs`, 'Bootstrap');
}
bootstrap();
