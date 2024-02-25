import { env } from "./lib/index.js";

export const config = {
  port: Number(env("PORT", "8080")),
  jwtSecret: env("JWT_SECRET", "dev-secret-change-me"),
  allowedOrigins: env("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(","),
  // Enables response caching and token revocation checks (empty = disabled).
  redisUrl: env("REDIS_URL"),
  // Comma-separated host:port; enables the Kafka consumers (empty = disabled).
  kafkaBrokers: env("KAFKA_BROKERS"),
  services: {
    auth: env("AUTH_SERVICE_URL", "http://localhost:8081"),
    user: env("USER_SERVICE_URL", "http://localhost:8082"),
    department: env("DEPARTMENT_SERVICE_URL", "http://localhost:8083"),
    appointment: env("APPOINTMENT_SERVICE_URL", "http://localhost:8084"),
    booking: env("BOOKING_SERVICE_URL", "http://localhost:8085"),
  },
};
