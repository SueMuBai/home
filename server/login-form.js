import { randomBytes } from "node:crypto";

const escape = (text) => String(text).replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
export const sendLoginForm = (res, entry) => {
  const nonce = randomBytes(18).toString("base64"), origin = new URL(entry.loginUrl).origin;
  const inputs = Object.entries(entry.fields).map(([name, value]) => `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`).join("");
  res.set({
    "Cache-Control": "private, no-store, max-age=0", "Pragma": "no-cache",
    "Referrer-Policy": "strict-origin", "X-Frame-Options": "DENY", "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; form-action ${origin}; frame-src 'self' ${origin}; frame-ancestors 'none'; base-uri 'none'`,
  }).type("html").send(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>正在登录</title><p id="status">正在登录 ${escape(entry.name)}…</p><form id="login" method="post" action="${escape(entry.loginUrl)}" autocomplete="off">${inputs}</form><a id="destination" href="${escape(entry.targetUrl)}" rel="noreferrer">打开后台</a><script nonce="${nonce}">
const form=document.getElementById('login'),destination=document.getElementById('destination');
const frame=document.createElement('iframe');frame.name='login-frame';frame.hidden=true;form.target=frame.name;
let submitted=false;
const clear=()=>Element.prototype.replaceChildren.call(form);
frame.addEventListener('load',()=>{if(!submitted){submitted=true;HTMLFormElement.prototype.submit.call(form);}else{clear();location.replace(destination.href);}});
document.body.append(frame);
addEventListener('pagehide',clear);
setTimeout(()=>{clear();document.getElementById('status').textContent='请打开后台查看登录结果；如需验证码，请在目标页面完成。';},15000);
</script></html>`);
};
