import { Injectable } from '@nestjs/common';
import { Secret, TOTP } from 'otpauth';
import { toDataURL } from 'qrcode';

export interface TotpSetupPayload {
  /** Base32 secret — shown as text for manual entry into the authenticator app. */
  secret: string;
  /** `otpauth://` URI the app scans from the QR code. */
  otpauthUrl: string;
  /** PNG data URL of the QR code, ready to drop into an <img>. */
  qrCodeDataUrl: string;
}

/** 6 digits, 30-second step, ±1 step of clock drift tolerated at verification. */
@Injectable()
export class TotpService {
  private readonly issuer = process.env.TOTP_ISSUER ?? '3NAMES';
  private readonly digits = 6;
  private readonly period = 30;
  /** ±1 step either side, so a slightly fast/slow phone still works. */
  private readonly window = 1;

  /** A fresh 160-bit RFC 4646 base32 secret (what the app scans). */
  createSecret(): string {
    return new Secret({ size: 20 }).base32;
  }

  /** The `otpauth://totp/...` URI encoded in the enrolment QR code. */
  buildOtpauthUrl(email: string, secret: string): string {
    return this.buildTotp(email, secret).toString();
  }

  /** PNG data URL of the QR code for `otpauthUrl`. */
  async qrCodeDataUrl(otpauthUrl: string): Promise<string> {
    return toDataURL(otpauthUrl, { margin: 1, width: 240 });
  }

  /** True when `code` is the current (or immediately adjacent) TOTP step. */
  verify(code: string, secret: string, email: string): boolean {
    const token = (code ?? '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(token) || !secret) return false;
    try {
      return this.buildTotp(email, secret).validate({ token, window: this.window }) !== null;
    } catch {
      return false;
    }
  }

  private buildTotp(email: string, secret: string): TOTP {
    return new TOTP({
      issuer: this.issuer,
      label: email,
      secret: Secret.fromBase32(secret),
      digits: this.digits,
      period: this.period,
    });
  }
}
