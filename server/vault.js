import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./store.js";
import { ConfigError } from "./validate.js";

const invalid = (message) => { throw new ConfigError(message); };
const text = (value, label, max = 200) => {
  if (typeof value !== "string" || value.length > max) invalid(`${label}格式不正确`);
  return value.trim();
};
const httpsUrl = (value) => {
  let url;
  try { url = new URL(text(value, "网址", 2000)); } catch { invalid("请填写完整 HTTPS 网址"); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) invalid("仅支持无内嵌凭据的 HTTPS 网址");
  return url.href;
};
const canonical = (value) => new URL(value).href.replace(/\/$/, "");
const field = (value, label, optional = false) => {
  const result = text(value ?? "", label, 80);
  if (optional && !result) return "";
  if (!/^[a-zA-Z_][a-zA-Z0-9_.\[\]-]{0,79}$/.test(result) || ["__proto__", "constructor", "prototype"].includes(result)) invalid(`${label}无效`);
  return result;
};
const metadata = ({ sealed, ...entry }) => ({ ...entry, hasPassword: Boolean(sealed) });

export const createVault = ({ file = path.join(dataDir, "login-vault.json"), key = process.env.HOME_VAULT_KEY } = {}) => {
  const rawKey = Buffer.from(key || "", "base64");
  if (rawKey.length !== 32 || rawKey.toString("base64") !== key) throw Error("A persistent 32-byte HOME_VAULT_KEY is required");
  let pending = Promise.resolve();
  const read = async () => {
    try {
      const data = JSON.parse(await readFile(file, "utf8"));
      if (data.version !== 1 || !Array.isArray(data.entries)) throw Error("Invalid login vault");
      return data;
    } catch (error) {
      if (error.code === "ENOENT") return { version: 1, entries: [] };
      throw error;
    }
  };
  const write = async (data) => {
    await mkdir(path.dirname(file), { recursive: true });
    const temp = `${file}.${randomBytes(8).toString("hex")}.tmp`;
    try {
      const handle = await open(temp, "wx", 0o600);
      try { await handle.writeFile(JSON.stringify(data, null, 2)); await handle.sync(); } finally { await handle.close(); }
      await rename(temp, file);
      const directory = await open(path.dirname(file), "r");
      try { await directory.sync(); } finally { await directory.close(); }
    } finally { await unlink(temp).catch(() => {}); }
  };
  const seal = (entry, secrets) => {
    const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", rawKey, iv);
    cipher.setAAD(Buffer.from(`${entry.id}:${entry.loginUrl}`));
    const data = Buffer.concat([cipher.update(JSON.stringify(secrets), "utf8"), cipher.final()]);
    return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
  };
  const unseal = (entry) => {
    const decipher = createDecipheriv("aes-256-gcm", rawKey, Buffer.from(entry.sealed.iv, "base64"));
    decipher.setAAD(Buffer.from(`${entry.id}:${entry.loginUrl}`));
    decipher.setAuthTag(Buffer.from(entry.sealed.tag, "base64"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(entry.sealed.data, "base64")), decipher.final()]).toString("utf8"));
  };
  const mutate = (fn) => {
    const operation = pending.then(async () => { const data = await read(); const result = fn(data); await write(data); return result; });
    pending = operation.catch(() => {});
    return operation;
  };
  const list = async () => { await pending; return (await read()).entries.map(metadata); };
  return {
    list,
    save: (input, id = null) => mutate((data) => {
      if (!input || typeof input !== "object") invalid("配置无效");
      const index = id ? data.entries.findIndex(x => x.id === id) : -1;
      if (id && index < 0) invalid("配置不存在");
      if (!id && data.entries.length >= 60) invalid("最多配置 60 个服务");
      const old = index < 0 ? null : data.entries[index];
      const entry = {
        id: old?.id || randomUUID(), name: text(input.name, "名称", 30),
        targetUrl: httpsUrl(input.targetUrl), loginUrl: httpsUrl(input.loginUrl),
        username: text(input.username ?? "", "用户名", 200),
        usernameField: field(input.usernameField, "用户名字段", true),
        passwordField: field(input.passwordField || "password", "密码字段"),
        adapter: input.adapter || old?.adapter || "form",
        enabled: input.enabled !== false,
      };
      if (!["form", "basic", "json", "3x-ui", "komari", "astrbot", "napcat", "new-api", "miaomiaowu", "vm2api", "memoirs", "cpa", "metapi", "sub2api"].includes(entry.adapter)) invalid("登录方式无效");
      if (input.remote !== undefined && typeof input.remote !== "boolean") invalid("远端中转开关无效");
      entry.remote = input.remote ?? old?.remote ?? ["metapi", "sub2api"].includes(entry.adapter);
      if (entry.remote && !["metapi", "sub2api", "cpa"].includes(entry.adapter)) invalid("当前登录方式不支持远端中转");
      if (!entry.name) invalid("名称不能为空");
      if (new URL(entry.targetUrl).origin !== new URL(entry.loginUrl).origin) invalid("登录接口和目标后台必须属于同一站点");
      if (data.entries.some(x => x.id !== entry.id && canonical(x.targetUrl) === canonical(entry.targetUrl))) invalid("目标后台已有自动登录配置");
      const password = input.password;
      if (entry.usernameField === entry.passwordField) invalid("账号和密码字段不能相同");
      if (password != null && typeof password !== "string") invalid("密码必须是文本");
      if (typeof password === "string" && password.length > 0) {
        if (password.length > 4096) invalid("密码过长");
        const extra = input.extraFields ?? {};
        if (!extra || typeof extra !== "object" || Array.isArray(extra) || Object.keys(extra).length > 20) invalid("附加参数需为最多 20 项的 JSON 对象");
        for (const [key, value] of Object.entries(extra)) { field(key, "附加字段"); if (typeof value !== "string" || value.length > 4096) invalid("附加字段值必须是文本"); }
        if (Object.hasOwn(extra, entry.passwordField) || (entry.usernameField && Object.hasOwn(extra, entry.usernameField))) invalid("附加字段不能覆盖账号或密码字段");
        entry.sealed = seal(entry, { password, extraFields: extra });
      } else {
        if (!old) invalid("首次配置需要填写密码");
        if (entry.loginUrl !== old.loginUrl || entry.targetUrl !== old.targetUrl || entry.passwordField !== old.passwordField || entry.usernameField !== old.usernameField || entry.adapter !== (old.adapter || "form") || entry.remote !== (old.remote ?? ["metapi", "sub2api"].includes(old.adapter))) invalid("修改登录地址或字段时需要重新填写密码和附加参数");
        entry.sealed = old.sealed;
      }
      if (index < 0) data.entries.push(entry); else data.entries[index] = entry;
      return metadata(entry);
    }),
    remove: (id) => mutate((data) => { data.entries = data.entries.filter(x => x.id !== id); }),
    decorate: async (links, base) => {
      const entries = (await list()).filter(x => x.enabled);
      return links.map(item => {
        const entry = entries.find(x => canonical(x.targetUrl) === canonical(item.link));
        // Rewrite the runtime link as well, so previously cached frontend JS works.
        return entry ? { ...item, link: `${base}/launch/${entry.id}`, launchUrl: `${base}/launch/${entry.id}` } : item;
      });
    },
    launch: async (id) => {
      await pending;
      const entry = (await read()).entries.find(x => x.id === id && x.enabled);
      if (!entry) return null;
      const secrets = unseal(entry);
      const fields = { ...secrets.extraFields, [entry.passwordField]: secrets.password };
      if (entry.usernameField) fields[entry.usernameField] = entry.username;
      return { ...metadata(entry), fields };
    },
  };
};
