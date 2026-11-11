import test from "node:test";
import assert from "node:assert/strict";
import { staffListQuery, updateStaffSchema } from "../validations/user.validation.js";
import { cursorMeta } from "../utils/pagination.js";

test("Staff Validations - staffListQuery defaults to cursor 0 and pageSize 4", () => {
  const result = staffListQuery.safeParse({});

  assert.equal(result.success, true);
  assert.equal(result.data.search, "");
  assert.equal(result.data.cursor, 0);
  assert.equal(result.data.pageSize, 4);
});

test("Staff Validations - staffListQuery accepts custom cursor, pageSize, and search", () => {
  const result = staffListQuery.safeParse({
    search: "+2519",
    cursor: "4",
    pageSize: "4",
  });

  assert.equal(result.success, true);
  assert.equal(result.data.search, "+2519");
  assert.equal(result.data.cursor, 4);
  assert.equal(result.data.pageSize, 4);
});

test("Staff Validations - updateStaffSchema allows blank password to keep existing password", () => {
  const result = updateStaffSchema.safeParse({
    fullName: "Bekele Tadesse",
    phone: "+251911234567",
    password: "",
    role: "Department Officer",
    departmentId: "dept-123",
  });

  assert.equal(result.success, true);
  assert.equal(result.data.password, "");
  assert.equal(result.data.role, "OFFICER");
  assert.equal(result.data.departmentId, "dept-123");
});

test("Cursor Pagination - cursorMeta computes prev/next cursors accurately for 4 per page", () => {
  assert.deepEqual(cursorMeta(0, 4, 9), {
    current: 0,
    pageSize: 4,
    totalCount: 9,
    hasPrev: false,
    hasNext: true,
    nextCursor: 4,
    prevCursor: null,
  });

  assert.deepEqual(cursorMeta(4, 4, 9), {
    current: 4,
    pageSize: 4,
    totalCount: 9,
    hasPrev: true,
    hasNext: true,
    nextCursor: 8,
    prevCursor: 0,
  });

  assert.deepEqual(cursorMeta(8, 4, 9), {
    current: 8,
    pageSize: 4,
    totalCount: 9,
    hasPrev: true,
    hasNext: false,
    nextCursor: null,
    prevCursor: 4,
  });
});

