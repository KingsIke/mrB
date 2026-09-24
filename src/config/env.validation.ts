/**
 * Startup checks for the JWT secrets (wired into ConfigModule.forRoot).
 * Missing secrets always fail fast. Reused or short secrets fail in
 * production and only warn in development, so local setups keep booting.
 */
const JWT_SECRET_KEYS = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'JWT_RESET_SECRET'] as const;
const MIN_SECRET_LENGTH = 32;

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const isProduction = config.NODE_ENV === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];

  const missing = JWT_SECRET_KEYS.filter((key) => !config[key]);
  if (missing.length) {
    errors.push(`Missing required env vars: ${missing.join(', ')}`);
  }

  const secrets = JWT_SECRET_KEYS.map((key) => String(config[key] ?? '')).filter(Boolean);
  if (new Set(secrets).size !== secrets.length) {
    (isProduction ? errors : warnings).push(
      `${JWT_SECRET_KEYS.join(', ')} must all be different values`,
    );
  }

  const short = JWT_SECRET_KEYS.filter(
    (key) => config[key] && String(config[key]).length < MIN_SECRET_LENGTH,
  );
  if (short.length) {
    (isProduction ? errors : warnings).push(
      `${short.join(', ')} should be at least ${MIN_SECRET_LENGTH} characters`,
    );
  }

  for (const warning of warnings) {
    console.warn(`[env] WARNING: ${warning}`);
  }
  if (errors.length) {
    throw new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
  }
  return config;
}
