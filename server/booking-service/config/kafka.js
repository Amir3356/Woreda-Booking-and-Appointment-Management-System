// Kafka producers. Appointment lifecycle events from the desk go to woreda.appointments as
//   {id, type, source, occurredAt, appointmentId, data}
// keyed by appointmentId, so all events of one appointment land on the same partition and stay in order.
// Schedule changes go to woreda.catalog as {id, type, source, occurredAt, entityId, data}.
// Publishing never throws: a broker outage must not fail the officer's request.
import { randomBytes } from "node:crypto";
import { Kafka, logLevel } from "kafkajs";
import { config } from "./index.js";
import { logger } from "./logger.js";

export const APPOINTMENTS_TOPIC = "woreda.appointments";
export const CATALOG_TOPIC = "woreda.catalog";
const SOURCE = "booking-service";

/** Appointment events, keyed by appointmentId. */
export function createEventPublisher() {
  return createPublisher(APPOINTMENTS_TOPIC, "appointmentId");
}

/** Schedule changes on the catalog topic ({..., entityId, data}), keyed by the schedule id. */
export function createCatalogPublisher() {
  return createPublisher(CATALOG_TOPIC, "entityId");
}

function createPublisher(topic, keyField) {
  if (!config.kafkaBrokers) {
    logger.warn({ topic }, "KAFKA_BROKERS not set: events are not streamed");
    return { publish() {}, async close() {} };
  }
  const kafka = new Kafka({ clientId: SOURCE, brokers: config.kafkaBrokers.split(","), logLevel: logLevel.NOTHING });
  const producer = kafka.producer({ allowAutoTopicCreation: false });
  let ready = producer.connect().then(
    () => logger.info({ brokers: config.kafkaBrokers, topic }, "streaming events to kafka"),
    (err) => logger.error({ err: err.message }, "kafka connect failed; events will retry on next publish"),
  );

  return {
    publish(type, key, data) {
      const event = {
        id: randomBytes(16).toString("hex"), type, source: SOURCE,
        occurredAt: new Date().toISOString(), [keyField]: key, ...(data == null ? {} : { data }),
      };
      ready = ready
        .then(() => producer.send({ topic, acks: -1, messages: [{ key, value: JSON.stringify(event), headers: { type } }] }))
        .catch((err) => logger.error({ type, key, err: err.message }, "event not delivered to kafka"));
    },
    async close() {
      await ready;
      await producer.disconnect().catch(() => {});
    },
  };
}
