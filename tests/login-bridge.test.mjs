import { test } from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import { createAccess } from "../server/access.js";
import { createSession, destroySession } from "../server/auth.js";
import { createLoginBridge } from "../server/login-bridge.js";

const home = "https://subaimu.com", target = "https://service.subaimu.com";
const access = createAccess({ adminPath: "/test_random_admin_1234567890", allowedIps: ["185.93.71.64"], trustedProxies: ["127.0.0.1"], origin: home });
const response = () => ({ headers: {}, code: 200, set(key, value) { if (typeof key === "object") Object.assign(this.headers, key); else this.headers[key] = value; return this; }, type() { return this; }, send(body) { this.body = body; return this; }, sendStatus(code) { this.code = code; return this; } });
const request = session => ({ ip: "185.93.71.64", socket: { remoteAddress: "127.0.0.1" }, headers: { cookie: `home_admin_session=${session}` }, get(name) { return ({ "User-Agent": "fixture-browser", "Origin": home, "Host": "service.subaimu.com", "X-Home-Login-Origin": target })[name]; } });
const script = html => html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1];
const setup = (adapter = "json") => {
  const session = createSession(), req = request(session);
  let time = 0, decryptions = 0;
  const vault = { launch: async () => { decryptions++; return { name: "fixture", adapter, targetUrl: target + "/", loginUrl: target + "/login", passwordField: "password", fields: { password: '</script><script>throw Error("injected")</script>' } }; } };
  const bridge = createLoginBridge({ access, vault, now: () => time });
  const issued = response(); bridge.issue(req, issued, "entry", target + "/");
  const ticket = issued.body.match(/name="ticket" value="([^"]+)"/)[1];
  const consume = async overrides => {
    const r = { ...request(session), body: { ticket }, ...overrides }, res = response();
    await bridge.consume(r, res, error => { throw error; }); return res;
  };
  return { bridge, issued, consume, session, decryptions: () => decryptions, setTime: value => { time = value; } };
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
  for (const adapter of ["3x-ui", "komari", "astrbot", "napcat", "new-api", "miaomiaowu", "vm2api", "memoirs", "cpa"]) {
    const f = setup(adapter), res = await f.consume(); new Script(script(res.body)); destroySession(f.session);
    if (adapter === "cpa") { assert.match(res.body, /values=new Map/); assert.match(res.body, /this===localStorage&&keys.has/); }
  }
});
