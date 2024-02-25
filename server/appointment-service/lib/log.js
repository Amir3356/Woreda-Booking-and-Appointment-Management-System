// JSON logs to stdout, one line per request, as the Go services did.
import pino from "pino";

export function createLogger(service) {
  return pino({
    base: { service },
    messageKey: "msg",
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label.toUpperCase() }) },
  });
}

export function requestLogger(logger) {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      logger.info(
        { method: req.method, path: req.path, status: res.statusCode, duration: `${ms.toFixed(2)}ms`, requestId: req.get("X-Request-ID") || "" },
        "request",
      );
    });
    next();
  };
}
