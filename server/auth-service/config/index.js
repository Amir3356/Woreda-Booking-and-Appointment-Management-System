// Runtime configuration from environment variables, with local-development defaults.
const env = (key, fallback = "") => (process.env[key] === undefined || process.env[key] === "" ? fallback : process.env[key]);

export const config = {
  port: Number(env("PORT", "8081")),
  mongoUrl: env("MONGO_URL", "mongodb://localhost:27017/woreda?replicaSet=rs0"),
  jwtSecret: env("JWT_SECRET", "dev-secret-change-me"),
  // Empty disables logout revocation and login lockout.
  redisUrl: env("REDIS_URL"),
};
