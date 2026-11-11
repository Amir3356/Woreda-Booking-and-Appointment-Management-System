import test from "node:test";
import assert from "node:assert/strict";
import { citizenListQuery, provisionSchema } from "../validations/user.validation.js";
import { cursorMeta } from "../utils/pagination.js";

test("Citizen Validations - citizenListQuery defaults to cursor 0 and pageSize 5", () => {
  const result = citizenListQuery.safeParse({});

  assert.equal(result.success, true);
  assert.equal(result.data.search, "");
  assert.equal(result.data.woreda, "");
  assert.equal(result.data.kebele, "");
  assert.equal(result.data.location, "");
  assert.equal(result.data.cursor, 0);
  assert.equal(result.data.pageSize, 5);
});

test("Citizen Validations - citizenListQuery parses search, filters, and cursor pagination", () => {
  const result = citizenListQuery.safeParse({
    search: "Almaz",
    woreda: "Woreda 03",
    kebele: "Kebele 02",
    location: "Bole Sub-City, Addis Ababa",
    cursor: "5",
    pageSize: "5",
  });

  assert.equal(result.success, true);
  assert.equal(result.data.search, "Almaz");
  assert.equal(result.data.woreda, "Woreda 03");
  assert.equal(result.data.kebele, "Kebele 02");
  assert.equal(result.data.location, "Bole Sub-City, Addis Ababa");
  assert.equal(result.data.cursor, 5);
  assert.equal(result.data.pageSize, 5);
});

test("Cursor Pagination - cursorMeta computes prev/next cursors accurately for 5 per page", () => {
  // Page 1 of 3 (total = 12)
  assert.deepEqual(cursorMeta(0, 5, 12), {
    current: 0,
    pageSize: 5,
    totalCount: 12,
    hasPrev: false,
    hasNext: true,
    nextCursor: 5,
    prevCursor: null,
  });

  // Page 2 of 3 (total = 12)
  assert.deepEqual(cursorMeta(5, 5, 12), {
    current: 5,
    pageSize: 5,
    totalCount: 12,
    hasPrev: true,
    hasNext: true,
    nextCursor: 10,
    prevCursor: 0,
  });

  // Page 3 of 3 (total = 12)
  assert.deepEqual(cursorMeta(10, 5, 12), {
    current: 10,
    pageSize: 5,
    totalCount: 12,
    hasPrev: true,
    hasNext: false,
    nextCursor: null,
    prevCursor: 5,
  });

  // Empty dataset
  assert.deepEqual(cursorMeta(0, 5, 0), {
    current: 0,
    pageSize: 5,
    totalCount: 0,
    hasPrev: false,
    hasNext: false,
    nextCursor: null,
    prevCursor: null,
  });
});

test("Staff Validations - provisionSchema allows any character password without 8-char minimum restriction", () => {
  const result = provisionSchema.safeParse({
    fullName: "Abebe Kebede",
    phone: "+251911223344",
    password: "abc",
    role: "Department Officer",
    departmentId: "dept-1",
  });

  assert.equal(result.success, true);
  assert.equal(result.data.password, "abc");
});

