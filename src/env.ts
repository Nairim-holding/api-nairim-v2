import "dotenv/config";

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ Variável de ambiente ${key} não definida`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 3333),

  DATABASE_URL: required("DATABASE_URL"),

  JWT_SECRET: required("JWT_SECRET"),
  
  BASE_URL: process.env.BASE_URL ?? "http://localhost:5000",

  // MinIO (CDN self-hosted, S3 compatível)
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT ?? "",
  MINIO_PUBLIC_URL: process.env.MINIO_PUBLIC_URL ?? "",
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY ?? "",
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY ?? "",
  MINIO_BUCKET: process.env.MINIO_BUCKET ?? "imagens",
  MINIO_REGION: process.env.MINIO_REGION ?? "us-east-1",

  // Rate limiting configuration
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 5 * 60 * 1000), // 5 minutes
  RATE_LIMIT_MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 10000), // 10,000 requests per window
} as const;