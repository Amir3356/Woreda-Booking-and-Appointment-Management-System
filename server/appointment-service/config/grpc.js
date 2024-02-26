// gRPC client for department-service's catalog API (contract: config/catalog.contract.js).
// Plaintext, as traffic stays on the internal network; the calls live in repositories/catalog.repository.js.
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { config } from "./index.js";
import { catalogContract } from "./catalog.contract.js";

// GetService is read-only, so it is safe to retry while department-service is briefly unreachable.
const serviceConfig = {
  methodConfig: [{
    name: [{ service: "woreda.catalog.v1.CatalogService" }],
    retryPolicy: {
      maxAttempts: 3,
      initialBackoff: "0.1s",
      maxBackoff: "1s",
      backoffMultiplier: 2,
      retryableStatusCodes: ["UNAVAILABLE"],
    },
  }],
};

export function loadCatalogPackage() {
  const def = protoLoader.fromJSON(catalogContract, { keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true });
  return grpc.loadPackageDefinition(def).woreda.catalog.v1;
}

/** Connects lazily to addr (host:port). */
export function createCatalogClient(addr = config.catalogGrpcAddr) {
  const pkg = loadCatalogPackage();
  return new pkg.CatalogService(addr, grpc.credentials.createInsecure(), {
    "grpc.service_config": JSON.stringify(serviceConfig),
    "grpc.enable_retries": 1,
  });
}
