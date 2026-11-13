// In-process domain events (replaces the Kafka topics woreda.appointments and woreda.catalog).
// Services publish what changed; open browser pages are told over WebSocket so they re-fetch.
// Publishing never throws: a notification problem must not fail the user's request.

/**
 * publish(type, entityId, data):
 *   "appointment.*" -> {type: "appointments.changed", event}
 *   "catalog.*"     -> {type: "catalog.changed", event, entityId}  (departments, services, schedules)
 *   "citizen.*"     -> {type: "citizens.changed", event, entityId, citizen: _data}
 *   "staff.*"       -> {type: "staff.changed", event, entityId}
 */
export function createEventService({ realtimeService, logger }) {
  return {
    publish(type, entityId, _data) {
      try {
        if (type.startsWith("appointment.")) {
          realtimeService.broadcast({ type: "appointments.changed", event: type });
        } else if (type.startsWith("catalog.")) {
          realtimeService.broadcast({ type: "catalog.changed", event: type, entityId });
        } else if (type.startsWith("citizen.")) {
          realtimeService.broadcast({ type: "citizens.changed", event: type, entityId, citizen: _data });
        } else if (type.startsWith("staff.")) {
          realtimeService.broadcast({ type: "staff.changed", event: type, entityId });
        } else if (type.startsWith("audit.")) {
          realtimeService.broadcast({ type: "audit.changed", event: type, entityId, auditEntry: _data });
        }
        logger.debug({ event: type, entityId, pages: realtimeService.count() }, "change pushed to pages");
      } catch (err) {
        logger.warn({ event: type, err: err.message }, "change notice not sent");
      }
    },
  };
}
