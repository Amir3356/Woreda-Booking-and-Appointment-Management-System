// Runtime configuration from environment variables, with local-development defaults.
const env = (key, fallback = "") => (process.env[key] === undefined || process.env[key] === "" ? fallback : process.env[key]);

export const config = {
  port: Number(env("PORT", "8084")),
  mongoUrl: env("MONGO_URL", "mongodb://localhost:27017/woreda?replicaSet=rs0"),
  jwtSecret: env("JWT_SECRET", "dev-secret-change-me"),
  // Comma-separated host:port list; unset = events are not streamed.
  kafkaBrokers: env("KAFKA_BROKERS"),
  // department-service's gRPC catalog API (host:port).
  catalogGrpcAddr: env("CATALOG_GRPC_ADDR", "localhost:9083"),
};
