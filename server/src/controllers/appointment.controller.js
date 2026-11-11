// /api/v1/appointments.
import { ok, okPage } from "../utils/response.js";

export function createAppointmentController(appointmentService) {
  return {
    async book(req, res) {
      ok(res, 201, "Appointment booked successfully.", await appointmentService.book(req.caller, req.body));
    },
    async track(req, res) {
      ok(res, 200, "Appointment found.", await appointmentService.track(req.validatedQuery.ref));
    },
    async mine(req, res) {
      ok(res, 200, "Appointments retrieved successfully.", await appointmentService.mine(req.caller, req.validatedQuery));
    },
    async list(req, res) {
      const { items, pagination } = await appointmentService.listPage(req.caller, req.validatedQuery);
      okPage(res, "List retrieved successfully.", items, pagination);
    },
    async review(req, res) {
      const a = await appointmentService.review(req.caller, req.params.id, req.body);
      ok(res, 200, `Appointment status updated to ${a.status}.`, a);
    },
    async reschedule(req, res) {
      ok(res, 200, "Appointment rescheduled.", await appointmentService.reschedule(req.caller, req.params.id, req.body));
    },
    async cancel(req, res) {
      ok(res, 200, "Appointment cancelled.", await appointmentService.cancel(req.caller, req.params.id));
    },
    async slip(req, res) {
      ok(res, 200, "Slip generated.", await appointmentService.slip(req.params.id));
    },
  };
}
