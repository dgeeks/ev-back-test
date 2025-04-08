import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

interface ActiveUserPayload {
  id: string;
  role?: string;
}

export const ActiveUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): ActiveUserPayload | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();

    return request.user as ActiveUserPayload;
  },
);
