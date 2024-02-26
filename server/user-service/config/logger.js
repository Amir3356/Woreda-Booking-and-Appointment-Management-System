// JSON logs to stdout: {"level":"INFO","time":...,"service":"user-service","msg":...}
import pino from "pino";

export const logger = pino({
  base: { service: "user-service" },
  messageKey: "msg",
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label.toUpperCase() }) },
});
