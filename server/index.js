import express from "express";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApi } from "./api.js";
import { getConfig, initStore, resetAuth } from "./store.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isDev = process.argv.includes("--dev");
const port = Number(process.env.PORT) || (isDev ? 3000 : 12445);

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const injectMeta = (html) => {
  const { site } = getConfig();
  const tags = [
    `<title>${escapeHtml(site.name)}</title>`,
    `<meta name="description" content="${escapeHtml(site.description)}" />`,
    `<meta name="keywords" content="${escapeHtml(site.keywords)}" />`,
    `<meta name="author" content="${escapeHtml(site.author)}" />`,
    `<link rel="icon" href="${escapeHtml(site.logo)}" />`,
    `<link rel="apple-touch-icon" href="${escapeHtml(site.appleLogo)}" />`,
    `<link rel="bookmark" href="${escapeHtml(site.appleLogo)}" />`,
  ];
  return html.replace("<!--site-meta-->", tags.join("\n    "));
};

const parseTrustProxy = (value) => {
  if (!value) return false;
  if (value === "true") return true;
  return /^\d+$/.test(value) ? Number(value) : value;
};

if (process.argv.includes("--reset-password")) {
  await resetAuth(process.env.ADMIN_PASSWORD);
  console.log("[home] 两步验证已同时关闭");
  process.exit(0);
}

await initStore();

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", parseTrustProxy(process.env.TRUST_PROXY));
app.use("/api", createApi());

const httpServer = createServer(app);
const pages = { index: "index.html", admin: "admin.html" };
const pageFor = (url) => (/^\/admin(\/|$)/.test(url) ? pages.admin : pages.index);

if (isDev) {
  const { createServer: createVite } = await import("vite");
  const vite = await createVite({
    root,
    appType: "custom",
    server: { middlewareMode: true, hmr: { server: httpServer } },
  });
  app.use(vite.middlewares);
  app.get("*", async (req, res, next) => {
    try {
      const file = pageFor(req.path);
      const html = await readFile(path.join(root, file), "utf8");
      res.type("html").send(injectMeta(await vite.transformIndexHtml(req.originalUrl, html)));
    } catch (error) {
      vite.ssrFixStacktrace(error);
      next(error);
    }
  });
} else {
  const dist = path.join(root, "dist");
  const templates = {
    [pages.index]: await readFile(path.join(dist, pages.index), "utf8"),
    [pages.admin]: await readFile(path.join(dist, pages.admin), "utf8"),
  };
  const manifest = JSON.parse(await readFile(path.join(dist, "manifest.webmanifest"), "utf8"));

  app.get("/manifest.webmanifest", (req, res) => {
    const { site } = getConfig();
    res.type("application/manifest+json").json({
      ...manifest,
      name: site.name,
      short_name: site.name,
      description: site.description,
    });
  });
  app.use(express.static(dist, { index: false }));
  app.get("*", (req, res) => {
    res.set("Cache-Control", "no-cache").type("html").send(injectMeta(templates[pageFor(req.path)]));
  });
}

httpServer.listen(port, () => {
  console.log(`[home] http://localhost:${port}  后台：http://localhost:${port}/admin`);
});
