// department-service's catalog over gRPC (client from config/grpc.js); appointment-service uses it
// instead of reading the services/departments collections.
import grpc from "@grpc/grpc-js";
import { NotFoundError, UnavailableError } from "../utils/errors.js";

// Bounds one lookup, retries included, so a slow catalog cannot stall a booking.
export const CALL_TIMEOUT_MS = 3000;

export function createCatalogRepository(client) {
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
