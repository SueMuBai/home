import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { request } from "node:http";

const dir = await mkdtemp(path.join(tmpdir(), "home-access-"));
process.env.HOME_DATA_DIR = dir;
process.env.ADMIN_PASSWORD = "fixture-password-012345";
const { createVault } = await import("../server/vault.js");
const { createAccess, normalizeIp } = await import("../server/access.js");
const { createApp } = await import("../server/app.js");
const { initStore, getAuth, saveAuth, getConfig, saveConfig } = await import("../server/store.js");
const { generateTotp } = await import("../server/auth.js");
const { TOTP, Secret } = await import("otpauth");
await initStore();
after(() => rm(dir, { recursive: true, force: true }));
const key = randomBytes(32).toString("base64");
const input = (name = "SSTP") => ({ name, targetUrl: `https://test.example/${name}`, loginUrl: "https://test.example/login", username: "fixture", usernameField: "username", passwordField: "password", password: "secret-only-at-click<&\"", extraFields: { remember: "true" } });
const vaultAt = file => createVault({ file: path.join(dir, file), key });

test("IP normalization and proxy trust are exact and fail closed", () => {
  assert.equal(normalizeIp("::ffff:185.93.71.64"), "185.93.71.64");
  assert.equal(normalizeIp("bad"), "");
  assert.throws(() => createAccess());
  const access = createAccess({ adminPath: "/a".padEnd(33, "x"), allowedIps: ["185.93.71.64"], trustedProxies: ["172.18.0.2"] });
  assert.equal(access.trustProxy("172.18.0.2", 0), true);
  assert.equal(access.trustProxy("172.18.0.2", 1), false);
  assert.equal(access.trustProxy("172.18.0.3", 0), false);
  access.setTrustedProxies([]);
  assert.equal(access.trustProxy("172.18.0.2", 0), false);
});

test("encrypted disk persistence, metadata secrecy and edit preservation", async () => {
  const vault = vaultAt("vault.json"), entry = await vault.save(input());
  assert.equal(entry.hasPassword, true);
  assert.equal(JSON.stringify(entry).includes("secret-only"), false);
  const disk = await readFile(path.join(dir, "vault.json"), "utf8");
  assert.equal(disk.includes("secret-only"), false);
  assert.equal(disk.includes("remember"), false);
  assert.equal((await stat(path.join(dir, "vault.json"))).mode & 0o777, 0o600);
  await vault.save({ ...entry, name: "Renamed", password: "" }, entry.id);
  const restarted = vaultAt("vault.json");
  assert.equal((await restarted.launch(entry.id)).fields.password, input().password);
  assert.equal((await restarted.launch(entry.id)).fields.remember, "true");
  assert.equal((await restarted.list())[0].name, "Renamed");
  const links = await restarted.decorate([{ link: entry.targetUrl }], "/random/api");
  assert.equal(links[0].link, `/random/api/launch/${entry.id}`);
  await restarted.save({ ...entry, password: "", enabled: false }, entry.id);
  assert.equal(await restarted.launch(entry.id), null);
  await restarted.remove(entry.id);
  assert.equal(await restarted.launch(entry.id), null);
});

test("ciphertext modification and incorrect key reject decryption", async () => {
  const vault = vaultAt("tamper.json"), entry = await vault.save(input());
  const wrong = createVault({ file: path.join(dir, "tamper.json"), key: randomBytes(32).toString("base64") });
  await assert.rejects(() => wrong.launch(entry.id));
  const disk = JSON.parse(await readFile(path.join(dir, "tamper.json"), "utf8"));
  disk.entries[0].sealed.tag = randomBytes(16).toString("base64");
  await writeFile(path.join(dir, "tamper.json"), JSON.stringify(disk));
  await assert.rejects(() => vault.launch(entry.id));
});

test("concurrent mutations preserve all entries and survive failed operations", async () => {
  const vault = vaultAt("concurrent.json");
  const entries = await Promise.all(Array.from({ length: 20 }, (_, i) => vault.save(input(`service-${i}`))));
  assert.equal((await vault.list()).length, 20);
  await assert.rejects(() => vault.save(input("service-0")));
  await Promise.all(entries.map(entry => vault.save({ ...entry, name: `${entry.name}-edited`, password: "" }, entry.id)));
  assert.equal((await vault.list()).filter(x => x.name.endsWith("-edited")).length, 20);
  await Promise.all(entries.map(entry => vault.remove(entry.id)));
  assert.equal((await vault.list()).length, 0);
});

test("URL, field and secret validation", async () => {
  const vault = vaultAt("validation.json");
  for (const change of [{ targetUrl: "http://test.example/" }, { loginUrl: "https://other.example/login" }, { loginUrl: "https://user:pass@test.example/login" }, { passwordField: "__proto__" }, { usernameField: "password" }, { extraFields: { password: "override" } }, { extraFields: { any: 1 } }, { password: 123 }]) {
    await assert.rejects(() => vault.save({ ...input(), ...change }));
  }
  const entry = await vault.save(input());
  await assert.rejects(() => vault.save({ ...entry, loginUrl: "https://test.example/new", password: "" }, entry.id));
});

test("remote handoff configuration persists and changing it requires credential confirmation", async () => {
  const vault = vaultAt("remote-metadata.json");
  const sub = await vault.save({ ...input("sub2api"), adapter: "sub2api", usernameField: "email" });
  assert.equal(sub.remote, true);
  const grok = await vault.save({ ...input("grok2api"), adapter: "grok2api" });
  assert.equal(grok.remote, true);
  assert.equal((await vaultAt("remote-metadata.json").launch(grok.id)).fields.password, input().password);
  const cpa = await vault.save({ ...input("cpa"), adapter: "cpa" });
  assert.equal(cpa.remote, false);
  await assert.rejects(() => vault.save({ ...cpa, remote: true, password: "" }, cpa.id));
  const remote = await vault.save({ ...cpa, remote: true, password: input().password }, cpa.id);
  assert.equal(remote.remote, true);
  assert.equal((await vaultAt("remote-metadata.json").list()).find(e => e.id === cpa.id).remote, true);
  await assert.rejects(() => vault.save({ ...input("bad-remote"), adapter: "json", remote: true }));
  await assert.rejects(() => vault.save({ ...input("bad-value"), adapter: "cpa", remote: "yes" }));
});

test("management routes enforce IP, session, origin, obsolete paths and on-click secrets", async () => {
  const adminPath = "/fixture_random_entry_12345678901234", origin = "https://subaimu.com";
  const access = createAccess({ adminPath, allowedIps: ["185.93.71.64"], trustedProxies: ["127.0.0.1"], origin });
  const vault = vaultAt("api.json"), entry = await vault.save(input());
  const app = createApp({ access, vault });
  app.get(adminPath, (req, res) => res.send("private management"));
  app.get("*", (req, res) => res.send("public page"));
  const server = await new Promise(resolve => { const value = app.listen(0, "127.0.0.1", () => resolve(value)); });
  const call = (url, { method = "GET", body, headers = {}, ip = "185.93.71.64", cookie } = {}) => new Promise((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port: server.address().port, path: url, method, headers: { "X-Forwarded-For": ip, "X-Forwarded-Proto": "https", ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...headers } }, res => {
      let text = ""; res.setEncoding("utf8"); res.on("data", chunk => text += chunk); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text, json: () => JSON.parse(text) }));
    });
    req.on("error", reject); req.end(body ? JSON.stringify(body) : undefined);
  });
  try {
    const base = `${adminPath}/api`;
    assert.equal((await call(adminPath, { ip: "198.51.100.1" })).status, 404);
    assert.equal((await call(`${base}/logins`)).status, 401);
    assert.equal((await call(`${base}/launch/${entry.id}`)).status, 401);
    assert.equal((await call(`${base}/login`, { method: "POST", body: { password: process.env.ADMIN_PASSWORD } })).status, 403);
    const login = await call(`${base}/login`, { method: "POST", headers: { Origin: origin }, body: { password: process.env.ADMIN_PASSWORD } });
    assert.equal(login.status, 200);
    const cookie = login.headers["set-cookie"][0].split(";")[0];
    assert.match(login.headers["set-cookie"][0], /HttpOnly.*Secure.*SameSite=Strict/);
    const list = await call(`${base}/logins`, { cookie });
    assert.equal(list.status, 200); assert.equal(list.text.includes("secret-only"), false); assert.equal(list.text.includes("sealed"), false);
    const launch = await call(`${base}/launch/${entry.id}`, { cookie });
    assert.equal(launch.status, 200); assert.match(launch.headers["cache-control"], /no-store/);
    assert.match(launch.text, /secret-only-at-click&#60;&#38;&#34;/);
    assert.equal((await call(`${base}/launch/${entry.id}`, { cookie, headers: { "Sec-Fetch-Site": "cross-site" } })).status, 403);
    for (const endpoint of ["/session", "/logins", "/config", `/launch/${entry.id}`]) {
      assert.equal((await call(base + endpoint, { cookie, ip: "198.51.100.1" })).status, 404);
    }
    assert.equal((await call(`${base}/login`, { ip: "198.51.100.1", method: "POST", body: { password: process.env.ADMIN_PASSWORD }, headers: { Origin: origin } })).status, 404);
    const publicConfig = await call("/api/config", { cookie, ip: "198.51.100.1" });
    assert.equal(publicConfig.json().isAdmin, false); assert.equal(publicConfig.json().adminPath, undefined);
    assert.equal(publicConfig.text.includes("secret-only"), false);
    for (const url of ["/admin", "/admin.html", "/ADMIN.HTML", "/admin.html.gz", "/%61dmin.html", "/foo/../admin.html", "/api/admin/login", "/api/internal/sso/redeem"]) {
      assert.equal((await call(url, { cookie })).status, 404, url);
    }
    access.setTrustedProxies([]);
    assert.equal((await call(`${base}/session`, { cookie, headers: { "CF-Connecting-IP": "185.93.71.64" } })).status, 404);
    access.setTrustedProxies(["127.0.0.1"]);
    const auth = await getAuth(), { secret } = generateTotp("fixture");
    await saveAuth({ ...auth, totp: { enabled: true, secret, lastCounter: null } });
    const pending = await call(`${base}/login`, { method: "POST", headers: { Origin: origin }, body: { password: process.env.ADMIN_PASSWORD } });
    assert.equal(pending.json().requireTotp, true);
    const code = new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 }).generate();
    const authenticated = await call(`${base}/login`, { method: "POST", headers: { Origin: origin }, body: { password: process.env.ADMIN_PASSWORD, code } });
    assert.equal(authenticated.status, 200);
    assert.equal((await call(`${base}/login`, { method: "POST", headers: { Origin: origin }, body: { password: process.env.ADMIN_PASSWORD, code } })).status, 401);
    await saveAuth(auth);
    await call(`${base}/logout`, { cookie, method: "POST", headers: { Origin: origin } });
    assert.equal((await call(`${base}/launch/${entry.id}`, { cookie })).status, 401);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test("a public card stays a plain link for visitors and uses credentials only for authenticated allowed administrators", async () => {
  const adminPath = "/public_card_fixture_123456789012345", origin = "https://subaimu.com";
  const original = getConfig(), target = "https://public.example/", vault = vaultAt("public-card.json");
  const entry = await vault.save({ ...input("public"), adapter: "new-api", remote: true, targetUrl: target, loginUrl: target + "api/user/login" });
  await saveConfig({ ...original, siteLinks: [{ name: "public", icon: "Link", link: target, hidden: false }] });
  const app = createApp({ access: createAccess({ adminPath, origin, allowedIps: ["185.93.71.64"], trustedProxies: ["127.0.0.1"] }), vault });
  const server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const call = (url, { method = "GET", cookie, ip = "185.93.71.64", body } = {}) => new Promise((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port: server.address().port, path: url, method, headers: { "X-Forwarded-For": ip, "X-Forwarded-Proto": "https", ...(cookie ? { Cookie: cookie } : {}), ...(body ? { Origin: origin, "Content-Type": "application/json" } : {}) } }, res => {
      let text = ""; res.on("data", b => text += b); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text, json: () => JSON.parse(text) }));
    }); req.on("error", reject); req.end(body ? JSON.stringify(body) : undefined);
  });
  try {
    for (const ip of ["185.93.71.64", "198.51.100.1"]) {
      const visitor = (await call("/api/config", { ip })).json();
      assert.equal(visitor.siteLinks[0].link, target); assert.equal(visitor.siteLinks[0].launchUrl, undefined); assert.equal(visitor.isAdmin, false);
    }
    assert.equal((await call(`${adminPath}/api/launch/${entry.id}`)).status, 401);
    const login = await call(`${adminPath}/api/login`, { method: "POST", body: { password: process.env.ADMIN_PASSWORD } });
    assert.equal(login.status, 200);
    const cookie = login.headers["set-cookie"][0].split(";")[0];
    const authenticated = (await call("/api/config", { cookie })).json();
    assert.equal(authenticated.isAdmin, true);
    assert.equal(authenticated.siteLinks[0].link, `${adminPath}/api/launch/${entry.id}`);
    assert.equal(authenticated.siteLinks[0].hidden, false);
    assert.equal(JSON.stringify(authenticated).includes(input().password), false);
    const blocked = (await call("/api/config", { cookie, ip: "198.51.100.1" })).json();
    assert.equal(blocked.siteLinks[0].link, target); assert.equal(blocked.isAdmin, false);
    await call(`${adminPath}/api/logout`, { method: "POST", cookie, body: {} });
    const loggedOut = (await call("/api/config", { cookie })).json();
    assert.equal(loggedOut.siteLinks[0].link, target); assert.equal(loggedOut.isAdmin, false);
  } finally { await new Promise(resolve => server.close(resolve)); await saveConfig(original); }
});
