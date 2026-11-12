import express from "express";
import path from "node:path";
import { createApi } from "./api.js";
import { getSession } from "./auth.js";
import { getConfig } from "./store.js";

export const createApp = ({ access, vault }) => {
  const app = express();
  app.disable("x-powered-by");
  app.set("case sensitive routing", true);
  app.set("trust proxy", access.trustProxy);
  app.use((req, res, next) => {
    let normalized;
    try { normalized = path.posix.normalize(decodeURIComponent(req.path).replace(/\\/g, "/")); } catch { return res.sendStatus(400); }
    if (/^\/admin(?:[/.]|$)/i.test(normalized) || /^\/api\/admin(?:\/|$)/i.test(normalized)
        || /^\/api\/internal(?:\/|$)/i.test(normalized) || req.path === "/api/config/") return res.sendStatus(404);
    next();
  });
  app.get("/api/config", async (req, res, next) => {
    try {
      const config = getConfig(), allowed = access.isAllowed(req), isAdmin = allowed && Boolean(getSession(req));
      const siteLinks = isAdmin ? await vault.decorate(config.siteLinks, `${access.adminPath}/api`) : config.siteLinks.filter(x => !x.hidden);
      res.set("Cache-Control", "private, no-store").json({ ...config, siteLinks, isAdmin, ...(allowed ? { adminPath: access.adminPath } : {}) });
    } catch (error) { next(error); }
  });
  app.use(`${access.adminPath}/api`, createApi({ access, vault }));
  app.use(access.adminPath, access.requireIp);
  // Unknown API paths must never fall through to the public SPA document.
  app.use("/api", (req, res) => res.sendStatus(404));
  return app;
};
