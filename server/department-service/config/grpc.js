// gRPC server for the internal catalog API (contract: config/catalog.contract.js), one log line per call.
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { config } from "./index.js";
import { catalogContract } from "./catalog.contract.js";
import { logger } from "./logger.js";

export function loadCatalogPackage() {
  const definition = protoLoader.fromJSON(catalogContract, { keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true });
  return grpc.loadPackageDefinition(definition).woreda.catalog.v1;
}

const codeName = (code) => Object.keys(grpc.status).find((k) => grpc.status[k] === code) ?? String(code);

/** Wraps an async handler (request -> response) as a logged unary gRPC method. */
function unary(method, handler) {
  return async (call, callback) => {
    const start = process.hrtime.bigint();
    let code = grpc.status.OK;
    try {
      callback(null, await handler(call.request));
    } catch (err) {
      code = err.grpcCode ?? grpc.status.INTERNAL;
      callback({ code, details: code === grpc.status.INTERNAL ? "internal error" : err.message });
      if (code === grpc.status.INTERNAL) logger.error({ method, err: err.message }, "grpc handler failed");
    } finally {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      logger.info({ method: `/woreda.catalog.v1.CatalogService/${method}`, code: codeName(code), duration: `${ms.toFixed(2)}ms` }, "grpc");
    }
  };
}

export async function startGrpcServer(controller) {
  const pkg = loadCatalogPackage();
  const server = new grpc.Server();
  server.addService(pkg.CatalogService.service, { GetService: unary("GetService", controller.GetService) });
  const port = await new Promise((resolve, reject) =>
    server.bindAsync(`0.0.0.0:${config.grpcPort}`, grpc.ServerCredentials.createInsecure(), (err, p) => (err ? reject(err) : resolve(p))),
  );
  logger.info({ addr: `[::]:${port}` }, "grpc listening");
  return server;
}
