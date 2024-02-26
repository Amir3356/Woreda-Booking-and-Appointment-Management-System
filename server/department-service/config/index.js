// Runtime configuration from environment variables, with local-development defaults.
const env = (key, fallback = "") => (process.env[key] === undefined || process.env[key] === "" ? fallback : process.env[key]);

export const config = {
  port: Number(env("PORT", "8083")),
  mongoUrl: env("MONGO_URL", "mongodb://localhost:27017/woreda?replicaSet=rs0"),
  jwtSecret: env("JWT_SECRET", "dev-secret-change-me"),
  // Internal catalog API for other services (gRPC), never published outside Docker.
  grpcPort: Number(env("GRPC_PORT", "9083")),
  // Catalog change events (topic woreda.catalog); empty = events are not streamed.
  kafkaBrokers: env("KAFKA_BROKERS"),
};
