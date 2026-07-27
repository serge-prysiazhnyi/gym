import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key under which required roles are stored on a route handler.
 *
 * The {@link Roles} decorator writes to this key, and `RolesGuard` reads
 * from it (via `Reflector`) to decide whether the current user may access
 * the route. Keeping it as a shared constant ensures the writer and reader
 * always agree on the key.
 */
export const ROLES_KEY = 'roles';

/**
 * Route decorator that declares which roles are allowed to access a handler.
 *
 * Attach it to a controller method (or an entire controller) alongside
 * `RolesGuard`. The guard compares these roles against the authenticated
 * user's role and grants access only if the user has one of them.
 *
 * Note: this decorator only *declares* the requirement — it does not enforce
 * anything on its own. `RolesGuard` must be applied for the check to run,
 * and it should run after an authentication guard (e.g. `JwtAuthGuard`) that
 * populates the request user.
 *
 * @param roles - One or more role names permitted to access the route
 *                (e.g. `'admin'`, `'user'`).
 * @returns A decorator that stores the roles as route metadata.
 *
 * @example
 * ```ts
 * @Get('all')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('admin')
 * listAllUsers() {
 *   return this.users.findAll();
 * }
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
