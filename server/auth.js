import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Secret, TOTP } from "otpauth";

const scryptAsync = promisify(scrypt);

export const hashPassword = async (password) => {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
};

export const verifyPassword = async (password, stored) => {
  const [, salt, key] = stored.split("$");
  const expected = Buffer.from(key, "base64");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
};

// ---------- 两步验证 (TOTP) ----------

const createTotp = (secret, issuer = "Home") =>
  new TOTP({ issuer, label: "admin", secret: Secret.fromBase32(secret), digits: 6, period: 30 });

export const generateTotp = (issuer) => {
  const secret = new Secret({ size: 20 }).base32;
  return { secret, uri: createTotp(secret, issuer).toString() };
};

// 返回本次使用的时间步；已用过的时间步不再接受，防止验证码被重放
export const checkTotp = (secret, token, lastCounter) => {
  if (typeof token !== "string" || !/^\d{6}$/.test(token)) return null;
  const totp = createTotp(secret);
  const delta = totp.validate({ token, window: 1 });
  if (delta === null) return null;
  const counter = totp.counter() + delta;
  if (lastCounter != null && counter <= lastCounter) return null;
  return counter;
};

// ---------- 会话 ----------

const SESSION_TTL = 12 * 60 * 60 * 1000;
export const SESSION_COOKIE = "home_admin_session";
const sessions = new Map();

export const createSession = () => {
  const token = randomBytes(32).toString("base64url");
  sessions.set(token, { expires: Date.now() + SESSION_TTL });
  return token;
};

const readCookie = (req, name) => {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
};

export const getSession = (req) => {
  const token = readCookie(req, SESSION_COOKIE);
  const session = token && sessions.get(token);
  if (!session) return null;
  if (session.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return Object.assign(session, { token });
};

export const destroySession = (token) => sessions.delete(token);

export const destroyOtherSessions = (keepToken) => {
  for (const token of sessions.keys()) if (token !== keepToken) sessions.delete(token);
};

export const setSessionCookie = (req, res, token) => {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: req.secure,
    path: "/",
    maxAge: SESSION_TTL,
  });
};

export const clearSessionCookie = (res) => res.clearCookie(SESSION_COOKIE, { path: "/" });

// ---------- 登录失败限流 ----------

const MAX_FAILURES = 5;
const LOCK_TIME = 15 * 60 * 1000;
const failures = new Map();

export const isLocked = (ip) => {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (entry.until && entry.until < Date.now()) {
    failures.delete(ip);
    return false;
  }
  return Boolean(entry.until);
};

export const recordFailure = (ip) => {
  const entry = failures.get(ip) ?? { count: 0, until: null };
  entry.count += 1;
  if (entry.count >= MAX_FAILURES) entry.until = Date.now() + LOCK_TIME;
  failures.set(ip, entry);
};

export const clearFailures = (ip) => failures.delete(ip);
