// Runtime configuration from environment variables, with local-development defaults.
// dotenv loads server/.env (when present) into process.env first; variables already set in the
// environment win over the file.
import dotenv from "dotenv";

dotenv.config({ path: new URL("../.env", import.meta.url), quiet: true });

const env = (key, fallback = "") => (process.env[key] === undefined || process.env[key] === "" ? fallback : process.env[key]);

// "Today" for bookings and the desk queue is the woreda's calendar day.
process.env.TZ = env("TZ", "Africa/Addis_Ababa");

export const config = {
  isProduction: env("NODE_ENV", "development") === "production",
  port: Number(env("PORT", "8080")),
  jwtSecret: env("JWT_SECRET", "dev-secret-change-me"),
  cookieSecret: env("COOKIE_SECRET", env("JWT_SECRET", "dev-secret-change-me")),
  db: {
    host: env("DB_HOST", "localhost"),
    port: Number(env("DB_PORT", "5432")),
    user: env("DB_USER", "postgres"),
    password: env("DB_PASSWORD", ""),
    database: env("DB_NAME", "woreda"),
    max: Number(env("DB_POOL_SIZE", "10")),
  },
  // Initial administrator created by `npm run seed` (seeds/). Change the password after the first sign-in.
  seedAdmin: {
    fullName: env("SEED_ADMIN_NAME", "Amir Siraj"),
    email: env("SEED_ADMIN_EMAIL", "amirsiraj1995@gmail.com"),
    password: env("SEED_ADMIN_PASSWORD", "AEHJSS36"),
    phone: env("SEED_ADMIN_PHONE", "+251938617803"),
  },
  // Per-IP request limits (middleware/rateLimit.js); "false" turns them off (e.g. for load tests).
  rateLimitEnabled: env("RATE_LIMIT_ENABLED", "true") !== "false",
  logLevel: env("LOG_LEVEL", "info"),
};
