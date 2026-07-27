import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Shape of the decoded JWT payload — the claims stored inside the token.
 *
 * These fields are set when the token is signed (in `AuthService.login`).
 * `sub` ("subject") is the standard JWT claim for the identity the token
 * represents; here it holds the user's id.
 *
 * Security note: a JWT payload is signed, not encrypted — anyone holding the
 * token can read these fields. Never put secrets here.
 */
export interface JwtPayload {
  /** Standard "subject" claim — the authenticated user's id. */
  sub: string;
  /** The user's role, used downstream by `RolesGuard` for authorization. */
  role: string;
}

/**
 * Shape attached to `request.user` after a token is successfully validated.
 *
 * This is what the rest of the app sees as "the current user". It is
 * deliberately a small, renamed view of the payload (`sub` → `userId`) rather
 * than the raw claims, so consumers depend on a clean shape instead of on
 * JWT-specific field names. Guards, controllers, and a `@CurrentUser()`
 * decorator should all rely on this type.
 */
export interface AuthenticatedUser {
  userId: string;
  role: string;
}

/**
 * Passport strategy that authenticates requests via a JWT bearer token.
 *
 * Registered under the default name `'jwt'`, which is what `JwtAuthGuard`
 * (`AuthGuard('jwt')`) selects. Passport runs this strategy on each guarded
 * request: it extracts and verifies the token, and only if verification
 * succeeds does it call {@link validate}.
 *
 * The base class is configured in the constructor via `super(...)`:
 * - `jwtFromRequest`: where to find the token — here, the
 *   `Authorization: Bearer <token>` header.
 * - `ignoreExpiration: false`: expired tokens are rejected (do not disable this).
 * - `secretOrKey`: the secret used to verify the signature. It MUST be the same
 *   `JWT_SECRET` used to sign tokens in `AuthService`, or every token fails
 *   verification.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      // Read the bearer token from the standard Authorization header.
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Reject expired tokens rather than accepting them.
      ignoreExpiration: false,
      // Verify signatures with the same secret used to sign tokens.
      // Fallback to '' keeps the type a string; a missing secret is a
      // misconfiguration that should be caught at startup (see note below).
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  /**
   * Called by Passport only after the token's signature and expiry are verified.
   *
   * Whatever this returns becomes `request.user`. Because it runs post-
   * verification, the payload can be trusted as authentic — but note this
   * method does NOT hit the database, so it does not detect users deleted or
   * changed after the token was issued. That trade-off (speed vs. freshness)
   * is fine for short-lived access tokens; add a lookup here if you need to
   * reject tokens for users that no longer exist.
   *
   * @param payload - The verified, decoded token claims.
   * @returns The authenticated user view attached to the request.
   */
  validate(payload: JwtPayload): AuthenticatedUser {
    return { userId: payload.sub, role: payload.role };
  }
}
