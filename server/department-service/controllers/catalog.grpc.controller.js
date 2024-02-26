// gRPC handlers for woreda.catalog.v1.CatalogService (config/catalog.contract.js), used by appointment-service.
import grpc from "@grpc/grpc-js";
import { NotFoundError } from "../utils/errors.js";

const withCode = (code, message) => Object.assign(new Error(message), { grpcCode: code });
const notFound = (what) => (err) => {
  throw err instanceof NotFoundError ? withCode(grpc.status.NOT_FOUND, `${what} not found`) : err;
};

export function createCatalogGrpcController({ departmentService, publicServiceService }) {
  return {
    /** A public service together with the department that delivers it. */
    async GetService(request) {
      if (!request.serviceId) throw withCode(grpc.status.INVALID_ARGUMENT, "service_id is required");
      const svc = await publicServiceService.get(request.serviceId).catch(notFound("service"));
      const dept = await departmentService.get(svc.departmentId).catch(notFound("department"));
      return {
        service: {
          id: svc._id, departmentId: svc.departmentId, code: svc.code, name: svc.name,
          durationMinutes: svc.durationMinutes, dailyQuota: svc.dailyQuota,
          requiredDocuments: svc.requiredDocuments, isActive: svc.isActive,
        },
        department: {
          id: dept.id, code: dept.code, name: dept.name, buildingRoom: dept.buildingRoom,
          contactPhone: dept.contactPhone, isActive: dept.isActive,
        },
      };
    },
  };
}
