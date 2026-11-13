// Express middleware integration for CASL Role-Based Access Control (RBAC).
import { defineAbilityFor } from "../security/abilities.js";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";

/**
 * Route guard middleware that ensures the caller's CASL ability permits the specified action on the subject.
 * Returns 401 Unauthorized if the user is not authenticated, or 403 Forbidden if permissions are insufficient.
 *
 * @param {string} action - Action name (e.g. 'read', 'create', 'update', 'delete', 'manage')
 * @param {string|Function} subjectType - CASL Subject name (e.g. 'Appointment', 'Department')
 * @param {Function} [subjectResolver] - Optional resolver function (req) => subject instance
 */
export function checkAbility(action, subjectType, subjectResolver) {
  return (req, _res, next) => {
    const ability = req.ability || defineAbilityFor(req.caller);
    const target = typeof subjectResolver === "function" ? subjectResolver(req) : subjectType;

    if (!ability.can(action, target)) {
      if (!req.caller?.authenticated) {
        return next(new UnauthorizedError("Authentication required to access this resource."));
      }
      return next(new ForbiddenError(`Forbidden: Insufficient permissions to perform ${action} on ${typeof target === "string" ? target : subjectType}.`));
    }

    next();
  };
}
