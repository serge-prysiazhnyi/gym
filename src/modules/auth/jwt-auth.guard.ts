import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that protects routes by requiring a valid JWT access token.
 *
 * Apply it with `@UseGuards(JwtAuthGuard)` on any controller or handler that
 * should only be reachable by authenticated users. On each request it triggers
 * the Passport `'jwt'` strategy (see `JwtStrategy`), which:
 *   1. extracts the token from the `Authorization: Bearer <token>` header,
 *   2. verifies its signature against `JWT_SECRET` and checks expiry, and
 *   3. attaches the strategy's `validate()` result to `request.user`.
 *
 * If the token is missing, malformed, expired, or has an invalid signature,
 * the request is rejected with `401 Unauthorized` before the handler runs.
 *
 * The `'jwt'` string selects which registered Passport strategy to use; it must
 * match the name of the strategy (the default name for `PassportStrategy(Strategy)`
 * from `passport-jwt`). The class is intentionally empty — all behaviour comes
 * from the base `AuthGuard`; extending it gives a named, injectable guard and a
 * place to override methods (e.g. `handleRequest`) later if needed.
 *
 * Note: this guard only authenticates ("who are you?"). Role checks
 * ("are you allowed?") are handled separately by `RolesGuard`, which reads the
 * `request.user` this guard populates — so `JwtAuthGuard` must run first.
 *
 * @example
 * ```ts
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@Req() req) {
 *   return req.user; // populated by the jwt strategy
 * }
 * ```
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
