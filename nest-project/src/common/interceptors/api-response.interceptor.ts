import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiSuccessResponse } from '../types/api-response.type.js';

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
    intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessResponse<T>> {
        return next.handle().pipe(
            map((data) => ({
                success: true as const,
                data,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            })),
        );
    }
}
