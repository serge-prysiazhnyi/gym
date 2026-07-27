import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import type { AuthenticatedUser } from './jwt.strategy';

/**
 * Guard that enforces role-based access control on a route.
 *
 * It reads the roles declared by the `@Roles(...)` decorator (stored under
 * {@link ROLES_KEY}) and allows the request only if the authenticated user's
 * role is among them.
 *
 * This guard handles authorization ("are you allowed?") only — it relies on an
 * authentication guard having already run. Apply it AFTER `JwtAuthGuard`, e.g.
 * `@UseGuards(JwtAuthGuard, RolesGuard)`, because it depends on `request.user`
 * being populated by that guard. On its own it cannot identify the user.
 *
 * Behaviour summary:
 * - Route has no `@Roles` → allowed (nothing to enforce).
 * - Route has `@Roles` but request has no user → denied.
 * - Route has `@Roles` and the user's role matches → allowed; otherwise denied.
 *
 * A denied result surfaces to the client as `403 Forbidden` (distinct from the
 * `401 Unauthorized` that `JwtAuthGuard` returns for a missing/invalid token).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  /**
   * @param reflector - Nest utility used to read route metadata (the roles
   *                     set by the `@Roles` decorator) at request time.
   */
  constructor(private reflector: Reflector) {}

  /**
   * Decides whether the current request may proceed.
   *
   * @param context - Execution context for the incoming request, used to read
   *                  route metadata and access the HTTP request object.
   * @returns `true` to allow the request, `false` to reject it with 403.
   */
  canActivate(context: ExecutionContext): boolean {
    // Collect required roles from both the handler and its controller class.
    // getAllAndOverride: a method-level @Roles takes precedence over a
    // controller-level one, so a specific route can override a class default.
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles on this route → no restriction to enforce, so allow.
    // (Authentication is still handled separately by JwtAuthGuard.)
    if (!required || required.length === 0) return true;

    // Read the user that JwtAuthGuard attached to the request.
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();

    // Roles are required but nobody is authenticated → deny.
    // Guards against this guard being used without an auth guard in front.
    if (!user) {
      return false;
    }

    // Allow only if the user's role is one of the required roles.
    return required.includes(user.role);
  }
}
