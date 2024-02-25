// gRPC client for department-service's catalog API (contract: catalog.proto in this folder).
// appointment-service uses it instead of reading the services/departments collections.
import path from "node:path";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { NotFoundError, UnavailableError } from "./lib/index.js";

// Bounds one lookup, retries included, so a slow catalog cannot stall a booking.
export const CALL_TIMEOUT_MS = 3000;

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

export function loadCatalogProto(protoDir) {
  const def = protoLoader.loadSync(path.join(protoDir, "catalog.proto"), {
    includeDirs: [protoDir], keepCase: false, longs: Number, enums: String, defaults: true, oneofs: true,
  });
  return grpc.loadPackageDefinition(def).woreda.catalog.v1;
}

/** Connects lazily to addr (host:port); plaintext, as traffic stays on the internal network. */
export function createCatalogClient({ addr, protoDir }) {
  const pkg = loadCatalogProto(protoDir);
  const client = new pkg.CatalogService(addr, grpc.credentials.createInsecure(), {
    "grpc.service_config": JSON.stringify(serviceConfig),
    "grpc.enable_retries": 1,
  });

  return {
    /** The service and its department. NotFoundError when the service does not exist,
     *  UnavailableError when department-service cannot answer. */
    getService(id) {
      return new Promise((resolve, reject) => {
        client.GetService({ serviceId: id }, { deadline: Date.now() + CALL_TIMEOUT_MS }, (err, resp) => {
          if (err) return reject(mapError(err, id));
          resolve(toCatalogService(resp));
        });
      });
    },
    close() {
      client.close();
    },
  };
}

function mapError(err, id) {
  switch (err.code) {
    case grpc.status.NOT_FOUND:
      return new NotFoundError();
    case grpc.status.UNAVAILABLE:
    case grpc.status.DEADLINE_EXCEEDED:
      return new UnavailableError(new Error(`catalog: ${err.message}`));
    default:
      return new Error(`catalog GetService ${id}: ${err.message}`);
  }
}

export function toCatalogService(resp) {
  const svc = resp?.service ?? {};
  const dept = resp?.department ?? {};
  return {
    id: svc.id ?? "",
    name: svc.name ?? "",
    active: Boolean(svc.isActive),
    requiredDocuments: svc.requiredDocuments ?? [],
    departmentId: dept.id ?? "",
    departmentName: dept.name ?? "",
    buildingRoom: dept.buildingRoom ?? "",
    departmentActive: Boolean(dept.isActive),
  };
}

/** Whether citizens can book this service right now. */
export const bookable = (cs) => cs.active && cs.departmentActive;
