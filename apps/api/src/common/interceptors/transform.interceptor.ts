import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  data: T;
  meta?: unknown;
}

/**
 * Wraps all successful responses in a consistent envelope:
 * { data: T, meta?: PaginationMeta }
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((payload) => {
        if (isPaginatedPayload<T>(payload)) {
          return payload;
        }

        return { data: payload };
      }),
    );
  }
}

function isPaginatedPayload<T>(payload: unknown): payload is ApiResponse<T> {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'data' in payload &&
    'meta' in payload
  );
}
