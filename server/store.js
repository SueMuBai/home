import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { hashPassword } from "./auth.js";
import { defaultConfig } from "./defaults.js";
import { sanitizeConfig } from "./validate.js";

export const dataDir = path.resolve(process.env.HOME_DATA_DIR || "data");
const configFile = path.join(dataDir, "config.json");
const authFile = path.join(dataDir, "auth.json");

let config = null;

const readJson = async (file) => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

const writeJson = async (file, data) => {
  await mkdir(dataDir, { recursive: true });
  const temp = `${file}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(temp, file);
};

export const initStore = async () => {
  const stored = await readJson(configFile);
  config = sanitizeConfig(stored ?? defaultConfig);
  if (!stored) await writeJson(configFile, config);
  if (!(await readJson(authFile))) await resetAuth(process.env.ADMIN_PASSWORD);
};

export const getConfig = () => config;

export const saveConfig = async (next) => {
  await writeJson(configFile, next);
  config = next;
};

// 每次从磁盘读取，命令行重置密码后无需重启即可生效
export const getAuth = () => readJson(authFile);

export const saveAuth = (auth) => writeJson(authFile, auth);

export const resetAuth = async (password) => {
  const value = password || randomBytes(12).toString("base64url");
  await saveAuth({
    passwordHash: await hashPassword(value),
    totp: { enabled: false, secret: null, lastCounter: null },
  });
  console.log(
    password
      ? "[home] 已使用 ADMIN_PASSWORD 设置管理员密码"
      : `[home] 管理员初始密码：${value}（请登录 /admin 后立即修改）`,
  );
};
