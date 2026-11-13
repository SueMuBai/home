import { test } from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import { createAccess } from "../server/access.js";
import { createSession, destroySession } from "../server/auth.js";
import { createLoginBridge } from "../server/login-bridge.js";

const home = "https://subaimu.com", target = "https://service.subaimu.com";
const access = createAccess({ adminPath: "/test_random_admin_1234567890", allowedIps: ["185.93.71.64"], trustedProxies: ["127.0.0.1"], origin: home });
const response = () => ({ headers: {}, code: 200, set(key, value) { if (typeof key === "object") Object.assign(this.headers, key); else this.headers[key] = value; return this; }, type() { return this; }, send(body) { this.body = body; return this; }, json(body) { this.body = body; return this; }, sendStatus(code) { this.code = code; return this; } });
const request = session => ({ ip: "185.93.71.64", socket: { remoteAddress: "127.0.0.1" }, headers: { cookie: `home_admin_session=${session}` }, get(name) { return ({ "User-Agent": "fixture-browser", "Origin": home, "Host": "service.subaimu.com", "X-Home-Login-Origin": target })[name]; } });
const script = html => html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1];
const setup = (adapter = "json", remote) => {
  const session = createSession(), req = request(session);
  let time = 0, decryptions = 0;
  const entry = { name: "fixture", adapter, remote, enabled: true, targetUrl: target + "/", loginUrl: target + "/login", passwordField: "password", fields: { password: '</script><script>throw Error("injected")</script>' } };
  const vault = { list: async () => [entry], launch: async () => { decryptions++; return entry; } };
  const bridge = createLoginBridge({ access, vault, now: () => time });
  const issued = response(); bridge.issue(req, issued, "entry", target + "/", adapter, remote);
  const ticket = (remote ?? ["metapi", "sub2api", "grok2api"].includes(adapter)) ? issued.body.match(/#([A-Za-z0-9_-]{43})/)[1] : issued.body.match(/name="ticket" value="([^"]+)"/)[1];
  const consume = async overrides => {
    const r = { ...request(session), body: { ticket }, ...overrides }, res = response();
    await bridge.consume(r, res, error => { throw error; }); return res;
  };
  const remoteRequest = overrides => ({ ...request(session), body: { ticket }, get(name) { return ({ "User-Agent": "fixture-browser", "Origin": target, "Host": "subaimu.com" })[name]; }, ...overrides });
  const remoteConsume = async overrides => {
    const res = response(); await bridge.remoteConsume(remoteRequest(overrides), res, error => { throw error; }); return res;
  };
  return { bridge, entry, issued, consume, remoteConsume, remoteRequest, session, decryptions: () => decryptions, setTime: value => { time = value; } };
};

test("handoff issues no credentials; origin, IP, peer, UA, host and session must match", async () => {
  const f = setup();
  assert.equal(f.decryptions(), 0);
  assert.equal(f.issued.body.includes("injected"), false);
  assert.match(f.issued.headers["Content-Security-Policy"], /form-action https:\/\/service.subaimu.com/);
  for (const override of [
    { ip: "198.51.100.1" }, { socket: { remoteAddress: "127.0.0.2" } },
    ...["Origin", "User-Agent", "Host", "X-Home-Login-Origin"].map(name => ({ get: key => key === name ? "wrong" : request(f.session).get(key) })),
  ]) assert.equal((await f.consume(override)).code, 404);
  assert.equal(f.decryptions(), 0);
  const accepted = await f.consume(); assert.equal(accepted.code, 200); assert.equal(f.decryptions(), 1);
  assert.equal((await f.consume()).code, 404);
  new Script(script(accepted.body));
  assert.equal((accepted.body.match(/<\/script>/g) || []).length, 1);
  const payload = new Script('(' + script(accepted.body).match(/let cfg=(.*);\nconst write=/)[1] + ')').runInNewContext();
  assert.equal(payload.fields.password, '</script><script>throw Error("injected")</script>');
  assert.match(accepted.headers["Cache-Control"], /no-store/);
  destroySession(f.session);
});

test("handoff expiry boundary, logout revocation and concurrent consumption", async () => {
  const expiry = setup(); expiry.setTime(60_000); assert.equal((await expiry.consume()).code, 404); assert.equal(expiry.decryptions(), 0); destroySession(expiry.session);
  const logout = setup(); destroySession(logout.session); assert.equal((await logout.consume()).code, 404);
  const concurrent = setup();
  const results = await Promise.all(Array.from({ length: 20 }, () => concurrent.consume()));
  assert.equal(results.filter(x => x.code === 200).length, 1); assert.equal(concurrent.decryptions(), 1); destroySession(concurrent.session);
});

test("all native adapter pages compile; CPA password stays out of browser persistent storage", async () => {
  for (const adapter of ["basic", "3x-ui", "komari", "astrbot", "napcat", "new-api", "miaomiaowu", "vm2api", "memoirs", "cpa"]) {
    const f = setup(adapter), res = await f.consume(); new Script(script(res.body)); destroySession(f.session);
    if (adapter === "cpa") { assert.match(res.body, /values=new Map/); assert.match(res.body, /this===localStorage&&keys.has/); }
  }
});

test("remote MetAPI tickets bind origin, IP, UA, proxy, host and active Home session", async () => {
  const f = setup("metapi");
  assert.equal(f.decryptions(), 0);
  assert.equal(f.issued.body.includes("injected"), false);
  assert.equal((await f.consume()).code, 404);
  const preflight = response();
  await f.bridge.remoteOptions(f.remoteRequest(), preflight, error => { throw error; });
  assert.equal(preflight.code, 204);
  assert.equal(preflight.headers["Access-Control-Allow-Origin"], target);
  assert.equal(preflight.headers["Access-Control-Allow-Credentials"], undefined);
  for (const override of [
    { ip: "198.51.100.1" }, { socket: { remoteAddress: "127.0.0.2" } },
    ...["Origin", "Host", "User-Agent"].map(name => ({ get: key => key === name ? "wrong" : f.remoteRequest().get(key) })),
    { body: { ticket: "unknown" } },
  ]) assert.equal((await f.remoteConsume(override)).code, 404);
  assert.equal(f.decryptions(), 0);
  const accepted = await f.remoteConsume();
  assert.equal(accepted.code, 200);
  assert.equal(accepted.body.adapter, "metapi");
  assert.equal(accepted.body.fields.password, f.entry.fields.password);
  assert.match(accepted.headers["Cache-Control"], /no-store/);
  assert.equal((await f.remoteConsume()).code, 404);
  assert.equal(f.decryptions(), 1);
  destroySession(f.session);
});

test("remote MetAPI rejects expiry, logout, disabled or changed entries, and concurrent replays", async () => {
  const expiry = setup("metapi"); expiry.setTime(60_000); assert.equal((await expiry.remoteConsume()).code, 404); assert.equal(expiry.decryptions(), 0); destroySession(expiry.session);
  const logout = setup("metapi"); destroySession(logout.session); assert.equal((await logout.remoteConsume()).code, 404);
  const disabled = setup("metapi"); disabled.entry.enabled = false; assert.equal((await disabled.remoteConsume()).code, 404); assert.equal(disabled.decryptions(), 0); destroySession(disabled.session);
  const changed = setup("metapi"); changed.entry.adapter = "json"; assert.equal((await changed.remoteConsume()).code, 404); assert.equal(changed.decryptions(), 0); destroySession(changed.session);
  const local = setup(); assert.equal((await local.remoteConsume()).code, 404); assert.equal(local.decryptions(), 0); destroySession(local.session);
  const concurrent = setup("metapi");
  const results = await Promise.all(Array.from({ length: 20 }, () => concurrent.remoteConsume()));
  assert.equal(results.filter(x => x.code === 200).length, 1); assert.equal(concurrent.decryptions(), 1); destroySession(concurrent.session);
});

test("remote client has no credentials and compiles with exact CORS origin and memory-only token storage", () => {
  const f = setup("metapi"), res = response(); f.bridge.client({}, res);
  assert.equal(res.body.includes("injected"), false);
  assert.equal(res.body.includes(f.session), false);
  assert.match(res.headers["Content-Security-Policy"], /connect-src 'self' https:\/\/subaimu.com https:\/\/api.github.com /);
  assert.match(res.body, /credentials:'omit'/);
  assert.match(res.body, /auth_token_expires_at/);
  assert.match(res.body, /values=new Map/);
  assert.match(res.body, /history.replaceState\(null,'',location.pathname\)/);
  new Script(script(res.body));
  destroySession(f.session);
});

test("remote password and token adapters use fragment handoff; local CPA keeps native POST", async () => {
  for (const [adapter, remote] of [["sub2api", undefined], ["cpa", true], ["new-api", true], ["grok2api", undefined]]) {
    const f = setup(adapter, remote);
    assert.match(f.issued.body, /location.replace/);
    assert.equal((await f.consume()).code, 404);
    const accepted = await f.remoteConsume();
    assert.equal(accepted.code, 200);
    assert.equal(accepted.body.adapter, adapter);
    assert.equal((await f.remoteConsume()).code, 404);
    destroySession(f.session);
  }
  const local = setup("cpa");
  assert.equal((await local.remoteConsume()).code, 404);
  const accepted = await local.consume();
  assert.equal(accepted.code, 200);
  new Script(script(accepted.body));
  destroySession(local.session);
  const changed = setup("cpa", true);
  changed.entry.remote = false;
  assert.equal((await changed.remoteConsume()).code, 404);
  assert.equal(changed.decryptions(), 0);
  destroySession(changed.session);
});

test("Grok2API requires a complete login result and relies on native cookies without persisting credentials", async () => {
  for (const result of [
    { data: { admin: { id: "fixture-admin" }, tokens: { accessToken: "fixture-token" } } },
    { data: { admin: { id: "fixture-admin" }, tokens: {} } },
    { data: { tokens: { accessToken: "fixture-token" } } },
    {},
  ]) {
    const f = setup("grok2api", false), res = await f.consume();
    const redirects = [], calls = [], status = { textContent: "" };
    new Script(script(res.body)).runInNewContext({
      URL, URLSearchParams,
      location: { origin: target, replace: url => redirects.push(url) },
      fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => result }; },
      localStorage: { setItem() { assert.fail("Grok2API credentials must not be written to persistent storage"); } },
      document: { getElementById: () => status },
      addEventListener() {},
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, f.entry.loginUrl);
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.credentials, "same-origin");
    assert.deepEqual(JSON.parse(calls[0].options.body), f.entry.fields);
    const complete = Boolean(result.data?.admin?.id && result.data?.tokens?.accessToken);
    assert.deepEqual(redirects, complete ? [f.entry.targetUrl] : []);
    assert.equal(Boolean(status.textContent), !complete);
    destroySession(f.session);
  }
});
