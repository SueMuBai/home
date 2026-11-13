# 主页保存凭据与点击登录

在允许的网络中，连续点击主页域名五次即可打开原地登录弹窗；点击遮罩、关闭按钮或 Esc 会清空表单和点击计数，下次须重新点击五次。登录成功后仍在主页，原地刷新服务器配置并显示隐藏卡片、右上角管理入口；刷新后有效会话自动恢复这些入口。原随机后台地址仍可用。登录组件复用现有密码及 TOTP 逻辑，关闭时取消前端未完成请求，不持久化密码或弹窗状态。

管理员登录主页后，点击网站卡片才取用该服务凭据，以目标网站的原生登录接口建立会话，再打开对应后台。可在主页后台「自动登录」添加、修改、停用、删除配置，选择服务对应的登录方式。当前服务器已接入 SSTP、NapCat、AstrBot、New API、Komari、妙妙屋、CPA Plus、3x-ui、Yarr、vm2api 和光阴叙；导航链接和各服务密码保持原值。

普通表单支持 `application/x-www-form-urlencoded` 账号密码及附加文本字段，SSTP、Yarr 使用该方式。其余服务通过目标域名的网关交接页面，在该域名下调用原生 JSON/CSRF 登录接口并建立原生 Cookie 或令牌状态。NapCat 支持当前版本的 Credential 响应；New API 同时兼容旧版用户状态与新版 refresh Cookie；3x-ui 先获取 CSRF，再提交表单。验证码或双因素仍需在原页面完成，不绕过原有校验。不要把密码写入网站列表链接。

密码及附加字段通过 AES-256-GCM 加密，持久保存于 `HOME_DATA_DIR/login-vault.json`，0600；`HOME_VAULT_KEY` 是独立的 32 字节 Base64 密钥，存于部署目录受限 `.env`，不能提交或每次更新重新生成。迁移时必须一起保留 `.env` 和整个 data 目录。密钥丢失后只能重新录入各服务密码。写入在进程内串行，临时文件及目录 fsync 后原子替换；适用于单实例部署，不应让多实例同时写同一 vault 文件。

配置列表和编辑表单只返回服务名称、网址、用户名、字段名、启用状态、是否已有密码；不会返回密码、附加字段明文或密文。编辑密码留空保留原凭据；修改登录地址或字段须重新填写密码和附加字段。账号密码字段不得重名。点击后密码会短暂进入当前管理员浏览器的 HTML/表单内存，浏览器开发者工具可查看本次响应，这是此方案的已知行为；不写入浏览器本地存储，不写入导航链接或地址栏，响应禁止缓存，提交后/离开页面/超时后清空表单。

# 管理入口与来源 IP

必须配置 `HOME_ADMIN_PATH`，为 `/` 加 24–80 个随机字符；实际路径只保存在部署 `.env`。旧 `/admin`、`/admin.html`、`/api/admin` 和旧内网 SSO 兑换接口均返回 404。非白名单访客的配置响应不包含管理入口或隐藏卡片。允许 IP 的主页可以显示管理员入口，但仍须密码和既有两步验证。

`HOME_ALLOWED_IPS` 是逗号分隔的精确出口地址。登录页面、全部管理 API、凭据配置、点击取密请求每次都检查 IP；切换到不允许的网络后，即使会话仍有效也不能访问管理功能。正式部署仅允许妙妙屋中的五个独立节点，不包含家宽或链式落地出口。

网关只信任 Cloudflare 官方网段提供的 CF-Connecting-IP，覆盖转发头。后端仅信任 `HOME_PROXY_HOST`（默认 ng）通过 Docker DNS 解析出的精确网关 IP；不信整个 Docker 网段，不接受直连客户端自报 XFF。解析失败关闭代理信任，恢复后自动更新。更改代理/白名单须同步修改部署 .env 或网关配置，执行 Compose 重建/网关校验重载。

所有修改请求检查 Origin，管理接口跨站请求被拒绝；点击表单使用 CSP nonce、防嵌入和 no-store。主页会话仍为内存中的 12 小时会话，重启须重新登录；目标站已创建的会话按各站自己的策略过期，不随主页退出立即撤销。

# 部署与测试

生产使用 `/data/apps/home/docker-compose.yml`，镜像由 `.deploy/Dockerfile` 构建。源码内不保存环境密钥和真实凭据；Docker 构建上下文排除 data、.deploy 和 verification。`/data/apps/home/update.sh` 保留本地提交并 rebase origin/dev，冲突中止，构建测试通过才部署，健康失败回退镜像。

```sh
node --test tests/*.test.mjs
```

9 组自动测试覆盖精确 IP、伪造转发头、跨站请求、匿名及失效会话、旧路径、加密落盘与重启、密文篡改、并发更新、字段和网址校验，以及原密码/两步验证、交接票据过期边界、并发重放、注销撤销、目标域名与 UA/IP 绑定和脚本注入。浏览器验收使用隔离主页管理员与真实目标服务，验证登录后受保护 API、原生状态，以及 CPA 密钥不落浏览器持久存储。

此前 Home/Gate 的一次性码 SSO 已由本方案替代；主页不再提供旧兑换接口。Gate 旧桥接代码和环境变量暂保留但不再被主页调用，无需为通用表单登录改造目标网站。后续清理 Gate 时须连同部署补丁处理，不能恢复旧 Home 兑换端点。

## JSON 服务的网关接入

模板在 `deploy/home-login.nginx.inc`。在目标站实际使用的回源 server 块（80 和 443）接入此模板（部署路径 `/etc/nginx/conf.d/home-native-login.inc`），再 nginx -t / reload；无需修改目标应用源码或重启目标应用。主页与目标站须由同一个可信网关代理，后端仅信任该网关的准确 IP；模板只信任 Cloudflare 官方网段提供的客户端 IP，再覆盖 XFF。保留目标 Host，转发到主页 `/_home_login/consume`，不能将用户自报的目标域名或 XFF 直接当成可信信息。

点击时先在主页校验白名单及现有会话，签发 60 秒内可用的一次性随机票据。POST 到目标域名 `/.home-login` 后，后端再次验证可信网关、Origin、IP、UA、目标 Host、原主页会话及服务启用状态，原子消费票据后才解密密码。票据不包含密码，不能跨服务、跨用户或并发重放。所有交接响应 no-store、防嵌入；凭据不会进入 URL 或访问日志。

原生登录成功后，各应用按自己的方式保存会话 Cookie/令牌。CPA 的管理员密钥就是登录凭据，使用当前页面内存覆盖其认证存储，不写浏览器 localStorage；刷新 CPA 页面后请重新从主页点击。其他应用存储的是它们签发的令牌，不是配置中的明文密码。退出主页不会撤销已建立的目标站会话。

MetAPI、Sub2API、CPA 和 New API 支持「远端 Nginx 中转」开关；MetAPI/Sub2API 新建时默认开启，既有本机 CPA/New API 默认关闭，保持原来的 POST 交接。远端模板统一为 `deploy/remote-home-login.nginx.inc`，已有 MetAPI 模板保持兼容。切换中转方式须重新确认凭据；修改账号、密码、网址和开关均可在「自动登录」页面完成。

公开卡片也可关联自动登录配置：只有白名单内已经登录主页的管理员收到启动链接，普通访客、主页退出后及切换到非白名单IP时始终收到原始公开网址。`hidden` 仅控制是否显示卡片，与是否可配置自动登录无关。管理员退出主页不会自动撤销目标站先前建立的原生会话。

后续新增服务：先在「网站列表」添加链接，再在「自动登录」填写完全相同的链接和对应登录方式。普通 POST 表单无需目标网关模板；新的 JSON 服务域名需先接入模板，已有本服务器域名无需重复操作。服务升级若改变登录协议，应更新对应适配器并重新验证。

## 远端 MetAPI

登录方式选择「MetAPI（管理员 Token）」，目标为 `https://met.1692958.xyz/`，接口为 `https://met.1692958.xyz/api/settings/auth/info`；用户名字段与用户名留空，密码栏填现有管理员 Token，密码字段保留 `password`。登录调用原站 `GET` 接口并携带 `Authorization: Bearer …`，没有账号密码 POST 表单。

远端 Nginx 在实际 HTTP/HTTPS 回源的 `server` 内加入 [metapi-home-login.nginx.inc](deploy/metapi-home-login.nginx.inc)，先 `nginx -t` 再 reload。该 location 仅代理不含凭据的公共客户端页面，Home 更新后自动获取新版本；启用 HTTPS 上游证书校验，CA 文件使用 `/etc/ssl/certs/ca-certificates.crt`。必须保留浏览器地址 `https://met.1692958.xyz/.home-login`，不要返回重定向到主页域名。现有通用原生 POST 网关模板不适用于跨服务器的 MetAPI。

点击时主页签发 60 秒一次性票据，通过 URL fragment 交接；票据不进入请求 URL/回源日志，远端客户端读取后立即清除 fragment，浏览器直接向 Home 兑换。兑换独立于第三方 Cookie，仍绑定真实的主页会话、精确 IP、User-Agent、目标 Origin 和可信网关；前置请求及实际取密都校验白名单，CORS 只允许已启用的 MetAPI 目标 origin。票据与原有本机 POST 票据不通用，注销、超时、禁用、重放均拒绝。

MetAPI 原生前端将管理员 Token 当作登录凭据。适配器仅在当前文档内存模拟 `auth_token` 和 `auth_token_expires_at`，不向浏览器持久存储写入管理员 Token；有效期沿用当前 MetAPI 的 12 小时。刷新/关闭页面后需重新从主页进入，MetAPI 页面内的退出按钮可清除本次内存状态。后续接口或前端存储键变更须重新验收。

## 远端 Sub2API 与 CPA

Sub2API 选择「Sub2API（邮箱密码）」并开启远端中转。用户名字段填 `email`，用户名填写登录邮箱，密码字段 `password`；接口为目标站 `/api/v1/auth/login`（JSON POST）。只有 `code=0` 且返回 access_token 与 user 时才继续，双因素/验证码仍需原站处理。返回的 access_token、refresh_token、auth_user、token_expires_at 仅当前文档内存保存；按服务器返回的用户角色进入 `/admin/dashboard` 或 `/dashboard`。刷新后重新从主页进入。原账号密码不进入导航网址或浏览器持久存储。

远端 CPA 选择既有「CPA Plus（密钥只在页面内存）」并开启远端中转；接口为目标站 `/usage-service/config`（GET Bearer），后台地址须与主页导航链接相同。密钥通过既有内存适配方式交给原生前端，刷新后重新从主页进入。原有本机 CPA 不开启此开关，保持本机网关和登录行为。

远端 Nginx 配好不含凭据的客户端代理后，实际取密仍由浏览器直接请求 Home，在每次请求时验证白名单、Origin、主页会话和一次性票据。不开启远端开关的 CPA Origin 不会被远端 CORS 放行，票据同时绑定签发时的服务适配器。不能把远端规则部署完成前的模拟测试当作真实公网已接通。

## SSTP 看板、检测及 HTTP Basic

SSTP 的 `/admin` 仍使用普通 POST 表单；`/results/` 和 `/checker` 是两个独立导航配置，登录方式选择 HTTP Basic。通过同一个一次性票据交接到目标站后，浏览器在目标 origin 使用 XMLHttpRequest 的原生认证参数完成挑战，再跳转到受保护页面。用户密码保留在后端密文中，点击时进入浏览器内存；导航链接和地址栏不携带凭据，也不写 localStorage/sessionStorage。浏览器按原生 HTTP 认证缓存管理本次会话，页面刷新和后续数据请求可继续使用；退出主页不撤销该原生缓存。目标站的 Basic/Bearer 认证规则和检测服务无需更改。

SSTP 的 80/443 server 与其他 JSON 服务一样 include `deploy/home-login.nginx.inc` 的线上模板，既有 nginx 路由和认证保持有效。新增两项凭据可在主页后台「自动登录」中编辑。

自动登录添加/编辑弹窗挂载到 body，避免后台毛玻璃/滚动区域改变 fixed 定位。弹窗限制为当前窗口 90dvh，表单内部滚动，固定底部操作区域；取消、遮罩及 Esc 关闭后清空临时密码，编辑留空保存保留原密文。桌面与手机尺寸均验证从列表底部打开、关闭、重新编辑和底部提交。

### Cloudflare 回源验收

浏览器访问 HTTPS 并不代表源站收到 443 请求，当前 Cloudflare 路径可回源到 HTTP 80。登录交接模板必须同时接入实际回源的 80/443 server；只验证源站 443 会漏掉真实入口路由问题。模板根据源站 TLS 或 HTTPS 转发标记接受交接，直接明文 HTTP 则 308 跳回 HTTPS，保留 POST 方法；所有响应 no-store。

发布验收还须通过真实公网域名（经过 Cloudflare）检查 `/.home-login`：直接 GET 为 405、无有效票据 POST 为 404，不能落到目标应用或代理协议处理。有效票据仍复用原有主页会话、目标 Host/Origin、IP/UA 绑定和一次性消费；不得为测试伪造生产管理员会话。
