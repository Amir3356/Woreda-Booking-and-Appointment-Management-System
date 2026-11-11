// Builds the Express application. Layers, from the outside in:
//   middleware (helmet, request id, log, CORS, rate limit, JSON body, auth, zod validation) → routes → controllers → services → repositories → PostgreSQL
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { requestId } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/requestLogger.js";
import cors from "cors";
import { allowedOrigins, corsOptions } from "./config/cors.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { authenticate, AUTH_COOKIE_NAME } from "./middleware/jwt.js";
import { csrfProtection } from "./middleware/csrf.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { createRealtimeService } from "./services/realtime.service.js";
import { createEventService } from "./services/event.service.js";
import { createAuthService } from "./services/auth.service.js";
import { createProfileService } from "./services/profile.service.js";
import { createStaffService } from "./services/staff.service.js";
import { createSettingsService } from "./services/settings.service.js";
import { createDepartmentService } from "./services/department.service.js";
import { createPublicServiceService } from "./services/publicService.service.js";
import { createScheduleService } from "./services/schedule.service.js";
import { createAvailabilityService } from "./services/availability.service.js";
import { createAuditService } from "./services/audit.service.js";
import { createAppointmentService } from "./services/appointment.service.js";
import { createReportService } from "./services/report.service.js";
import { createQueueService } from "./services/queue.service.js";
import { createAuthController } from "./controllers/auth.controller.js";
import { createProfileController } from "./controllers/profile.controller.js";
import { createStaffController } from "./controllers/staff.controller.js";
import { createSettingsController } from "./controllers/settings.controller.js";
import { createDepartmentController } from "./controllers/department.controller.js";
import { createPublicServiceController } from "./controllers/publicService.controller.js";
import { createScheduleController } from "./controllers/schedule.controller.js";
import { createAppointmentController } from "./controllers/appointment.controller.js";
import { createQueueController } from "./controllers/queue.controller.js";
import { createReportController } from "./controllers/report.controller.js";
import { createAuditController } from "./controllers/audit.controller.js";
import { createHealthController } from "./controllers/health.controller.js";
import { createRoutes } from "./routes/index.js";

export function createApp() {
  // Services
  const realtimeService = createRealtimeService({ allowedOrigins, logger });
  const events = createEventService({ realtimeService, logger });
  const authService = createAuthService({ jwtSecret: config.jwtSecret, logger, events });
  const auditService = createAuditService({ logger });
  const appointmentService = createAppointmentService({ events, audit: auditService });

  // Controllers
  const controllers = {
    health: createHealthController(),
    auth: createAuthController(authService),
    profile: createProfileController(createProfileService()),
    staff: createStaffController(createStaffService()),
    settings: createSettingsController(createSettingsService()),
    department: createDepartmentController(createDepartmentService({ events })),
    publicService: createPublicServiceController(createPublicServiceService({ events })),
    schedule: createScheduleController({ scheduleService: createScheduleService({ events }), availabilityService: createAvailabilityService() }),
    appointment: createAppointmentController(appointmentService),
    queue: createQueueController(createQueueService({ events })),
    report: createReportController(createReportService({ appointmentService })),
    audit: createAuditController(auditService),
  };

  const app = express();
  app.disable("x-powered-by");
  app.disable("etag");
  app.set("query parser", "simple");
  // Security headers (HSTS, nosniff, frame and referrer policies, ...). The web app runs on another
  // origin (Vite on :3000), so resources such as the CSV export must stay loadable cross-origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(requestId);
  app.use(requestLogger(logger));
  app.use(cors(corsOptions));
  app.use(cookieParser(config.cookieSecret));
  if (config.rateLimitEnabled) {
    app.use("/api/v1", rateLimit({ ratePerSecond: 5, burst: 50 }));
    app.use(["/api/v1/auth/login", "/api/v1/auth/register"], rateLimit({ ratePerSecond: 20 / 60, burst: 10 }));
  }
  app.use(express.json({ limit: "1mb" }));
  app.use(authenticate(config.jwtSecret, (jti) => authService.isRevoked(jti)));
  app.use(csrfProtection({ allowedOrigins, isProduction: config.isProduction, authCookieName: AUTH_COOKIE_NAME }));
  app.use(createRoutes(controllers));
  app.use(notFound);
  app.use(errorHandler(logger));
  return { app, realtimeService };
}
