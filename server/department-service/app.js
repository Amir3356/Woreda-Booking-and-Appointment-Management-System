// Express application: wires repository → service → controller → routes, then the middleware chain
//   JSON body → request log → JWT caller → routes → 404 → error envelope
import express from "express";
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { authenticate } from "./middleware/auth.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { createDepartmentService } from "./services/department.service.js";
import { createPublicServiceService } from "./services/publicService.service.js";
import { createDepartmentController } from "./controllers/department.controller.js";
import { createPublicServiceController } from "./controllers/publicService.controller.js";
import { createCatalogGrpcController } from "./controllers/catalog.grpc.controller.js";
import { createRoutes } from "./routes/index.js";

export function createApp({ events }) {
  const departmentService = createDepartmentService({ events });
  const publicServiceService = createPublicServiceService({ events });

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger(logger));
  app.use(authenticate(config.jwtSecret));
  app.use(createRoutes({
    departmentController: createDepartmentController(departmentService),
    publicServiceController: createPublicServiceController(publicServiceService),
  }));
  app.use(notFound);
  app.use(errorHandler(logger));

  const grpcController = createCatalogGrpcController({ departmentService, publicServiceService });
  return { app, grpcController };
}
