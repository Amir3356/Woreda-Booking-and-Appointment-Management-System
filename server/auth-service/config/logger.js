// JSON logs to stdout: {"level":"INFO","time":...,"service":"auth-service","msg":...}
import pino from "pino";

export const logger = pino({
  base: { service: "auth-service" },
  messageKey: "msg",
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label.toUpperCase() }) },
});
