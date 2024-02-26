// JSON logs to stdout: {"level":"INFO","time":...,"service":"booking-service","msg":...}
import pino from "pino";

export const logger = pino({
  base: { service: "booking-service" },
  messageKey: "msg",
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label.toUpperCase() }) },
});
