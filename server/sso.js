import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import express from "express";
import { getSession, SESSION_COOKIE } from "./auth.js";

const TICKET_TTL = 60_000;
const SSTP_ORIGIN = "https://sstp.subaimu.com";
const HOME_ORIGIN = "https://subaimu.com";

export const createSso = ({ secret = process.env.HOME_SSO_SECRET || "", now = Date.now } = {}) => {
  const tickets = new Map();
  const enabled = secret.length >= 32;
  const prune = () => {
    for (const [code, ticket] of tickets) if (ticket.expires <= now()) tickets.delete(code);
  };
  const sessionFor = (token) => getSession({ headers: { cookie: `${SESSION_COOKIE}=${token}` } });
  const sameSecret = (value) => timingSafeEqual(
    createHash("sha256").update(value).digest(),
    createHash("sha256").update(secret).digest(),
  );
  const launchLink = (item) => {
    if (!enabled) return item;
    try {
      const url = new URL(item.link);
      if (url.origin === SSTP_ORIGIN && /^\/admin\/?$/.test(url.pathname) && !url.search && !url.hash) {
        return { ...item, launchUrl: "/api/admin/launch/sstp" };
      }
    } catch { /* Unrelated links retain their existing behavior. */ }
    return item;
  };

  const router = express.Router();
  router.use((req, res, next) => {
    res.set({ "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" });
    next();
  });
  router.get("/admin/launch/sstp", (req, res) => {
    if (req.method !== "GET") return res.sendStatus(405);
    if (!enabled) return res.status(503).send("SSTP 自动登录尚未启用");
    const session = getSession(req);
    if (!session) return res.redirect(303, "/admin");
    if (req.headers.origin && req.headers.origin !== HOME_ORIGIN) return res.sendStatus(403);
    if (req.headers["sec-fetch-site"] && !["same-origin", "none"].includes(req.headers["sec-fetch-site"])) return res.sendStatus(403);
    prune();
    if (tickets.size >= 512) return res.status(429).send("请稍后重试");
    const code = randomBytes(32).toString("base64url");
    const ua = req.headers["user-agent"] || "";
    tickets.set(code, { session: session.token, ua, expires: now() + TICKET_TTL });
    const nonce = randomBytes(16).toString("base64");
    res.set({
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; form-action ${SSTP_ORIGIN}; frame-ancestors 'none'; base-uri 'none'`,
      "Referrer-Policy": "strict-origin",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
    }).type("html").send(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>正在进入 SSTP</title><form method="post" action="${SSTP_ORIGIN}/auth/home"><input type="hidden" name="code" value="${code}"><p>正在进入 SSTP…</p><button type="submit">继续</button></form><script nonce="${nonce}">document.forms[0].submit();</script></html>`);
  });
  router.post("/internal/sso/redeem", (req, res) => {
    const authorization = req.headers.authorization || "";
    if (!enabled || !sameSecret(authorization.startsWith("Bearer ") ? authorization.slice(7) : "")) {
      // The shared secret authenticates only the server-to-server exchange.
      return res.sendStatus(401);
    }
    prune();
    const { code, service, userAgent } = req.body || {};
    if (service !== "sstp" || typeof code !== "string" || !/^[\w-]{43}$/.test(code)) return res.sendStatus(400);
    const ticket = tickets.get(code);
    if (!ticket) return res.sendStatus(401);
    tickets.delete(code); // Consume synchronously, including failed exchanges.
    if (ticket.expires <= now() || userAgent !== ticket.ua || !sessionFor(ticket.session)) return res.sendStatus(401);
    return res.json({ ok: true, service: "sstp", path: "/admin" });
  });
  return { router, launchLink, enabled };
};
