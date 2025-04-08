import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, catchError, map, throwError } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((data) => ({
        code: response.statusCode || HttpStatus.OK,
        message: this.getMessageForStatusCode(
          response.statusCode || HttpStatus.OK,
          data,
        ),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data,
      })),
      catchError((error: unknown) => {
        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string = 'An unexpected error occurred';

        if (error instanceof HttpException) {
          status = error.getStatus();
          const responseError = error.getResponse();

          if (typeof responseError === 'string') {
            message = responseError;
          } else if (
            typeof responseError === 'object' &&
            responseError !== null &&
            'message' in responseError
          ) {
            const extractedMessage = (
              responseError as { message: string | string[] }
            ).message;
            message = Array.isArray(extractedMessage)
              ? extractedMessage.join(', ')
              : extractedMessage;
          }
        }

        if (error instanceof BadRequestException) {
          const responseError = error.getResponse();
          if (typeof responseError === 'object' && responseError !== null) {
            const extractedMessage = (
              responseError as { message: string | string[] }
            ).message;
            message = Array.isArray(extractedMessage)
              ? extractedMessage.join(', ')
              : extractedMessage;
          }
        }

        return throwError(
          () =>
            new HttpException(
              {
                code: status,
                message,
                error:
                  error instanceof Error
                    ? error.message
                    : 'An unexpected error occurred',
              },
              status,
            ),
        );
      }),
    );
  }

  private getMessageForStatusCode(
    statusCode: HttpStatus,
    data?: unknown,
  ): string {
    if (typeof data === 'object' && data !== null && 'message' in data) {
      const extractedMessage = (data as { message: string | string[] }).message;
      return Array.isArray(extractedMessage)
        ? extractedMessage.join(', ')
        : extractedMessage;
    }

    switch (statusCode) {
      case HttpStatus.OK:
        return 'Request processed successfully';
      case HttpStatus.CREATED:
        return 'Resource created';
      case HttpStatus.NO_CONTENT:
        return 'Request processed, no content available';
      case HttpStatus.ACCEPTED:
        return 'Request accepted';
      case HttpStatus.NON_AUTHORITATIVE_INFORMATION:
        return 'Request processed with external data source';
      case HttpStatus.NOT_FOUND:
        return 'Requested resource not found';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'An unexpected error occurred';
      default:
        return 'Request processed';
    }
  }
}
