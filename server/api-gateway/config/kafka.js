// Kafka consumers: woreda.appointments and woreda.catalog. Each message is parsed here and handled
// by controllers/events.controller.js. A broker outage never crashes the gateway.
import os from "node:os";
import { Kafka, logLevel } from "kafkajs";
import { config } from "./index.js";
import { logger } from "./logger.js";

export const TOPIC_APPOINTMENTS = "woreda.appointments";
export const TOPIC_CATALOG = "woreda.catalog";
const CACHE_GROUP = "api-gateway-cache";
const RETRY_MS = 2000;

const parse = (message) => {
  try {
    const v = JSON.parse(message.value?.toString() ?? "");
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
};

/**
 * Runs one consumer until stop(): connects, (optionally) moves the group to the newest offsets,
 * subscribes and processes messages; any failure or non-restartable crash is logged and the
 * whole consumer is recreated after RETRY_MS, so a broker outage never crashes the gateway.
 */
function runConsumer({ kafka, groupId, topic, toLatest, startMessage, onMessage }) {
  let stopped = false;
  let consumer = null;
  let retryTimer = null;

  const retry = (err) => {
    if (stopped) return;
    logger.warn({ topic, group: groupId, err: err?.message ?? String(err) }, "kafka read failed, retrying");
    const c = consumer;
    consumer = null;
    c?.disconnect().catch(() => {});
    clearTimeout(retryTimer);
    retryTimer = setTimeout(start, RETRY_MS);
  };

  async function start() {
    if (stopped) return;
    try {
      if (toLatest) {
        // Each start begins at the newest message, whatever this group read before.
        const admin = kafka.admin();
        await admin.connect();
        try {
          await admin.resetOffsets({ groupId, topic, earliest: false });
        } finally {
          await admin.disconnect().catch(() => {});
        }
      }
      const c = kafka.consumer({ groupId, allowAutoTopicCreation: false });
      consumer = c;
      c.on(c.events.CRASH, ({ payload }) => {
        if (!payload.restart && consumer === c) retry(payload.error);
      });
      await c.connect();
      await c.subscribe({ topic, fromBeginning: false }); // a new group starts at the newest message
      await c.run({
        eachMessage: async ({ partition, message }) => {
          try {
            await onMessage(parse(message), { partition, offset: message.offset });
          } catch (err) {
            logger.warn({ topic, offset: message.offset, err: err.message }, "event handling failed");
          }
        },
      });
      logger.info({ topic, group: groupId }, startMessage);
    } catch (err) {
      retry(err);
    }
  }

  start();
  return async () => {
    stopped = true;
    clearTimeout(retryTimer);
    await consumer?.disconnect().catch(() => {});
  };
}

/** Starts the consumers (call only when KAFKA_BROKERS is set); returns a function that stops them. */
export function startConsumers({ eventsController, cacheEnabled }) {
  const kafka = new Kafka({ clientId: "api-gateway", brokers: config.kafkaBrokers.split(","), logLevel: logLevel.NOTHING });
  const stops = [];

  // Appointment events clear cached availability, whichever service changed it.
  if (cacheEnabled) {
    stops.push(runConsumer({
      kafka, groupId: CACHE_GROUP, topic: TOPIC_APPOINTMENTS, toLatest: false,
      startMessage: "consuming appointment events",
      onMessage: eventsController.appointmentEvent,
    }));
  }

  // Catalog changes: every gateway instance must see every event to reach its own pages, so the
  // group is unique per instance (works without Redis too).
  stops.push(runConsumer({
    kafka, groupId: `api-gateway-ws-${os.hostname()}`, topic: TOPIC_CATALOG, toLatest: true,
    startMessage: "listening for catalog changes",
    onMessage: eventsController.catalogEvent,
  }));

  return () => Promise.all(stops.map((s) => s()));
}
