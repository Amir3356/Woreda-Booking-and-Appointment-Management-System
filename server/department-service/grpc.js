// Catalog API for other services over gRPC (contract: catalog.proto in this folder).
import path from "node:path";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { NotFoundError } from "./lib/index.js";

export function loadCatalogProto(protoDir) {
  const def = protoLoader.loadSync(path.join(protoDir, "catalog.proto"), {
    includeDirs: [protoDir], keepCase: false, longs: Number, enums: String, defaults: true, oneofs: true,
  });
  return grpc.loadPackageDefinition(def).woreda.catalog.v1;
}

export function startGrpcServer({ catalog, protoDir, port, logger }) {
  const pkg = loadCatalogProto(protoDir);
  const server = new grpc.Server();

  const logged = (method, fn) => async (call, callback) => {
    const start = process.hrtime.bigint();
    let code = grpc.status.OK;
    try {
      callback(null, await fn(call.request));
    } catch (err) {
      code = err.grpcCode ?? grpc.status.INTERNAL;
      callback({ code, details: err.message });
    } finally {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      logger.info({ method: `/woreda.catalog.v1.CatalogService/${method}`, code: grpcCodeName(code), duration: `${ms.toFixed(2)}ms` }, "grpc");
    }
  };

  server.addService(pkg.CatalogService.service, {
    GetService: logged("GetService", async (req) => {
      if (!req.serviceId) throw withCode(grpc.status.INVALID_ARGUMENT, "service_id is required");
      const svc = await catalog.getService(req.serviceId).catch(notFound("service"));
      const dept = await catalog.getDepartment(svc.departmentId).catch(notFound("department"));
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
    }),
  });

  return new Promise((resolve, reject) => {
    server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, bound) => {
      if (err) return reject(err);
      logger.info({ addr: `[::]:${bound}` }, "grpc listening");
      resolve(server);
    });
  });
}

const withCode = (grpcCode, message) => Object.assign(new Error(message), { grpcCode });
const notFound = (what) => (err) => {
  throw err instanceof NotFoundError ? withCode(grpc.status.NOT_FOUND, `${what} not found`) : err;
};
const grpcCodeName = (code) => Object.keys(grpc.status).find((k) => grpc.status[k] === code) ?? String(code);
