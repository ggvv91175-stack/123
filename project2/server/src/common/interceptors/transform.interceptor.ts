import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Result } from '../result/result';

/** 全局统一返回体：控制器返回值 → { code: 0, message: 'success', data } */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<Result> {
    return next.handle().pipe(
      map((data) => {
        // 控制器已返回统一结构时不再包装
        if (data && typeof data === 'object' && 'code' in data && 'data' in data) {
          return data as Result;
        }
        return { code: 0, message: 'success', data: data ?? null };
      }),
    );
  }
}
