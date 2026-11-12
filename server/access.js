import { isIP } from "node:net";

export const normalizeIp = (value = "") => {
  let ip = value.trim().toLowerCase();
  if (ip.startsWith("::ffff:") && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  if (!isIP(ip)) return "";
  return isIP(ip) === 6 ? new URL(`http://[${ip}]`).hostname.slice(1, -1) : ip;
};

export const createAccess = ({
  adminPath = process.env.HOME_ADMIN_PATH,
  allowedIps = (process.env.HOME_ALLOWED_IPS || "").split(","),
  trustedProxies = [],
  origin = process.env.HOME_PUBLIC_ORIGIN || "https://subaimu.com",
} = {}) => {
  if (!/^\/[a-zA-Z0-9_-]{24,80}$/.test(adminPath || "")) throw Error("A random HOME_ADMIN_PATH is required");
  const allowed = new Set(allowedIps.map(normalizeIp).filter(Boolean));
  if (!allowed.size) throw Error("HOME_ALLOWED_IPS is required");
  let proxies = new Set(trustedProxies.map(normalizeIp).filter(Boolean));
  const isAllowed = (req) => allowed.has(normalizeIp(req.ip));
  const requireIp = (req, res, next) => isAllowed(req) ? next() : res.status(404).send("Not found");
  const requireOrigin = (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("Origin") !== origin) return res.status(403).json({ message: "请求来源不符，请刷新页面重试" });
    if (req.get("Origin") && req.get("Origin") !== origin) return res.sendStatus(403);
    if (req.get("Sec-Fetch-Site") && !["same-origin", "none"].includes(req.get("Sec-Fetch-Site"))) return res.sendStatus(403);
    next();
  };
  return {
    adminPath, origin, isAllowed, requireIp, requireOrigin,
    trustProxy: (ip, hop) => hop === 0 && proxies.has(normalizeIp(ip)),
    setTrustedProxies: (ips) => { proxies = new Set(ips.map(normalizeIp).filter(Boolean)); },
  };
};
