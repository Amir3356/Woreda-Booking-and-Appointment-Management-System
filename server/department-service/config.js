import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./lib/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(env("PORT", "8083")),
  mongoUrl: env("MONGO_URL", "mongodb://localhost:27017/woreda?replicaSet=rs0"),
  jwtSecret: env("JWT_SECRET", "dev-secret-change-me"),
  // Internal catalog API for other services (gRPC), never published outside Docker.
  grpcPort: Number(env("GRPC_PORT", "9083")),
  kafkaBrokers: env("KAFKA_BROKERS"),
  // Folder holding catalog.proto (this service's own copy of the gRPC contract).
  protoDir: env("PROTO_DIR", here),
};
