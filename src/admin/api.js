const request = async (method, url, body) => {
  const res = await fetch(`/api${url}`, {
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
  session: () => request("GET", "/admin/session"),
  login: (password, code) => request("POST", "/admin/login", { password, code }),
  logout: () => request("POST", "/admin/logout"),
  getConfig: () => request("GET", "/admin/config"),
  saveConfig: (config) => request("PUT", "/admin/config", config),
  changePassword: (current, next) => request("POST", "/admin/password", { current, next }),
  setupTotp: () => request("POST", "/admin/totp/setup"),
  enableTotp: (code) => request("POST", "/admin/totp/enable", { code }),
  disableTotp: (password, code) => request("POST", "/admin/totp/disable", { password, code }),
};
