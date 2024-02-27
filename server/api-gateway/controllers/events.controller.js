// Kafka message handlers (consumers are set up in config/kafka.js): appointment events clear the
// cached availability; catalog events clear the cached department/service lists (schedule events
// also the cached availability) and tell open pages (WebSocket) to re-fetch. ev is the parsed
// event envelope, or null when malformed.
import { GROUP_AVAILABILITY, GROUP_CATALOG } from "../services/cache.service.js";

export function createEventsController({ cacheService, realtimeService, logger }) {
  return {
    /** woreda.appointments (consumed only with Redis). */
    async appointmentEvent(ev, { partition, offset }) {
      if (!ev) return logger.warn({ offset }, "skipping malformed event");
      try {
        await cacheService.invalidateGroup(GROUP_AVAILABILITY);
      } catch (err) {
        return logger.warn({ event: ev.type, err: err.message }, "availability cache not cleared; entries expire on their TTL");
      }
      logger.info({ event: ev.type, source: ev.source, appointmentId: ev.appointmentId, partition, offset },
        "availability cache cleared by event");
    },

    /** woreda.catalog (works without Redis too). */
    async catalogEvent(ev, { offset }) {
      if (!ev) return logger.warn({ offset }, "skipping malformed catalog event");
      // Clear first, so the pages' re-fetch below cannot get the old cached list.
      if (cacheService.enabled) {
        try {
          await cacheService.invalidateGroup(GROUP_CATALOG);
          if (String(ev.type).startsWith("catalog.schedule.")) await cacheService.invalidateGroup(GROUP_AVAILABILITY);
        } catch (err) {
          logger.warn({ err: err.message }, "catalog cache not cleared; entries expire on their TTL");
        }
      }
      const event = typeof ev.type === "string" ? ev.type : "";
      const entityId = typeof ev.entityId === "string" ? ev.entityId : "";
      realtimeService.broadcast({ type: "catalog.changed", event, entityId });
      logger.info({ event, entityId, pages: realtimeService.count() }, "catalog change pushed to pages");
    },
  };
}
