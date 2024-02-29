// Express application: wires repository → service → controller → routes, then the middleware chain
//   JSON body → request log → JWT caller → routes → 404 → error envelope
import express from "express";
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { authenticate } from "./middleware/auth.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { httpMetrics } from "./middleware/metrics.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { createCatalogRepository } from "./repositories/catalog.repository.js";
import { createSlotService } from "./services/slot.service.js";
import { createAppointmentService } from "./services/appointment.service.js";
import { createReportService } from "./services/report.service.js";
import { createAuditService } from "./services/audit.service.js";
import { createAppointmentController } from "./controllers/appointment.controller.js";
import { createReportController } from "./controllers/report.controller.js";
import { createAuditController } from "./controllers/audit.controller.js";
import { createRoutes } from "./routes/index.js";

export function createApp({ events, catalogClient }) {
  const catalog = createCatalogRepository(catalogClient);
  const audit = createAuditService({ logger });
  const appointmentService = createAppointmentService({ catalog, events, slots: createSlotService(), audit });
  const reportService = createReportService({ appointmentService });

  const app = express();
  app.disable("x-powered-by");
  app.set("query parser", "simple");
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger(logger));
  app.use(httpMetrics());
  app.use(authenticate(config.jwtSecret));
  app.use(createRoutes({
    appointmentController: createAppointmentController(appointmentService),
    reportController: createReportController(reportService),
    auditController: createAuditController(audit),
  }));
  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
