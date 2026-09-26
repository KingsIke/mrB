import { Secret, TOTP } from 'otpauth';
import { TotpService } from './totp.service';

describe('TotpService', () => {
  const service = new TotpService();
  const email = 'admin@3namesa.com';

  /** The code an authenticator app would currently be showing. */
  function appCode(secret: string): string {
    return new TOTP({
      label: email,
      secret: Secret.fromBase32(secret),
      digits: 6,
      period: 30,
    }).generate();
  }

  it('creates a base32 secret long enough for TOTP', () => {
    const secret = service.createSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(service.createSecret()).not.toBe(secret);
  });

  it('builds a scannable otpauth:// URL for the account', () => {
    const secret = service.createSecret();
    const url = service.buildOtpauthUrl(email, secret);

    expect(url.startsWith('otpauth://totp/')).toBe(true);
    expect(decodeURIComponent(url)).toContain(email);
    expect(decodeURIComponent(url)).toContain(secret);
  });

  it('renders the enrolment QR code as a PNG data URL', async () => {
    const url = service.buildOtpauthUrl(email, service.createSecret());
    const dataUrl = await service.qrCodeDataUrl(url);

    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(dataUrl.length).toBeGreaterThan(1000);
  });

  it('accepts the code the authenticator app is showing', () => {
    const secret = service.createSecret();
    expect(service.verify(appCode(secret), secret, email)).toBe(true);
  });

  it('rejects wrong, malformed or empty codes', () => {
    const secret = service.createSecret();
    const other = service.createSecret();

    expect(service.verify(appCode(other), secret, email)).toBe(false);
    expect(service.verify('000000', secret, email)).toBe(false);
    expect(service.verify('12345', secret, email)).toBe(false);
    expect(service.verify('abcdef', secret, email)).toBe(false);
    expect(service.verify('', secret, email)).toBe(false);
    expect(service.verify('123456', '', email)).toBe(false);
  });

  it('tolerates one step of clock drift either way', () => {
    const secret = service.createSecret();
    const totp = new TOTP({
      label: email,
      secret: Secret.fromBase32(secret),
      digits: 6,
      period: 30,
    });

    // A code from 30 seconds ahead/behind still validates…
    expect(
      service.verify(totp.generate({ timestamp: Date.now() + 30_000 }), secret, email),
    ).toBe(true);
    expect(
      service.verify(totp.generate({ timestamp: Date.now() - 30_000 }), secret, email),
    ).toBe(true);
    // …but one outside the ±1-step window does not.
    expect(
      service.verify(totp.generate({ timestamp: Date.now() + 5 * 30_000 }), secret, email),
    ).toBe(false);
  });
});
