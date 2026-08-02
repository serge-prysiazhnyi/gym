import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from './jwt.strategy';

/**
 * Injects the authenticated user (attached by `JwtAuthGuard`) into a handler.
 *
 * Must be used on routes protected by `JwtAuthGuard`; without it there is no
 * user on the request and this returns `undefined`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();

    return request.user;
  },
);
