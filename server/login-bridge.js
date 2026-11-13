import { randomBytes, createHash } from "node:crypto";
import { normalizeIp } from "./access.js";
import { getSession } from "./auth.js";

const escape = text => String(text).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const json = data => JSON.stringify(data).replace(/</g, "\\u003c");
// Sub2API preloads these payment SDKs even on its administrator dashboard.
const paymentSources = "https://static.airwallex.com https://checkout.airwallex.com";
const headers = (res, nonce, remoteHome = "") => res.set({
  "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache",
  "Referrer-Policy": "strict-origin", "X-Frame-Options": "DENY", "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": `default-src 'self'; script-src 'self' 'nonce-${nonce}'${remoteHome ? " " + paymentSources : ""}; connect-src 'self' ${remoteHome}${remoteHome ? " https://api.github.com https://*.airwallex.com" : ""}; style-src 'self' 'unsafe-inline'${remoteHome ? " https://fonts.googleapis.com " + paymentSources : ""}; img-src 'self' data: blob:${remoteHome ? " https://api.dicebear.com" : ""}; font-src 'self' data:${remoteHome ? " https://fonts.gstatic.com" : ""}; frame-src 'self'${remoteHome ? " https://checkout.airwallex.com" : ""}; frame-ancestors 'none'; base-uri 'self'; form-action https:`,
});

const payloadFor = entry => ({ adapter: entry.adapter, target: entry.targetUrl, login: entry.loginUrl, fields: entry.fields, passwordField: entry.passwordField, usernameField: entry.usernameField });
const remoteAdapters = new Set(["metapi", "sub2api", "cpa", "new-api"]);
const usesRemoteHandoff = entry => remoteAdapters.has(entry.adapter) && (entry.remote ?? ["metapi", "sub2api"].includes(entry.adapter));

export const createLoginBridge = ({ access, vault, now = Date.now, ttl = 60_000 }) => {
  const tickets = new Map();
  const prune = () => { for (const [key, item] of tickets) if (item.expires <= now()) tickets.delete(key); };
  const issue = (req, res, id, targetUrl, adapter = "json", remoteFlag) => {
    prune();
    if (tickets.size >= 1000) return res.sendStatus(429);
    const ticket = randomBytes(32).toString("base64url"), nonce = randomBytes(18).toString("base64");
    const remote = usesRemoteHandoff({ adapter, remote: remoteFlag });
    tickets.set(ticket, { id, adapter, session: getSession(req).token, ip: normalizeIp(req.ip), ua: req.get("User-Agent") || "", target: new URL(targetUrl).origin, remote, expires: now() + ttl });
    headers(res, nonce);
    res.set("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; form-action ${new URL(targetUrl).origin}; frame-ancestors 'none'; base-uri 'none'`);
    if (remote) {
      // The fragment never enters nginx access logs or a Referer header.
      const destination = new URL("/.home-login", targetUrl); destination.hash = ticket;
      return res.type("html").send(`<!doctype html><meta charset="utf-8"><title>正在登录</title><p>正在打开登录服务…</p><script nonce="${nonce}">location.replace(${json(destination.href)});</script>`);
    }
    res.type("html").send(`<!doctype html><meta charset="utf-8"><title>正在登录</title><p>正在打开登录服务…</p><form id="handoff" method="post" action="${escape(new URL("/.home-login", targetUrl).href)}"><input type="hidden" name="ticket" value="${escape(ticket)}"></form><script nonce="${nonce}">document.getElementById('handoff').submit();</script>`);
  };
  const consume = async (req, res, next) => {
    try {
      prune();
      const ticket = req.body?.ticket, item = tickets.get(ticket);
      if (!item || item.remote) return res.sendStatus(404);
      const session = getSession({ headers: { cookie: `home_admin_session=${item.session}` } });
      if (!access.trustProxy(req.socket.remoteAddress, 0) || !access.isAllowed(req) || req.get("Origin") !== access.origin
          || req.get("X-Home-Login-Origin") !== item.target || `https://${req.get("Host")}` !== item.target
          || normalizeIp(req.ip) !== item.ip || (req.get("User-Agent") || "") !== item.ua || !session) return res.sendStatus(404);
      // Consume synchronously before the first await; concurrent replays lose.
      tickets.delete(ticket);
      const entry = await vault.launch(item.id);
      if (!entry || new URL(entry.targetUrl).origin !== item.target || new URL(entry.loginUrl).origin !== item.target || !entry.adapter || entry.adapter === "form") return res.sendStatus(404);
      if (entry.adapter === "napcat") {
        entry.fields = { hash: createHash("sha256").update(entry.fields[entry.passwordField] + ".napcat").digest("hex") };
      }
      sendBridge(res, entry);
    } catch (error) { next(error); }
  };
  const remoteCors = async (req, res) => {
    res.set({ "Cache-Control": "private, no-store, max-age=0", Vary: "Origin" });
    const origin = req.get("Origin");
    if (!origin || !access.trustProxy(req.socket.remoteAddress, 0) || !access.isAllowed(req)
        || `https://${req.get("Host")}` !== access.origin) return false;
    const allowed = (await vault.list()).some(entry => entry.enabled && usesRemoteHandoff(entry) && new URL(entry.targetUrl).origin === origin);
    if (!allowed) return false;
    res.set({ "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" });
    return true;
  };
  const remoteOptions = async (req, res, next) => {
    try { return res.sendStatus(await remoteCors(req, res) ? 204 : 404); } catch (error) { next(error); }
  };
  const remoteConsume = async (req, res, next) => {
    try {
      if (!await remoteCors(req, res)) return res.sendStatus(404);
      prune();
      const ticket = req.body?.ticket, item = tickets.get(ticket);
      if (!item?.remote || req.get("Origin") !== item.target || normalizeIp(req.ip) !== item.ip
          || (req.get("User-Agent") || "") !== item.ua
          || !getSession({ headers: { cookie: `home_admin_session=${item.session}` } })) return res.sendStatus(404);
      // As with local handoff, only one request may decrypt the credential.
      tickets.delete(ticket);
      const entry = await vault.launch(item.id);
      if (!entry || !usesRemoteHandoff(entry) || entry.adapter !== item.adapter || new URL(entry.targetUrl).origin !== item.target
          || new URL(entry.loginUrl).origin !== item.target) return res.sendStatus(404);
      return res.json(payloadFor(entry));
    } catch (error) { next(error); }
  };
  const client = (req, res) => sendBridge(res, null, access.origin);
  return { issue, consume, client, remoteOptions, remoteConsume };
};

const sendBridge = (res, entry, remoteHome = "") => {
  const nonce = randomBytes(18).toString("base64"), payload = entry ? payloadFor(entry) : null;
  headers(res, nonce, remoteHome).type("html").send(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>正在登录 ${escape(entry?.name || "服务")}</title><p id="status">正在登录 ${escape(entry?.name || "服务")}…</p><a href="${escape(entry?.targetUrl || "/")}">打开原登录页面</a><script nonce="${nonce}">
let cfg=${json(payload)};
const write=(key,value)=>localStorage.setItem(key,String(value));
const call=async(url,options={})=>{const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});const data=await response.json().catch(()=>({}));if(!response.ok||data.success===false||data.ok===false||data.status==='error'||data.requires_2fa||data.data?.totp_required)throw Error('登录失败或需要额外验证，请打开原登录页面。');return data;};
(async()=>{
 ${remoteHome ? `const ticket=location.hash.slice(1);history.replaceState(null,'',location.pathname);if(!/^[A-Za-z0-9_-]{43}$/.test(ticket))throw Error('登录链接已失效');cfg=await call(${json(remoteHome + "/_home_login/remote-consume")},{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket})});` : ""}
 if(new URL(cfg.login).origin!==location.origin||new URL(cfg.target).origin!==location.origin)throw Error('登录站点不符');
 const adapter=cfg.adapter;
 if(adapter==='basic'){
  await new Promise((resolve,reject)=>{
   const request=new XMLHttpRequest();
   request.open('GET',cfg.login,true,cfg.fields[cfg.usernameField]||'',cfg.fields[cfg.passwordField]);
   request.withCredentials=true;request.timeout=30000;
   request.onload=()=>request.status>=200&&request.status<300?resolve():reject(Error('登录失败'));
   request.onerror=request.ontimeout=()=>reject(Error('无法连接登录服务'));
   request.send();
  });
  const target=cfg.target;cfg=null;location.replace(target);return;
 }
 if(adapter==='cpa'||adapter==='metapi'||adapter==='sub2api'){
  let seed,keys,destination=cfg.target;
  if(adapter==='sub2api'){
   const response=await call(cfg.login,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cfg.fields)});
   const data=response.data;
   if(response.code!==0||!data?.access_token||!data.user||data.requires_2fa||data.totp_required)throw Error('登录失败或需要额外验证');
   seed={'auth_token':data.access_token,'auth_user':JSON.stringify(data.user),'token_expires_at':String(Date.now()+Number(data.expires_in||3600)*1000)};
   if(data.refresh_token)seed.refresh_token=data.refresh_token;
   keys=['auth_token','auth_user','token_expires_at','refresh_token'];
   destination=new URL(data.user.role==='admin'?'/admin/dashboard':'/dashboard',cfg.target).href;
  }else{
   const key=adapter==='metapi'?cfg.fields[cfg.passwordField].trim():cfg.fields[cfg.passwordField];
   await call(cfg.login,{headers:{Authorization:'Bearer '+key}});
   seed=adapter==='metapi'?{'auth_token':key,'auth_token_expires_at':String(Date.now()+12*60*60*1000)}:{'isLoggedIn':'true','cli-proxy-auth':JSON.stringify({state:{apiBase:location.origin,managementKey:key,rememberPassword:true,sessionMode:'manager_embedded',sessionPanelBase:location.origin},version:0})};
   keys=adapter==='metapi'?['auth_token','auth_token_expires_at']:['cli-proxy-auth','managementKey','apiBase','apiUrl','isLoggedIn'];
  }
  const page=await fetch(cfg.target,{cache:'no-store',credentials:'same-origin'});if(!page.ok)throw Error('无法打开后台页面');
  let html=await page.text();
  const shim='('+function(seed,names){const values=new Map(Object.entries(seed)),keys=new Set(names);const proto=Storage.prototype,get=proto.getItem,set=proto.setItem,remove=proto.removeItem;proto.getItem=function(k){return this===localStorage&&keys.has(k)?values.get(k)??null:get.call(this,k);};proto.setItem=function(k,v){if(this===localStorage&&keys.has(k)){values.set(k,String(v));return;}return set.call(this,k,v);};proto.removeItem=function(k){if(this===localStorage&&keys.has(k)){values.delete(k);return;}return remove.call(this,k);};}.toString()+')('+JSON.stringify(seed).replace(/</g,'\\u003c')+','+JSON.stringify(keys)+');';
  const doc=new DOMParser().parseFromString(html,'text/html');
  // Browsers hide the nonce attribute during DOM serialization. Use a marker
  // until serialization, then restore the real attribute for the new document.
  for(const node of doc.querySelectorAll('script')){node.removeAttribute('nonce');node.setAttribute('data-home-login-nonce','${nonce}');}
  const bootstrap=doc.createElement('script');bootstrap.setAttribute('data-home-login-nonce','${nonce}');bootstrap.textContent=shim;doc.head.prepend(bootstrap);
  html=doc.documentElement.outerHTML.replaceAll('data-home-login-nonce="${nonce}"','nonce="${nonce}"');
  cfg=null;history.replaceState(null,'',destination);
  document.open();document.write(html);document.close();return;
 }
 const requestHeaders={'Content-Type':'application/json'};
 if(adapter==='memoirs'){const csrf=await call('/api/v1/auth/csrf');requestHeaders[csrf.headerName]=csrf.token;}
 if(adapter==='3x-ui'){const csrf=await call(new URL('csrf-token',cfg.login).href,{headers:{'X-Requested-With':'XMLHttpRequest'}});if(!csrf.success||!csrf.obj)throw Error('无法获取登录校验');requestHeaders['X-CSRF-Token']=csrf.obj;requestHeaders['X-Requested-With']='XMLHttpRequest';}
 const form=adapter==='3x-ui';
 if(form)requestHeaders['Content-Type']='application/x-www-form-urlencoded';
 const data=await call(cfg.login,{method:'POST',headers:requestHeaders,body:form?new URLSearchParams(cfg.fields):JSON.stringify(cfg.fields)});
 if(adapter==='napcat'){const token=data.data?.credential||data.data?.Credential;if(data.code!==0||!token)throw Error('登录失败或需要双因素验证');write('token',JSON.stringify(token));}
 if(adapter==='astrbot'){if(!data.data?.token)throw Error('登录失败或需要额外验证');write('token',data.data.token);write('user',data.data.username);}
 if(adapter==='new-api'){if(data.data?.user?.id){if(!data.data.access_token)throw Error('账号验证未完成');}else{if(!data.data?.id)throw Error('账号验证未完成');write('user',JSON.stringify(data.data));}}
 if(adapter==='miaomiaowu'){if(!data.token)throw Error('登录失败或需要双因素验证');document.cookie='traffic_info_access_token='+JSON.stringify(data.token)+'; Path=/; Secure; SameSite=Lax';}
 if(adapter==='vm2api'){if(!data.token)throw Error('账号验证未完成');write('kin_console_token',data.token);write('kin_console_user',data.user);}
 const target=adapter==='3x-ui'?new URL('panel/',cfg.login).href:adapter==='komari'?new URL('/admin',cfg.target).href:cfg.target;cfg=null;location.replace(target);
})().catch(()=>{cfg=null;document.getElementById('status').textContent='登录未完成，请打开原登录页面检查密码、验证码或双因素验证。';});
addEventListener('pagehide',()=>{cfg=null;});
</script></html>`);
};
