import { UnauthorizedException } from '@nestjs/common';

/**
 * Every JWT we issue carries a `type` claim, and every verifier checks it,
 * so one kind of token can never be used as another (e.g. a refresh or
 * password-reset token as an access token) — even if two secrets were ever
 * configured to the same value.
 */
export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
  PASSWORD_RESET = 'password-reset',
  /** Short-lived proof that the user was shown a treasure hunt on its screen. */
  TREASURE_CLAIM = 'treasure-claim',
}

export function isTokenType(payload: unknown, type: TokenType): boolean {
  return (payload as { type?: unknown } | null)?.type === type;
}

export function assertTokenType(payload: unknown, type: TokenType): void {
  if (!isTokenType(payload, type)) {
    throw new UnauthorizedException('Invalid token type');
  }
}
