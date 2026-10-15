import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { logger } from '../logger';
import { captureException } from '../../infrastructure/sentry';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error';
    let code: string | undefined; // machine-readable error code, e.g. SUBSCRIPTION_EXPIRED
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      message =
        typeof res === 'string'
          ? res
          : (res as any).message || exception.message;
      if (typeof res === 'object' && (res as any).code) code = (res as any).code;
    }

    if (status >= 500) {
      logger.error('Unhandled error', {
        path: request.url,
        method: request.method,
        status,
        error: exception instanceof Error ? exception.message : String(exception),
      });
      captureException(exception, { path: request.url, method: request.method });
    }

    response.status(status).json({
      statusCode: status,
      ...(code ? { code } : {}),
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
