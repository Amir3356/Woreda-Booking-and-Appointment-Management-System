// Errors a service throws; errorHandler (http.js) turns each into the API.md error envelope.
// Messages keep the Go services' "<kind>: <detail>" wording, which the web app relies on.

export class AppError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** 422 with one entry per invalid field. Collect issues, then call throwIfAny(). */
export class ValidationError extends AppError {
  constructor(issues = []) {
    super(422, "VALIDATION_ERROR", "Validation failed for the submitted fields.", issues);
  }
  add(field, issue) {
    this.details.push({ field, issue });
    return this;
  }
  throwIfAny() {
    if (this.details.length > 0) throw this;
  }
}

export class BadRequestError extends AppError {
  constructor(message) {
    super(400, "BAD_REQUEST", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Requested entity does not exist.") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(detail) {
    super(409, "CONFLICT", `conflict: ${detail}`);
  }
}

export class UnauthorizedError extends AppError {
  constructor(detail = "Missing or expired bearer token.") {
    super(401, "UNAUTHORIZED", detail.startsWith("Missing") ? detail : `unauthorized: ${detail}`);
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super(403, "FORBIDDEN", "Insufficient role permissions.");
  }
}

export class TooManyAttemptsError extends AppError {
  constructor(detail) {
    super(429, "TOO_MANY_ATTEMPTS", `too many attempts: ${detail}`);
  }
}

/** A service this one depends on (catalog over gRPC, ...) could not answer. */
export class UnavailableError extends AppError {
  constructor(cause) {
    super(503, "SERVICE_UNAVAILABLE", "A required service is temporarily unavailable. Please try again shortly.");
    this.cause = cause;
  }
}

/** True for MongoDB duplicate-key errors (unique index violations). */
export const isDuplicateKey = (err) => err?.code === 11000;

/** 409 when a time slot already holds system_settings.maxParallelSlots appointments. */
export class SlotFullError extends AppError {
  constructor() {
    super(409, "SLOT_FULL", "Desired time slot capacity reached maximum parallel limit.");
  }
}
