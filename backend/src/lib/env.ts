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
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  isProduction: (process.env.NODE_ENV ?? "development") === "production",
};
