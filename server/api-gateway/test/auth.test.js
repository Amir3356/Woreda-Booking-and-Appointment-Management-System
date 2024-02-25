import { test } from "node:test";
import assert from "node:assert/strict";
import { isPublic, readCookie } from "../auth.js";
import { cleanPath } from "../paths.js";

test("public routes match Go's publicRoutes", () => {
  for (const [m, p] of [
    ["GET", "/healthz"], ["HEAD", "/healthz"], ["POST", "/api/v1/auth/login"], ["POST", "/api/v1/auth/register"],
    ["GET", "/api/v1/departments"], ["GET", "/api/v1/services"], ["GET", "/api/v1/schedules/availability"],
    ["POST", "/api/v1/appointments"], ["GET", "/api/v1/appointments/track"], ["GET", "/api/v1/appointments/apt-1/slip"],
    ["GET", "/api/v1/ws"], ["GET", "/api/v1//departments"],
  ]) assert.ok(isPublic(m, p), `${m} ${p}`);
  for (const [m, p] of [
    ["POST", "/api/v1/departments"], ["GET", "/api/v1/departments/dept-1"], ["GET", "/api/v1/appointments"],
    ["GET", "/api/v1/appointments//slip"], ["POST", "/api/v1/auth/logout"], ["POST", "/healthz"], ["GET", "/api/v1/auth/me"],
  ]) assert.ok(!isPublic(m, p), `${m} ${p}`);
});

test("readCookie and cleanPath", () => {
  assert.equal(readCookie("a=1; woreda_token=abc.def; b=2", "woreda_token"), "abc.def");
  assert.equal(readCookie('woreda_token="q"', "woreda_token"), "q");
  assert.equal(readCookie("other=1", "woreda_token"), "");
  assert.equal(cleanPath("/api/v1//x/../y/"), "/api/v1/y/");
  assert.equal(cleanPath("/.."), "/");
});
