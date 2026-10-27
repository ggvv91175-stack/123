import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { Result } from '../result/result';

/**
 * 全局异常过滤器：
 * - HttpException / BadRequest 校验异常 → 透传其状态码与首个错误提示
 * - SQLite 约束异常（UNIQUE / FK / CHECK / BUSY）→ 409/400，避免一律 500
 * - 其余未知异常 → 500，且不向客户端裸露堆栈
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务繁忙，请稍后再试';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as any;
      // class-validator 校验失败时 body.message 为数组，取首条
      if (Array.isArray(body?.message)) {
        message = `参数错误：${body.message[0]}`;
      } else {
        message = body?.message || exception.message;
      }
    } else if (exception instanceof QueryFailedError) {
      const err: any = exception;
      // 双数据库兼容：SQLite 取 code 字符串，MySQL 取 errno 数字
      const code = err?.code || err?.driverError?.code;
      const errno = err?.errno || err?.driverError?.errno;
      if (
        code === 'SQLITE_CONSTRAINT_UNIQUE' ||
        code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
        errno === 1062 // ER_DUP_ENTRY
      ) {
        status = HttpStatus.CONFLICT;
        message = '数据冲突：记录已存在或违反唯一约束';
      } else if (
        code === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
        errno === 1452 || // ER_NO_REFERENCED_ROW_2
        errno === 1451 // ER_ROW_IS_REFERENCED_2
      ) {
        status = HttpStatus.CONFLICT;
        message = '数据冲突：存在关联数据，无法执行该操作';
      } else if (code === 'SQLITE_CONSTRAINT_CHECK' || errno === 3819) {
        // ER_CHECK_CONSTRAINT_VIOLATED
        status = HttpStatus.BAD_REQUEST;
        message = '参数错误：取值不合法';
      } else if (code === 'SQLITE_BUSY' || errno === 1205 || errno === 1213) {
        // MySQL 锁等待超时 / 死锁
        status = HttpStatus.CONFLICT;
        message = '操作冲突，请重试';
      }
      this.logger.warn(`数据库约束异常 [${code ?? errno}] ${err.message}`);
    } else {
      this.logger.error(
        `未捕获异常: ${(exception as Error)?.message}`,
        (exception as Error)?.stack,
      );
    }

    const body: Result = { code: status, message, data: null };
    res.status(status).json(body);
  }
}
