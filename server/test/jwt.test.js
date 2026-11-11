import test from "node:test";
import assert from "node:assert/strict";
import { issueToken } from "../utils/token.js";
import {
  AUTH_COOKIE_NAME,
  extractToken,
  readCookie,
  createJwtMiddleware,
  verifyJwtToken,
} from "../middleware/jwt.js";

const TEST_SECRET = "super-secret-key-for-jwt-middleware-test";

test("JWT Middleware - extractToken extracts from Bearer header", () => {
  const req = {
    get(name) {
      if (name.toLowerCase() === "authorization") return "Bearer test.token.here";
      return "";
    },
  };
  assert.equal(extractToken(req), "test.token.here");
});

test("JWT Middleware - extractToken extracts from req.cookies", () => {
  const req = {
    get() {
      return "";
    },
    cookies: {
      [AUTH_COOKIE_NAME]: "cookie.token.here",
    },
  };
  assert.equal(extractToken(req), "cookie.token.here");
});

test("JWT Middleware - extractToken extracts from raw Cookie header", () => {
  const req = {
    get() {
      return "";
    },
    headers: {
      cookie: `foo=bar; ${AUTH_COOKIE_NAME}=raw.cookie.token; baz=qux`,
    },
  };
  assert.equal(extractToken(req), "raw.cookie.token");
});

test("JWT Middleware - readCookie parses encoded and quoted cookies", () => {
  assert.equal(readCookie(`woreda_token="token-abc"`, "woreda_token"), "token-abc");
  assert.equal(readCookie(`woreda_token=hello%20world`, "woreda_token"), "hello world");
  assert.equal(readCookie(`other=123`, "woreda_token"), "");
});

test("JWT Middleware - createJwtMiddleware verifies valid token and attaches user & ability", async () => {
  const user = { id: "user-1", fullName: "Amir Siraj", role: "ADMIN" };
  const rawToken = issueToken(TEST_SECRET, user);

  const middleware = createJwtMiddleware({ secret: TEST_SECRET });
  const req = {
    get(name) {
      if (name === "Authorization") return `Bearer ${rawToken}`;
      return "";
    },
  };

  await new Promise((resolve, reject) => {
    middleware(req, {}, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  assert.equal(req.caller.authenticated, true);
  assert.equal(req.caller.userId, "user-1");
  assert.equal(req.caller.role, "ADMIN");
  assert.equal(req.caller.name, "Amir Siraj");
  assert.equal(req.user.userId, "user-1");
  assert.equal(req.token, rawToken);
  assert.ok(req.ability);
  assert.equal(req.ability.can("manage", "all"), true);
});

test("JWT Middleware - createJwtMiddleware handles revoked token", async () => {
  const user = { id: "user-2", fullName: "Citizen One", role: "CITIZEN" };
  const rawToken = issueToken(TEST_SECRET, user);

  // Mark token as revoked
  const isRevoked = async () => true;

  // In optional mode (global app pipeline), revoked token results in anonymous caller
  const optionalMiddleware = createJwtMiddleware({ secret: TEST_SECRET, isRevoked, optional: true });
  const req1 = {
    get(name) {
      if (name === "Authorization") return `Bearer ${rawToken}`;
      return "";
    },
  };

  await new Promise((resolve) => optionalMiddleware(req1, {}, resolve));
  assert.equal(req1.caller.authenticated, false);

  // In strict mode, revoked token results in 401 Unauthorized
  const strictMiddleware = createJwtMiddleware({ secret: TEST_SECRET, isRevoked, optional: false });
  const req2 = {
    get(name) {
      if (name === "Authorization") return `Bearer ${rawToken}`;
      return "";
    },
  };

  await new Promise((resolve) => {
    strictMiddleware(req2, {}, (err) => {
      assert.ok(err);
      assert.equal(err.status, 401);
      assert.equal(err.code, "UNAUTHORIZED");
      assert.match(err.message, /revoked/i);
      resolve();
    });
  });
});

test("JWT Middleware - verifyJwtToken rejects missing token with 401", async () => {
  const req = {
    caller: { authenticated: false },
    get() {
      return "";
    },
  };

  await new Promise((resolve) => {
    verifyJwtToken(req, {}, (err) => {
      assert.ok(err);
      assert.equal(err.status, 401);
      assert.equal(err.code, "UNAUTHORIZED");
      resolve();
    });
  });
});

test("JWT Middleware - verifyJwtToken passes through already authenticated request", async () => {
  const req = {
    caller: { userId: "user-1", authenticated: true },
  };

  await new Promise((resolve, reject) => {
    verifyJwtToken(req, {}, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
});
