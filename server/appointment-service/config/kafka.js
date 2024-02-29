// Kafka producer for appointment lifecycle events. Every message is the envelope
//   {id, type, source, occurredAt, appointmentId, data}
// keyed by appointmentId, so all events of one appointment land on the same partition and stay in order.
// Publishing never throws: a broker outage must not fail the user's request.
import { randomBytes } from "node:crypto";
import { Kafka, logLevel } from "kafkajs";
import { config } from "./index.js";
import { logger } from "./logger.js";
import { counter } from "./metrics.js";

const kafkaEvents = counter("woreda_kafka_events_total", "Events published to Kafka, by topic and result (sent or failed).", ["topic", "result"]);

export const APPOINTMENTS_TOPIC = "woreda.appointments";
const SOURCE = "appointment-service";

export function createEventPublisher() {
  if (!config.kafkaBrokers) {
    logger.warn({ topic: APPOINTMENTS_TOPIC }, "KAFKA_BROKERS not set: events are not streamed");
    return { publish() {}, async close() {} };
  }
  const kafka = new Kafka({ clientId: SOURCE, brokers: config.kafkaBrokers.split(","), logLevel: logLevel.NOTHING });
  const producer = kafka.producer({ allowAutoTopicCreation: false });
  // Track the connection, so a publish after a failed start (Kafka not ready yet) or a broker
  // restart connects again instead of failing with "The producer is disconnected".
  let connected = false;
  producer.on(producer.events.CONNECT, () => {
    connected = true;
  });
  producer.on(producer.events.DISCONNECT, () => {
    connected = false;
  });
  const connect = () =>
    producer.connect().then(() => logger.info({ brokers: config.kafkaBrokers, topic: APPOINTMENTS_TOPIC }, "streaming events to kafka"));
  let ready = connect().catch((err) =>
    logger.error({ err: err.message }, "kafka connect failed; events will retry on next publish"),
  );

  return {
    publish(type, key, data) {
      const event = {
        id: randomBytes(16).toString("hex"), type, source: SOURCE,
        occurredAt: new Date().toISOString(), appointmentId: key, ...(data == null ? {} : { data }),
      };
      ready = ready
        .then(() => (connected ? undefined : connect()))
        .then(() => producer.send({ topic: APPOINTMENTS_TOPIC, acks: -1, messages: [{ key, value: JSON.stringify(event), headers: { type } }] }))
        .then(() => kafkaEvents.inc({ topic: APPOINTMENTS_TOPIC, result: "sent" }))
        .catch((err) => {
          kafkaEvents.inc({ topic: APPOINTMENTS_TOPIC, result: "failed" });
          logger.error({ type, key, err: err.message }, "event not delivered to kafka");
        });
    },
    async close() {
      await ready;
      await producer.disconnect().catch(() => {});
    },
  };
}
