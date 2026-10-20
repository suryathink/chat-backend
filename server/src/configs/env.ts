import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  CORS_ORIGIN: z.string().default("*"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),

  MYSQL_HOST: z.string().default("localhost"),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().min(1),
  MYSQL_PASSWORD: z.string(),
  MYSQL_DATABASE: z.string().min(1),

  // Optional here so DB scripts can run without Firebase; configs/firebase.ts checks them.
  FIREBASE_PROJECT_ID: z.string().optional(),
  // Path to the service account JSON. Not needed when using the emulator.
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  // e.g. "localhost:8081". When set, firebase-admin talks to the emulator.
  FIRESTORE_EMULATOR_HOST: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast on startup instead of crashing later on the first request.
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
