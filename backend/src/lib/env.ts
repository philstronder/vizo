import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL", "postgres://localhost:5432/vizo"),
  jwtSecret: required("JWT_SECRET", "dev-secret-change-me"),
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  isProduction: (process.env.NODE_ENV ?? "development") === "production",
  // Secure cookies are only stored over HTTPS; defaults to on in production.
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : (process.env.NODE_ENV ?? "development") === "production",
};
