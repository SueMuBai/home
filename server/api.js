import express from "express";
import QRCode from "qrcode";
import {
  checkTotp,
  clearFailures,
  clearSessionCookie,
  createSession,
  destroyOtherSessions,
  destroySession,
  generateTotp,
  getSession,
  hashPassword,
  isLocked,
  recordFailure,
  setSessionCookie,
  verifyPassword,
} from "./auth.js";
import { getAuth, getConfig, saveAuth, saveConfig } from "./store.js";
import { ConfigError, sanitizeConfig } from "./validate.js";
import { sendLoginForm } from "./login-form.js";

const MIN_PASSWORD = 8;

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const requireAdmin = (req, res, next) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ message: "请先登录" });
  req.session = session;
  next();
};

export const createApi = ({ access, vault, bridge }) => {
  const api = express.Router();
  api.use(access.requireIp, access.requireOrigin);
  api.use((req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
  api.use(express.json({ limit: "200kb" }));

  api.get("/session", wrap(async (req, res) => {
    if (!getSession(req)) return res.json({ authenticated: false });
    const auth = await getAuth();
    res.json({ authenticated: true, totpEnabled: auth.totp.enabled });
  }));

  api.post("/login", wrap(async (req, res) => {
    const ip = req.ip;
    if (isLocked(ip)) {
      return res.status(429).json({ message: "失败次数过多，请 15 分钟后再试" });
    }
    const { password, code } = req.body ?? {};
    const auth = await getAuth();
    if (typeof password !== "string" || !(await verifyPassword(password, auth.passwordHash))) {
      recordFailure(ip);
      return res.status(401).json({ message: "密码错误" });
    }
    if (auth.totp.enabled) {
      if (!code) return res.json({ requireTotp: true });
      const counter = checkTotp(auth.totp.secret, code, auth.totp.lastCounter);
      if (counter === null) {
        recordFailure(ip);
        return res.status(401).json({ message: "验证码错误或已使用" });
      }
      auth.totp.lastCounter = counter;
      await saveAuth(auth);
    }
    clearFailures(ip);
    setSessionCookie(req, res, createSession());
    res.json({ ok: true });
  }));

  api.post("/logout", (req, res) => {
    const session = getSession(req);
    if (session) destroySession(session.token);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  api.get("/config", requireAdmin, (req, res) => {
    res.set("Cache-Control", "no-store").json(getConfig());
  });

  api.put("/config", requireAdmin, wrap(async (req, res) => {
    const next = sanitizeConfig(req.body);
    await saveConfig(next);
    res.json(next);
  }));

  api.post("/password", requireAdmin, wrap(async (req, res) => {
    const { current, next } = req.body ?? {};
    const auth = await getAuth();
    if (typeof current !== "string" || !(await verifyPassword(current, auth.passwordHash))) {
      return res.status(400).json({ message: "当前密码错误" });
    }
    if (typeof next !== "string" || next.length < MIN_PASSWORD || next.length > 128) {
      return res.status(400).json({ message: `新密码长度需为 ${MIN_PASSWORD}-128 位` });
    }
    auth.passwordHash = await hashPassword(next);
    await saveAuth(auth);
    destroyOtherSessions(req.session.token);
    res.json({ ok: true });
  }));

  api.post("/totp/setup", requireAdmin, wrap(async (req, res) => {
    const auth = await getAuth();
    if (auth.totp.enabled) return res.status(400).json({ message: "两步验证已开启" });
    const { secret, uri } = generateTotp(getConfig().site.name);
    req.session.pendingTotp = secret;
    res.json({ secret, uri, qrcode: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) });
  }));

  api.post("/totp/enable", requireAdmin, wrap(async (req, res) => {
    const secret = req.session.pendingTotp;
    if (!secret) return res.status(400).json({ message: "请先生成二维码" });
    const counter = checkTotp(secret, req.body?.code, null);
    if (counter === null) return res.status(400).json({ message: "验证码错误" });
    const auth = await getAuth();
    auth.totp = { enabled: true, secret, lastCounter: counter };
    await saveAuth(auth);
    delete req.session.pendingTotp;
    res.json({ ok: true });
  }));

  api.post("/totp/disable", requireAdmin, wrap(async (req, res) => {
    const { password, code } = req.body ?? {};
    const auth = await getAuth();
    if (!auth.totp.enabled) return res.status(400).json({ message: "两步验证未开启" });
    if (typeof password !== "string" || !(await verifyPassword(password, auth.passwordHash))) {
      return res.status(400).json({ message: "密码错误" });
    }
    if (checkTotp(auth.totp.secret, code, auth.totp.lastCounter) === null) {
      return res.status(400).json({ message: "验证码错误或已使用" });
    }
    auth.totp = { enabled: false, secret: null, lastCounter: null };
    await saveAuth(auth);
    res.json({ ok: true });
  }));

  api.get("/logins", requireAdmin, wrap(async (req, res) => res.json(await vault.list())));
  api.post("/logins", requireAdmin, wrap(async (req, res) => res.status(201).json(await vault.save(req.body))));
  api.put("/logins/:id", requireAdmin, wrap(async (req, res) => res.json(await vault.save(req.body, req.params.id))));
  api.delete("/logins/:id", requireAdmin, wrap(async (req, res) => { await vault.remove(req.params.id); res.json({ ok: true }); }));
  api.get("/launch/:id", requireAdmin, wrap(async (req, res) => {
    const metadata = (await vault.list()).find(entry => entry.id === req.params.id && entry.enabled);
    if (!metadata) return res.sendStatus(404);
    if (metadata.adapter && metadata.adapter !== "form") return bridge.issue(req, res, metadata.id, metadata.targetUrl, metadata.adapter, metadata.remote);
    const entry = await vault.launch(req.params.id);
    if (!entry) return res.sendStatus(404);
    sendLoginForm(res, entry);
  }));

  api.use((req, res) => res.status(404).json({ message: "接口不存在" }));

  // eslint-disable-next-line no-unused-vars
  api.use((error, req, res, next) => {
    if (error instanceof ConfigError) return res.status(400).json({ message: error.message });
    if (error.type === "entity.parse.failed") return res.status(400).json({ message: "请求格式错误" });
    if (error.type === "entity.too.large") return res.status(413).json({ message: "请求内容过大" });
    console.error("Home API error:", error.name);
    res.status(500).json({ message: "服务器错误" });
  });

  return api;
};
