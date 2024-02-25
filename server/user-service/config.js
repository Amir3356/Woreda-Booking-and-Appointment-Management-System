import { env } from "./lib/index.js";

export const config = {
  port: Number(env("PORT", "8082")),
  mongoUrl: env("MONGO_URL", "mongodb://localhost:27017/woreda?replicaSet=rs0"),
  jwtSecret: env("JWT_SECRET", "dev-secret-change-me"),
};
