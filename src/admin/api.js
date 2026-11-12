const request = async (method, url, body) => {
  const base = document.querySelector('meta[name="home-admin-api"]')?.content;
  if (!base) throw new Error("管理入口已变更，请使用新的入口打开");
  const res = await fetch(`${base}${url}`, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || `请求失败 (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
};

export const adminApi = {
  session: () => request("GET", "/session"),
  login: (password, code) => request("POST", "/login", { password, code }),
  logout: () => request("POST", "/logout"),
  getConfig: () => request("GET", "/config"),
  saveConfig: (config) => request("PUT", "/config", config),
  changePassword: (current, next) => request("POST", "/password", { current, next }),
  setupTotp: () => request("POST", "/totp/setup"),
  enableTotp: (code) => request("POST", "/totp/enable", { code }),
  disableTotp: (password, code) => request("POST", "/totp/disable", { password, code }),
  listLogins: () => request("GET", "/logins"),
  saveLogin: (entry) => entry.id ? request("PUT", `/logins/${entry.id}`, entry) : request("POST", "/logins", entry),
  deleteLogin: (id) => request("DELETE", `/logins/${id}`),
};
