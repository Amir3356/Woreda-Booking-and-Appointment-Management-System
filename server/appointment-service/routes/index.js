// All HTTP routes of appointment-service.
import { Router } from "express";
import { createAppointmentRoutes } from "./appointment.routes.js";
import { createReportRoutes } from "./report.routes.js";

export function createRoutes({ appointmentController, reportController }) {
  const router = Router();
  router.get("/healthz", (_req, res) => res.status(200).end());
  router.use("/api/v1/appointments", createAppointmentRoutes(appointmentController));
  router.use("/api/v1/reports", createReportRoutes(reportController));
  return router;
}
