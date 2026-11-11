// Request validation with Zod. Routes attach validate({ body, query }) with schemas from
// src/validations; the parsed (trimmed, defaulted, converted) values replace req.body and are put
// on req.validatedQuery. Failures become 422 VALIDATION_ERROR with one {field, issue} per problem.
import { BadRequestError, ValidationError } from "../utils/errors.js";

export function toValidationError(zodError) {
  const seen = new Set();
  const details = [];
  for (const issue of zodError.issues) {
    const field = issue.path.join(".");
    const key = `${field}|${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    details.push({ field, issue: issue.message });
  }
  return new ValidationError(details);
}

export function validate({ body, query } = {}) {
  return (req, _res, next) => {
    if (body) {
      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return next(new BadRequestError("malformed JSON body: expected a JSON object"));
      }
      const parsed = body.safeParse(req.body);
      if (!parsed.success) return next(toValidationError(parsed.error));
      req.body = parsed.data;
    }
    if (query) {
      const parsed = query.safeParse(req.query);
      if (!parsed.success) return next(toValidationError(parsed.error));
      req.validatedQuery = parsed.data;
    }
    next();
  };
}
