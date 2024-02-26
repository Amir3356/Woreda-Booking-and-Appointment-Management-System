// JSON logs to stdout: {"level":"INFO","time":...,"service":"api-gateway","msg":...}
import pino from "pino";

export const logger = pino({
  base: { service: "api-gateway" },
  messageKey: "msg",
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label.toUpperCase() }) },
});
