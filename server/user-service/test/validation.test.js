import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cursorMeta, decodeProfile, decodeSettings, isValidEmail, isValidEthiopianPhone, pageParams, roleLabel,
  settingsView, validateProfile, validateProvision, validateSettings,
} from "../validation.js";
import { ilikeContains } from "../users.js";

const issues = (fn) => {
  try {
    fn();
  } catch (err) {
    return err.details.map((d) => d.field);
  }
  return [];
};

test("phone format", () => {
  assert.ok(isValidEthiopianPhone("+251911223344"));
  assert.ok(isValidEthiopianPhone(" +251911223344 "));
  assert.ok(!isValidEthiopianPhone("0911223344"));
  assert.ok(!isValidEthiopianPhone("+25191122334"));
});

test("email format", () => {
  assert.ok(isValidEmail("a.b+c@example.com"));
  assert.ok(isValidEmail(" a@b "));
  assert.ok(!isValidEmail(""));
  assert.ok(!isValidEmail("Amir <a@b.com>"));
  assert.ok(!isValidEmail("a@@b"));
  assert.ok(!isValidEmail("a..b@c"));
});

test("decode applies Go zero values and rejects wrong types", () => {
  assert.deepEqual(decodeProfile({ fullName: "Abc", extra: 1, phone: null }), {
    fullName: "Abc", phone: "", email: "", nationalId: "", address: "",
  });
  assert.throws(() => decodeProfile({ fullName: 5 }), {
    status: 400,
    message: "malformed JSON body: json: cannot unmarshal number into Go struct field CitizenProfile.fullName of type string",
  });
  assert.throws(() => decodeSettings({ maxParallelSlots: 1.5 }), /cannot unmarshal number 1.5 into Go struct field Settings.maxParallelSlots of type int/);
  assert.throws(() => decodeSettings({ smsGatewayActive: "yes" }), /unmarshal string into .* of type bool/);
});

test("profile validation trims and checks", () => {
  const p = validateProfile({ fullName: "  Abebe  ", phone: " +251911223344", email: "x", nationalId: "y", address: " A " });
  assert.equal(p.fullName, "Abebe");
  assert.equal(p.address, "A");
  assert.deepEqual(issues(() => validateProfile({ fullName: "ab", phone: "1", email: "", nationalId: "", address: "" })), ["fullName", "phone"]);
});

test("provision validation", () => {
  const base = { fullName: "Officer One", email: "o@x.com", password: "12345678", role: "Department Officer", departmentId: "dept-1" };
  assert.deepEqual(validateProvision(base), { ...base, role: "OFFICER" });
  assert.equal(validateProvision({ ...base, role: "ADMIN", departmentId: "" }).departmentId, null);
  assert.equal(validateProvision({ ...base, role: "Central Administrator" }).role, "ADMIN");
  assert.deepEqual(issues(() => validateProvision({ ...base, departmentId: "" })), ["departmentId"]);
  assert.deepEqual(
    issues(() => validateProvision({ fullName: "x", email: "bad", password: "short", role: "CITIZEN", departmentId: "" })),
    ["role", "fullName", "email", "password"],
  );
});

test("settings validation", () => {
  const s = decodeSettings({ woredaName: "W" });
  assert.equal(validateSettings(s).maxParallelSlots, 3);
  assert.equal(validateSettings({ ...s, maxParallelSlots: 5 }).maxParallelSlots, 5);
  assert.deepEqual(issues(() => validateSettings({ ...s, woredaName: "  " })), ["woredaName"]);
  assert.equal(settingsView({ receptionPhone: "1" }).emergencyPhone, "1");
});

test("cursor pagination", () => {
  assert.deepEqual(pageParams(undefined, undefined), { cursor: 0, pageSize: 5 });
  assert.deepEqual(pageParams("-3", "101"), { cursor: 0, pageSize: 5 });
  assert.deepEqual(pageParams("10", "20"), { cursor: 10, pageSize: 20 });
  assert.deepEqual(pageParams("abc", "1.5"), { cursor: 0, pageSize: 5 });
  assert.deepEqual(cursorMeta(5, 5, 11), { current: 5, pageSize: 5, totalCount: 11, hasPrev: true, hasNext: true });
  assert.deepEqual(cursorMeta(0, 5, 5), { current: 0, pageSize: 5, totalCount: 5, hasPrev: false, hasNext: false });
});

test("role labels and ILIKE search", () => {
  assert.equal(roleLabel("OFFICER"), "Department Officer");
  assert.equal(roleLabel("ADMIN"), "Central Administrator");
  assert.ok(ilikeContains("AMIR").test("amir siraj"));
  assert.ok(ilikeContains("a.b").test("A.B") && !ilikeContains("a.b").test("axb"));
  assert.ok(ilikeContains("a_c").test("abc"));
});
