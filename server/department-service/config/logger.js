// JSON logs to stdout: {"level":"INFO","time":...,"service":"department-service","msg":...}
import pino from "pino";

export const logger = pino({
  base: { service: "department-service" },
  messageKey: "msg",
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label.toUpperCase() }) },
});
