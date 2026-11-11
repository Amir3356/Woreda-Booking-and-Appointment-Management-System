// /api/v1/queue (officer desk).
import { ok } from "../utils/response.js";

export function createQueueController(queueService) {
  return {
    async checkIn(req, res) {
      ok(res, 200, "Citizen checked in and queue token issued.", await queueService.checkIn(req.caller, req.body));
    },
    async board(req, res) {
      ok(res, 200, "Queue retrieved successfully.", await queueService.board(req.caller, req.validatedQuery.departmentId));
    },
    async callNext(req, res) {
      const out = await queueService.callNext(req.caller, req.body);
      ok(res, 200, `Token ${out.calledToken} called to Counter #${out.counterNumber}.`, out);
    },
    async finalize(req, res) {
      ok(res, 200, "Queue token finalized.", await queueService.finalize(req.caller, req.params.id, req.body));
    },
  };
}
