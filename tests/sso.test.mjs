import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import test from "node:test";
import express from "express";

const dir = await mkdtemp(path.join(tmpdir(), "home-sso-test-"));
process.env.HOME_DATA_DIR = dir;
process.env.ADMIN_PASSWORD = "isolated-test-password";
process.env.HOME_SSO_SECRET = "test-only-shared-secret-".repeat(3);
const { initStore, getConfig, saveConfig } = await import("../server/store.js");
const { createApi } = await import("../server/api.js");
const { createSso } = await import("../server/sso.js");
await initStore();
await saveConfig({ ...getConfig(), siteLinks: [
  { icon: "Globe", name: "SSTP", link: "https://sstp.subaimu.com/admin", hidden: true },
  { icon: "Link", name: "Public", link: "https://example.com/", hidden: false },
] });

test("SSTP handoff requires a current administrator and a single-use server exchange", async (t) => {
  const app = express();
  app.use("/api", createApi());
  let clock = Date.now();
  app.use("/clock", express.json(), createSso({ now: () => clock }).router);
  app.use("/disabled", express.json(), createSso({ secret: "" }).router);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (url, opts = {}) => fetch(base + url, { redirect: "manual", ...opts });
  const json = (body, headers = {}) => ({ method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  let cookie;
  const launch = async (prefix = "/api") => {
    const r = await request(prefix + "/admin/launch/sstp", { headers: { Cookie: cookie, "User-Agent": "SSO fixture" } });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("cache-control"), /no-store/);
    assert.match(r.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.equal(r.headers.get("referrer-policy"), "strict-origin");
    const body = await r.text();
    assert.doesNotMatch(body, /isolated-test-password/);
    return body.match(/name="code" value="([\w-]{43})"/)[1];
  };
  const redeem = (code, { prefix = "/api", secret = process.env.HOME_SSO_SECRET, service = "sstp", userAgent = "SSO fixture" } = {}) => request(prefix + "/internal/sso/redeem", json({ code, service, userAgent }, { Authorization: "Bearer " + secret }));
  try {
    await t.test("anonymous visitors cannot see or launch the hidden service", async () => {
      const c = await (await request("/api/config")).json();
      assert.deepEqual(c.siteLinks.map(x => x.name), ["Public"]);
      const r = await request("/api/admin/launch/sstp");
      assert.equal(r.status, 303); assert.equal(r.headers.get("location"), "/admin");
      assert.equal((await redeem("a".repeat(43))).status, 401);
    });
    await t.test("existing password login still works", async () => {
      const r = await request("/api/admin/login", json({ password: process.env.ADMIN_PASSWORD }));
      assert.equal(r.status, 200);
      cookie = r.headers.get("set-cookie").split(";")[0];
      const c = await (await request("/api/config", { headers: { Cookie: cookie } })).json();
      assert.equal(c.siteLinks[0].launchUrl, "/api/admin/launch/sstp");
      assert.equal(c.siteLinks[1].launchUrl, undefined);
    });
    await t.test("cross-origin launches are rejected even with a session", async () => {
      const r = await request("/api/admin/launch/sstp", { headers: { Cookie: cookie, Origin: "https://other.example" } });
      assert.equal(r.status, 403);
    });
    await t.test("a short-lived code is not sufficient without the server secret", async () => {
      const code = await launch();
      assert.equal((await redeem(code, { secret: "wrong" })).status, 401);
      const r = await redeem(code); assert.equal(r.status, 200);
      assert.deepEqual(await r.json(), { ok: true, service: "sstp", path: "/admin" });
      assert.equal((await redeem(code)).status, 401);
    });
    await t.test("concurrent redemption succeeds exactly once", async () => {
      const code = await launch();
      const responses = await Promise.all(Array.from({ length: 8 }, () => redeem(code)));
      assert.equal(responses.filter(r => r.status === 200).length, 1);
      assert.equal(responses.filter(r => r.status === 401).length, 7);
    });
    await t.test("a different browser UA cannot consume a valid login", async () => {
      const code = await launch();
      assert.equal((await redeem(code, { userAgent: "different" })).status, 401);
      assert.equal((await redeem(code)).status, 401);
    });
    await t.test("audience and code formats are checked", async () => {
      assert.equal((await redeem("invalid")).status, 400);
      const code = await launch();
      assert.equal((await redeem(code, { service: "other" })).status, 400);
      assert.equal((await redeem(code)).status, 200);
    });
    await t.test("the exact expiry boundary is rejected", async () => {
      const code = await launch("/clock");
      clock += 60_000;
      assert.equal((await redeem(code, { prefix: "/clock" })).status, 401);
    });
    await t.test("SSO remains closed when no shared secret is configured", async () => {
      assert.equal((await request("/disabled/admin/launch/sstp", { headers: { Cookie: cookie } })).status, 503);
      assert.equal((await redeem("a".repeat(43), { prefix: "/disabled" })).status, 401);
    });
    await t.test("logging out revokes an outstanding handoff", async () => {
      const code = await launch();
      await request("/api/admin/logout", json({}, { Cookie: cookie }));
      assert.equal((await redeem(code)).status, 401);
      const c = await (await request("/api/config", { headers: { Cookie: cookie } })).json();
      assert.equal(c.isAdmin, false);
    });
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
