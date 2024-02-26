// One log line per request: method, path, status, duration, request ID.
export function requestLogger(logger) {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    const path = req.path; // before routing: a router mounted on a prefix strips it from req.path
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      logger.info(
        { method: req.method, path, status: res.statusCode, duration: `${ms.toFixed(2)}ms`, requestId: req.get("X-Request-ID") || "" },
        "request",
      );
    });
    next();
  };
}
