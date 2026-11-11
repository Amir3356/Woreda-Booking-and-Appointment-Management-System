// Errors the services throw; middleware/errorHandler.js turns each into the API error envelope.
// Messages keep the "<kind>: <detail>" wording the web app relies on.

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

/** Throws a 422 for a single field. */
export function invalid(field, issue) {
  throw new ValidationError().add(field, issue);
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
  constructor(message = "Insufficient role permissions.") {
    super(403, "FORBIDDEN", message);
  }
}

export class TooManyAttemptsError extends AppError {
  constructor(detail) {
    super(429, "TOO_MANY_ATTEMPTS", `too many attempts: ${detail}`);
  }
}

/** 409 when a service's day already holds the schedule's daily capacity. */
export class DailyCapacityError extends AppError {
  constructor(capacity, date) {
    super(409, "DAILY_CAPACITY_REACHED", `Daily capacity reached: all ${capacity} appointments for this service on ${date} are booked.`);
  }
}

/** 409 when a time slot already holds its parallel-booking limit. */
export class SlotFullError extends AppError {
  constructor() {
    super(409, "SLOT_FULL", "Desired time slot capacity reached maximum parallel limit.");
  }
}

/** PostgreSQL unique-constraint violation. */
export const isDuplicateKey = (err) => err?.code === "23505";
