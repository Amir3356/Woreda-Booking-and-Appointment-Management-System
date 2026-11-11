import test from "node:test";
import assert from "node:assert/strict";
import { publicServiceSchema, departmentSchema } from "../validations/catalog.validation.js";

test("Catalog Validations - publicServiceSchema allows optional departmentId", () => {
  const result = publicServiceSchema.safeParse({
    name: "Civil Registration",
    code: "CIV-001",
    description: "General registration",
  });

  assert.equal(result.success, true);
  assert.equal(result.data.name, "Civil Registration");
  assert.equal(result.data.departmentId, null);
  assert.equal(result.data.code, "CIV-001");
});

test("Catalog Validations - departmentSchema accepts serviceIds array or string", () => {
  const result = departmentSchema.safeParse({
    name: "Legal Affairs",
    code: "LEG",
    buildingRoom: "Room 101",
    contactPhone: "+251 11 551 2341",
    serviceIds: ["srv-1", "srv-2"],
  });

  assert.equal(result.success, true);
  assert.equal(result.data.name, "Legal Affairs");
  assert.deepEqual(result.data.serviceIds, ["srv-1", "srv-2"]);
});
