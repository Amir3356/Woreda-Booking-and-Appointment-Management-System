// Kafka producer for appointment lifecycle events from the desk. Every message is the envelope
//   {id, type, source, occurredAt, appointmentId, data}
// keyed by appointmentId, so all events of one appointment land on the same partition and stay in order.
// Publishing never throws: a broker outage must not fail the officer's request.
import { randomBytes } from "node:crypto";
import { Kafka, logLevel } from "kafkajs";
import { config } from "./index.js";
import { logger } from "./logger.js";

export const APPOINTMENTS_TOPIC = "woreda.appointments";
const SOURCE = "booking-service";

export function createEventPublisher() {
  if (!config.kafkaBrokers) {
    logger.warn({ topic: APPOINTMENTS_TOPIC }, "KAFKA_BROKERS not set: events are not streamed");
    return { publish() {}, async close() {} };
  }
  const kafka = new Kafka({ clientId: SOURCE, brokers: config.kafkaBrokers.split(","), logLevel: logLevel.NOTHING });
  const producer = kafka.producer({ allowAutoTopicCreation: false });
  let ready = producer.connect().then(
    () => logger.info({ brokers: config.kafkaBrokers, topic: APPOINTMENTS_TOPIC }, "streaming events to kafka"),
    (err) => logger.error({ err: err.message }, "kafka connect failed; events will retry on next publish"),
  );

  return {
    publish(type, appointmentId, data) {
      const event = {
        id: randomBytes(16).toString("hex"), type, source: SOURCE,
        occurredAt: new Date().toISOString(), appointmentId, ...(data == null ? {} : { data }),
      };
      ready = ready
        .then(() => producer.send({ topic: APPOINTMENTS_TOPIC, acks: -1, messages: [{ key: appointmentId, value: JSON.stringify(event), headers: { type } }] }))
        .catch((err) => logger.error({ type, key: appointmentId, err: err.message }, "event not delivered to kafka"));
    },
    async close() {
      await ready;
      await producer.disconnect().catch(() => {});
    },
  };
}
