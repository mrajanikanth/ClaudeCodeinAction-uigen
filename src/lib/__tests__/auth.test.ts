// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";

vi.mock("server-only", () => ({}));

const cookieSet = vi.fn();
const cookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: cookieSet,
    get: cookieGet,
    delete: vi.fn(),
  })),
}));

import { createSession, getSession } from "../auth";

const COOKIE_NAME = "auth-token";
const JWT_SECRET = new TextEncoder().encode("development-secret-key");

async function signToken(
  payload: Record<string, unknown>,
  opts: { expiresIn?: string; secret?: Uint8Array } = {}
) {
  const builder = new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt();
  if (opts.expiresIn) builder.setExpirationTime(opts.expiresIn);
  return builder.sign(opts.secret ?? JWT_SECRET);
}

beforeEach(() => {
  cookieSet.mockReset();
  cookieGet.mockReset();
  delete process.env.NODE_ENV;
});

test("createSession sets the auth-token cookie with secure defaults", async () => {
  await createSession("user-123", "alice@example.com");

  expect(cookieSet).toHaveBeenCalledTimes(1);

  const [name, token, options] = cookieSet.mock.calls[0];
  expect(name).toBe(COOKIE_NAME);
  expect(typeof token).toBe("string");
  expect(token.length).toBeGreaterThan(0);

  expect(options).toMatchObject({
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  expect(options.expires).toBeInstanceOf(Date);
});

test("createSession encodes a JWT whose payload carries userId and email", async () => {
  await createSession("user-123", "alice@example.com");

  const [, token] = cookieSet.mock.calls[0];
  const { payload } = await jwtVerify(token as string, JWT_SECRET);

  expect(payload.userId).toBe("user-123");
  expect(payload.email).toBe("alice@example.com");
});

test("createSession sets the cookie expiry approximately 7 days in the future", async () => {
  const before = Date.now();
  await createSession("user-123", "alice@example.com");
  const after = Date.now();

  const [, , options] = cookieSet.mock.calls[0];
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const expiresMs = (options.expires as Date).getTime();

  expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDaysMs);
  expect(expiresMs).toBeLessThanOrEqual(after + sevenDaysMs);
});

test("createSession issues a JWT that itself expires roughly 7 days out", async () => {
  await createSession("user-123", "alice@example.com");

  const [, token] = cookieSet.mock.calls[0];
  const { payload } = await jwtVerify(token as string, JWT_SECRET);

  const nowSec = Math.floor(Date.now() / 1000);
  const sevenDaysSec = 7 * 24 * 60 * 60;
  expect(payload.exp).toBeDefined();
  expect(payload.iat).toBeDefined();
  expect(payload.exp! - payload.iat!).toBe(sevenDaysSec);
  expect(payload.exp).toBeGreaterThan(nowSec);
});

test("createSession marks the cookie secure only in production", async () => {
  process.env.NODE_ENV = "production";
  await createSession("user-1", "a@b.com");
  const prodOptions = cookieSet.mock.calls[0][2];

  cookieSet.mockReset();

  process.env.NODE_ENV = "development";
  await createSession("user-2", "c@d.com");
  const devOptions = cookieSet.mock.calls[0][2];

  expect(prodOptions.secure).toBe(true);
  expect(devOptions.secure).toBe(false);
});

test("createSession distinguishes between different users in the issued token", async () => {
  await createSession("user-a", "a@example.com");
  const tokenA = cookieSet.mock.calls[0][1];

  cookieSet.mockReset();

  await createSession("user-b", "b@example.com");
  const tokenB = cookieSet.mock.calls[0][1];

  expect(tokenA).not.toBe(tokenB);
  const { payload: payloadA } = await jwtVerify(tokenA as string, JWT_SECRET);
  const { payload: payloadB } = await jwtVerify(tokenB as string, JWT_SECRET);
  expect(payloadA.userId).toBe("user-a");
  expect(payloadB.userId).toBe("user-b");
});

test("getSession returns null when the auth-token cookie is missing", async () => {
  cookieGet.mockReturnValue(undefined);

  const session = await getSession();

  expect(session).toBeNull();
  expect(cookieGet).toHaveBeenCalledWith(COOKIE_NAME);
});

test("getSession returns null when the cookie is present but its value is empty", async () => {
  cookieGet.mockReturnValue({ value: "" });

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns the decoded payload for a valid token", async () => {
  const token = await signToken(
    { userId: "user-123", email: "alice@example.com" },
    { expiresIn: "7d" }
  );
  cookieGet.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session).not.toBeNull();
  expect(session?.userId).toBe("user-123");
  expect(session?.email).toBe("alice@example.com");
});

test("getSession returns null when the token signature is invalid", async () => {
  const validToken = await signToken(
    { userId: "user-123", email: "alice@example.com" },
    { expiresIn: "7d" }
  );
  // Mangle the signature segment (last `.`-separated chunk) to invalidate it.
  const tampered = validToken.replace(/.$/, (c) => (c === "a" ? "b" : "a"));
  cookieGet.mockReturnValue({ value: tampered });

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns null when the token has expired", async () => {
  const expired = await new SignJWT({
    userId: "user-123",
    email: "alice@example.com",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(JWT_SECRET);
  cookieGet.mockReturnValue({ value: expired });

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns null when the token is signed with a different secret", async () => {
  const wrongSecret = new TextEncoder().encode("some-other-secret");
  const token = await signToken(
    { userId: "user-123", email: "alice@example.com" },
    { expiresIn: "7d", secret: wrongSecret }
  );
  cookieGet.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession round-trips a token produced by createSession", async () => {
  await createSession("user-rt", "rt@example.com");
  const issuedToken = cookieSet.mock.calls[0][1] as string;
  cookieGet.mockReturnValue({ value: issuedToken });

  const session = await getSession();

  expect(session?.userId).toBe("user-rt");
  expect(session?.email).toBe("rt@example.com");
});

test("getSession returns null when the cookie value is not a JWT at all", async () => {
  cookieGet.mockReturnValue({ value: "not-a-jwt" });

  const session = await getSession();

  expect(session).toBeNull();
});
