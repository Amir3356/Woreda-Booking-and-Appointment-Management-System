// HTTP handlers for /api/v1/appointments: read the request, call the service, send the envelope.
import { body, ok, okPage, query } from "../utils/response.js";
import { atoi } from "../utils/pagination.js";

/** Registry filters shared by the list and the CSV export. */
export function listFilter(req) {
  return {
    timeframe: query(req, "timeframe"), status: query(req, "status"), departmentId: query(req, "departmentId"),
    search: query(req, "search"), page: atoi(query(req, "page")), limit: atoi(query(req, "limit")),
  };
}

export function createAppointmentController(appointmentService) {
  return {
    async book(req, res) {
      ok(res, 201, "Appointment booked successfully.", await appointmentService.book(req.caller, body(req)));
    },
    async track(req, res) {
      ok(res, 200, "Appointment found.", await appointmentService.track(query(req, "ref")));
    },
    async mine(req, res) {
      ok(res, 200, "Appointments retrieved successfully.", await appointmentService.mine(req.caller, query(req, "tab"), query(req, "search")));
    },
    async list(req, res) {
      const { items, pagination } = await appointmentService.listPage(req.caller, listFilter(req));
      okPage(res, "List retrieved successfully.", items, pagination);
    },
    async review(req, res) {
      const a = await appointmentService.review(req.caller, req.params.id, body(req));
      ok(res, 200, `Appointment status updated to ${a.status}.`, a);
    },
    async reschedule(req, res) {
      ok(res, 200, "Appointment rescheduled.", await appointmentService.reschedule(req.caller, req.params.id, body(req)));
    },
    async cancel(req, res) {
      ok(res, 200, "Appointment cancelled.", await appointmentService.cancel(req.caller, req.params.id));
    },
    async slip(req, res) {
      ok(res, 200, "Slip generated.", await appointmentService.slip(req.params.id));
    },
  };
}
