import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./lib/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(env("PORT", "8084")),
  mongoUrl: env("MONGO_URL", "mongodb://localhost:27017/woreda?replicaSet=rs0"),
  jwtSecret: env("JWT_SECRET", "dev-secret-change-me"),
  // Comma-separated host:port list; unset = events are not streamed.
  kafkaBrokers: env("KAFKA_BROKERS"),
  // department-service's gRPC catalog API (host:port).
  catalogGrpcAddr: env("CATALOG_GRPC_ADDR", "localhost:9083"),
  // Folder holding catalog.proto (this service's own copy of the gRPC contract).
  protoDir: env("PROTO_DIR", here),
};
