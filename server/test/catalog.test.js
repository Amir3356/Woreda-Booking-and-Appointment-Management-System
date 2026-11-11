import test from "node:test";
import assert from "node:assert/strict";
import { publicServiceSchema, departmentSchema, departmentListQuery, publicServiceListQuery } from "../validations/catalog.validation.js";
import { cursorMeta } from "../utils/pagination.js";

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

test("Catalog Validations - departmentListQuery accepts cursor-based pagination and search", () => {
  const result = departmentListQuery.safeParse({
    search: "Registration",
    status: "Active",
    cursor: "5",
    pageSize: "5",
  });

  assert.equal(result.success, true);
  assert.equal(result.data.search, "Registration");
  assert.equal(result.data.status, "Active");
  assert.equal(result.data.cursor, 5);
  assert.equal(result.data.pageSize, 5);
});

test("Catalog Validations - publicServiceListQuery accepts cursor-based pagination, status, serviceId, and search", () => {
  const result = publicServiceListQuery.safeParse({
    search: "Certificate",
    serviceId: "srv-123",
    status: "Active",
    cursor: "4",
    pageSize: "4",
  });

  assert.equal(result.success, true);
  assert.equal(result.data.search, "Certificate");
  assert.equal(result.data.serviceId, "srv-123");
  assert.equal(result.data.status, "Active");
  assert.equal(result.data.cursor, 4);
  assert.equal(result.data.pageSize, 4);
});

test("Cursor Pagination - cursorMeta computes prev/next cursors for 4 services per page", () => {
  // Page 1 of 3 (total = 10)
  assert.deepEqual(cursorMeta(0, 4, 10), {
    current: 0,
    pageSize: 4,
    totalCount: 10,
    hasPrev: false,
    hasNext: true,
    nextCursor: 4,
    prevCursor: null,
  });

  // Page 2 of 3 (total = 10)
  assert.deepEqual(cursorMeta(4, 4, 10), {
    current: 4,
    pageSize: 4,
    totalCount: 10,
    hasPrev: true,
    hasNext: true,
    nextCursor: 8,
    prevCursor: 0,
  });

  // Page 3 of 3 (total = 10, remaining 2 items)
  assert.deepEqual(cursorMeta(8, 4, 10), {
    current: 8,
    pageSize: 4,
    totalCount: 10,
    hasPrev: true,
    hasNext: false,
    nextCursor: null,
    prevCursor: 4,
  });
});
