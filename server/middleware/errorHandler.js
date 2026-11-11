// Turns thrown errors into the API error envelope.
import { ForbiddenError as CaslForbiddenError } from "@casl/ability";
import { AppError, BadRequestError } from "../utils/errors.js";
import { fail } from "../utils/response.js";

/** Unknown routes. */
export function notFound(req, res) {
  fail(res, req, 404, "NOT_FOUND", "Route not found.");
}

/** Final error middleware: AppError / CASL ForbiddenError -> its envelope; anything else -> logged 500. */
export function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    if (err?.type === "entity.parse.failed") err = new BadRequestError(`malformed JSON body: ${err.message}`);
    else if (err?.type === "entity.too.large") err = new BadRequestError("request body is larger than 1 MiB");

    if (err instanceof CaslForbiddenError) {
      return fail(res, req, 403, "FORBIDDEN", err.message || "Insufficient role permissions.");
    }
    if (err instanceof AppError) return fail(res, req, err.status, err.code, err.message, err.details);
    logger.error({ path: req.path, err: err?.stack ?? String(err) }, "unhandled error");
    return fail(res, req, 500, "INTERNAL_ERROR", "Unhandled server exception.");
  };
}
