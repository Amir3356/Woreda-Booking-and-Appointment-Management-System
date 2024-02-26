// Kafka producer for catalog change events. Every message is the envelope
//   {id, type, source, occurredAt, entityId, data}
// keyed by entityId. Publishing never throws: a broker outage must not fail an admin's change.
import { randomBytes } from "node:crypto";
import { Kafka, logLevel } from "kafkajs";
import { config } from "./index.js";
import { logger } from "./logger.js";

export const CATALOG_TOPIC = "woreda.catalog";
const SOURCE = "department-service";

export function createEventPublisher() {
  if (!config.kafkaBrokers) {
    logger.warn({ topic: CATALOG_TOPIC }, "KAFKA_BROKERS not set: events are not streamed");
    return { publish() {}, async close() {} };
  }
  const kafka = new Kafka({ clientId: SOURCE, brokers: config.kafkaBrokers.split(","), logLevel: logLevel.NOTHING });
  const producer = kafka.producer({ allowAutoTopicCreation: false });
  let ready = producer.connect().then(
    () => logger.info({ brokers: config.kafkaBrokers, topic: CATALOG_TOPIC }, "streaming events to kafka"),
    (err) => logger.error({ err: err.message }, "kafka connect failed; events will retry on next publish"),
  );

  return {
    publish(type, entityId, data) {
      const event = {
        id: randomBytes(16).toString("hex"), type, source: SOURCE,
        occurredAt: new Date().toISOString(), entityId, ...(data == null ? {} : { data }),
      };
      ready = ready
        .then(() => producer.send({ topic: CATALOG_TOPIC, acks: -1, messages: [{ key: entityId, value: JSON.stringify(event), headers: { type } }] }))
        .catch((err) => logger.error({ type, entityId, err: err.message }, "event not delivered to kafka"));
    },
    async close() {
      await ready;
      await producer.disconnect().catch(() => {});
    },
  };
}
