import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] | object = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseMessage = exception.getResponse();

      if (typeof responseMessage === 'string') {
        message = responseMessage;
      } else if (
        typeof responseMessage === 'object' &&
        responseMessage !== null
      ) {
        message =
          'message' in responseMessage
            ? (responseMessage as { message: string | string[] }).message
            : responseMessage;
      }
    } else if (exception instanceof QueryFailedError) {
      const error = exception.driverError as {
        code?: string;
        message?: string;
      };

      if (error?.code === 'ER_DUP_ENTRY' || error?.code === '23505') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Duplicate entry detected';
      } else {
        message = error?.message || 'Database error';
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
