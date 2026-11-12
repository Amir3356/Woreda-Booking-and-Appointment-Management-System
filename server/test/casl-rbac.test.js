import test from "node:test";
import assert from "node:assert/strict";
import { defineAbilityFor, Subjects, Actions, subject } from "../security/abilities.js";
import { checkAbility } from "../middleware/casl.js";
import { ForbiddenError as CaslForbiddenError } from "@casl/ability";
import { errorHandler } from "../middleware/errorHandler.js";

test("CASL Abilities - ADMIN permissions", () => {
  const adminCaller = { userId: "admin-1", role: "ADMIN", authenticated: true };
  const ability = defineAbilityFor(adminCaller);

  assert.equal(ability.can(Actions.MANAGE, Subjects.ALL), true);
  assert.equal(ability.can(Actions.CREATE, Subjects.STAFF), true);
  assert.equal(ability.can(Actions.DELETE, Subjects.DEPARTMENT), true);
  assert.equal(ability.can(Actions.UPDATE, Subjects.SETTING), true);
  assert.equal(ability.can(Actions.READ, Subjects.AUDIT), true);
  assert.equal(ability.can(Actions.CANCEL, subject(Subjects.APPOINTMENT, { departmentId: "d1", citizenId: "c1" })), true);
});

test("CASL Abilities - OFFICER permissions (with department scope)", () => {
  const officerCaller = { userId: "off-1", role: "OFFICER", departmentId: "dept-urban", authenticated: true };
  const ability = defineAbilityFor(officerCaller);

  // General allowed
  assert.equal(ability.can(Actions.READ, Subjects.DEPARTMENT), true);
  assert.equal(ability.can(Actions.READ, Subjects.SERVICE), true);
  // Schedule Management is administrator-only (no officer schedule view)
  assert.equal(ability.can(Actions.READ_STAFF_SCHEDULE, Subjects.SCHEDULE), false);
  assert.equal(ability.can(Actions.READ_REGISTRY, Subjects.APPOINTMENT), true);
  assert.equal(ability.can(Actions.READ, Subjects.REPORT), true);
  assert.equal(ability.can(Actions.EXPORT, Subjects.REPORT), true);

  // Scoped to own department
  const ownApt = { id: "a1", departmentId: "dept-urban", citizenId: "c1" };
  const otherApt = { id: "a2", departmentId: "dept-health", citizenId: "c2" };
  assert.equal(ability.can(Actions.READ, subject(Subjects.APPOINTMENT, ownApt)), true);
  assert.equal(ability.can(Actions.READ, subject(Subjects.APPOINTMENT, otherApt)), false);
  assert.equal(ability.can(Actions.REVIEW, subject(Subjects.APPOINTMENT, ownApt)), true);
  assert.equal(ability.can(Actions.REVIEW, subject(Subjects.APPOINTMENT, otherApt)), false);
  assert.equal(ability.can(Actions.MANAGE, subject(Subjects.QUEUE, { departmentId: "dept-urban" })), true);
  assert.equal(ability.can(Actions.MANAGE, subject(Subjects.QUEUE, { departmentId: "dept-health" })), false);

  // Disallowed admin actions
  assert.equal(ability.can(Actions.MANAGE, Subjects.STAFF), false);
  assert.equal(ability.can(Actions.UPDATE, Subjects.SETTING), false);
  assert.equal(ability.can(Actions.READ, Subjects.AUDIT), false);
  assert.equal(ability.can(Actions.CREATE, Subjects.DEPARTMENT), false);
});

test("CASL Abilities - CITIZEN permissions (with ownership scope)", () => {
  const citizenCaller = { userId: "cit-1", role: "CITIZEN", authenticated: true };
  const ability = defineAbilityFor(citizenCaller);

  // Allowed
  assert.equal(ability.can(Actions.READ, Subjects.DEPARTMENT), true);
  assert.equal(ability.can(Actions.CREATE, Subjects.APPOINTMENT), true);
  assert.equal(ability.can(Actions.READ_MINE, Subjects.APPOINTMENT), true);
  assert.equal(ability.can(Actions.READ, Subjects.PROFILE), true);
  assert.equal(ability.can(Actions.UPDATE, Subjects.PROFILE), true);

  // Scoped ownership
  const ownApt = { id: "a1", citizenId: "cit-1", departmentId: "dept-urban" };
  const otherApt = { id: "a2", citizenId: "cit-2", departmentId: "dept-urban" };
  assert.equal(ability.can(Actions.READ, subject(Subjects.APPOINTMENT, ownApt)), true);
  assert.equal(ability.can(Actions.READ, subject(Subjects.APPOINTMENT, otherApt)), false);
  assert.equal(ability.can(Actions.CANCEL, subject(Subjects.APPOINTMENT, ownApt)), true);
  assert.equal(ability.can(Actions.CANCEL, subject(Subjects.APPOINTMENT, otherApt)), false);

  // Disallowed officer/admin actions
  assert.equal(ability.can(Actions.REVIEW, Subjects.APPOINTMENT), false);
  assert.equal(ability.can(Actions.READ_REGISTRY, Subjects.APPOINTMENT), false);
  assert.equal(ability.can(Actions.READ_STAFF_SCHEDULE, Subjects.SCHEDULE), false);
  assert.equal(ability.can(Actions.MANAGE, Subjects.QUEUE), false);
  assert.equal(ability.can(Actions.READ, Subjects.REPORT), false);
  assert.equal(ability.can(Actions.MANAGE, Subjects.STAFF), false);
});

test("CASL Abilities - ANONYMOUS permissions", () => {
  const anonCaller = { userId: "", role: "", authenticated: false };
  const ability = defineAbilityFor(anonCaller);

  assert.equal(ability.can(Actions.READ, Subjects.DEPARTMENT), true);
  assert.equal(ability.can(Actions.READ, Subjects.SERVICE), true);
  assert.equal(ability.can(Actions.CREATE, Subjects.AUTH), true);

  // Forbidden
  assert.equal(ability.can(Actions.CREATE, Subjects.APPOINTMENT), false);
  assert.equal(ability.can(Actions.READ_MINE, Subjects.APPOINTMENT), false);
  assert.equal(ability.can(Actions.READ, Subjects.PROFILE), false);
  assert.equal(ability.can(Actions.MANAGE, Subjects.ALL), false);
});

test("CASL Express Middleware - checkAbility returns 401 when anonymous", (t, done) => {
  const middleware = checkAbility(Actions.CREATE, Subjects.APPOINTMENT);
  const req = { caller: { authenticated: false } };

  middleware(req, {}, (err) => {
    assert.ok(err);
    assert.equal(err.status, 401);
    assert.equal(err.code, "UNAUTHORIZED");
    done();
  });
});

test("CASL Express Middleware - checkAbility returns 403 when role is forbidden", (t, done) => {
  const middleware = checkAbility(Actions.MANAGE, Subjects.STAFF);
  const req = {
    caller: { userId: "cit-1", role: "CITIZEN", authenticated: true },
    ability: defineAbilityFor({ userId: "cit-1", role: "CITIZEN", authenticated: true }),
  };

  middleware(req, {}, (err) => {
    assert.ok(err);
    assert.equal(err.status, 403);
    assert.equal(err.code, "FORBIDDEN");
    done();
  });
});

test("CASL Express Middleware - checkAbility calls next() when permitted", (t, done) => {
  const middleware = checkAbility(Actions.MANAGE, Subjects.STAFF);
  const req = {
    caller: { userId: "adm-1", role: "ADMIN", authenticated: true },
    ability: defineAbilityFor({ userId: "adm-1", role: "ADMIN", authenticated: true }),
  };

  middleware(req, {}, (err) => {
    assert.equal(err, undefined);
    done();
  });
});

test("CASL ErrorHandler - formats CASL ForbiddenError properly", () => {
  const handler = errorHandler({ error: () => {} });
  let responseStatus = null;
  let responseJson = null;

  const mockRes = {
    status(s) {
      responseStatus = s;
      return this;
    },
    json(j) {
      responseJson = j;
      return this;
    },
  };
  const mockReq = {
    get() {
      return "req-test-123";
    },
  };

  const ability = defineAbilityFor({ role: "CITIZEN", authenticated: true });
  let caslErr;
  try {
    CaslForbiddenError.from(ability).throwUnlessCan("manage", "Staff");
  } catch (err) {
    caslErr = err;
  }

  assert.ok(caslErr instanceof CaslForbiddenError);
  handler(caslErr, mockReq, mockRes, () => {});

  assert.equal(responseStatus, 403);
  assert.equal(responseJson.success, false);
  assert.equal(responseJson.error.code, "FORBIDDEN");
  assert.match(responseJson.message, /Cannot execute "manage" on "Staff"/);
  assert.equal(responseJson.meta.requestId, "req-test-123");
});
