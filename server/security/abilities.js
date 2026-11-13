// CASL Ability definitions for Role-Based Access Control (RBAC) and
// Attribute-Based Access Control (ABAC) in the Woreda Management System.
import { AbilityBuilder, createMongoAbility, subject } from "@casl/ability";

export { subject };

export const Subjects = Object.freeze({
  ALL: "all",
  AUTH: "Auth",
  STAFF: "Staff",
  PROFILE: "Profile",
  DEPARTMENT: "Department",
  SERVICE: "PublicService",
  SCHEDULE: "Schedule",
  APPOINTMENT: "Appointment",
  QUEUE: "QueueToken",
  REPORT: "Report",
  AUDIT: "AuditLog",
  SETTING: "Setting",
});

export const Actions = Object.freeze({
  MANAGE: "manage", // CASL wildcard for all actions
  CREATE: "create",
  READ: "read",
  UPDATE: "update",
  DELETE: "delete",
  READ_MINE: "readMine",
  READ_REGISTRY: "readRegistry",
  READ_STAFF_SCHEDULE: "readStaffSchedule",
  REVIEW: "review",
  RESCHEDULE: "reschedule",
  CANCEL: "cancel",
  EXPORT: "export",
});

/**
 * Builds a CASL Ability instance based on the caller's role, identity, and department scoping.
 * @param {Object} caller - { userId, role, departmentId, authenticated }
 * @returns {import("@casl/ability").MongoAbility}
 */
export function defineAbilityFor(caller) {
  const { can, build } = new AbilityBuilder(createMongoAbility);
  const role = caller?.role || "";
  const isAuthenticated = Boolean(caller?.authenticated);

  if (role === "ADMIN") {
    // Central Administrator has unrestricted access across all resources.
    can(Actions.MANAGE, Subjects.ALL);
  } else if (role === "OFFICER" && isAuthenticated) {
    // Department Officer permissions:
    // Can view public catalogs & services
    can(Actions.READ, [Subjects.DEPARTMENT, Subjects.SERVICE, Subjects.SCHEDULE]);

    // Can read registry list of appointments
    can(Actions.READ_REGISTRY, Subjects.APPOINTMENT);

    // Can read and export reports
    can([Actions.READ, Actions.EXPORT], Subjects.REPORT);

    // Can read, review, reschedule, and cancel appointments within their department
    if (caller.departmentId) {
      can([Actions.READ, Actions.REVIEW, Actions.CANCEL, Actions.RESCHEDULE], Subjects.APPOINTMENT, {
        departmentId: caller.departmentId,
      });
      can(Actions.MANAGE, Subjects.QUEUE, { departmentId: caller.departmentId });
    } else {
      // Officer without explicit department assignment has fallback access
      can([Actions.READ, Actions.REVIEW, Actions.CANCEL, Actions.RESCHEDULE], Subjects.APPOINTMENT);
      can(Actions.MANAGE, Subjects.QUEUE);
    }

    // Auth session permissions
    can([Actions.READ, Actions.DELETE], Subjects.AUTH);
  } else if (role === "CITIZEN" && isAuthenticated) {
    // Citizen permissions:
    // Can read public resources
    can(Actions.READ, [Subjects.DEPARTMENT, Subjects.SERVICE, Subjects.SCHEDULE]);

    // Can create new appointments
    can(Actions.CREATE, Subjects.APPOINTMENT);

    // Can view personal appointment list
    can(Actions.READ_MINE, Subjects.APPOINTMENT);

    // Can view, reschedule, or cancel their own appointments
    can([Actions.READ, Actions.CANCEL, Actions.RESCHEDULE], Subjects.APPOINTMENT, {
      citizenId: caller.userId,
    });

    // Can read and update their own profile
    can([Actions.READ, Actions.UPDATE], Subjects.PROFILE, {
      userId: caller.userId,
    });
    // Subject type checks for profile
    can([Actions.READ, Actions.UPDATE], Subjects.PROFILE);

    // Auth session permissions
    can([Actions.READ, Actions.DELETE], Subjects.AUTH);
  } else {
    // Public / Anonymous visitors:
    can(Actions.READ, [Subjects.DEPARTMENT, Subjects.SERVICE, Subjects.SCHEDULE]);
    can([Actions.CREATE, Actions.DELETE], Subjects.AUTH); // register, login, logout
  }

  return build();
}
