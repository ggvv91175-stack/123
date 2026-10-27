import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

/** 全局请求日志：方法、路径、用户、状态码、耗时 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const start = Date.now();
    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse();
        const userId = req.user?.id ?? '-';
        this.logger.log(
          `${method} ${url} user=${userId} status=${res.statusCode} ${Date.now() - start}ms`,
        );
      }),
    );
  }
}
