// Fire-and-forget Kafka publishing with the event envelope every consumer expects:
//   {id, type, source, occurredAt, <keyField>, data}
// The key field (e.g. "appointmentId" or "entityId") is also the message key, so all events
// of one entity land on the same partition and stay in order.
// Publishing never throws: a broker outage must not fail the user's request.
import { randomBytes } from "node:crypto";
import { Kafka, logLevel } from "kafkajs";

export function createPublisher({ brokers, topic, source, keyField, logger }) {
  if (!brokers) {
    logger.warn({ topic }, "KAFKA_BROKERS not set: events are not streamed");
    return { publish() {}, async close() {} };
  }
  const kafka = new Kafka({ clientId: source, brokers: brokers.split(","), logLevel: logLevel.NOTHING });
  const producer = kafka.producer({ allowAutoTopicCreation: false });
  let ready = producer.connect().then(
    () => logger.info({ brokers, topic }, "streaming events to kafka"),
    (err) => logger.error({ err: err.message }, "kafka connect failed; events will retry on next publish"),
  );

  return {
    publish(type, key, data) {
      const event = {
        id: randomBytes(16).toString("hex"), type, source,
        occurredAt: new Date().toISOString(), [keyField]: key, ...(data == null ? {} : { data }),
      };
      ready = ready
        .then(() => producer.send({
          topic, acks: -1,
          messages: [{ key, value: JSON.stringify(event), headers: { type } }],
        }))
        .catch((err) => logger.error({ type, key, err: err.message }, "event not delivered to kafka"));
    },
    async close() {
      await ready;
      await producer.disconnect().catch(() => {});
    },
  };
}
