# 从主页进入 SSTP

管理员登录主页后，点击指向 `https://sstp.subaimu.com/admin` 的网站卡片，会自动建立 SSTP 原生登录会话。普通访客继续使用原链接与 SSTP 密码登录。

主页与 SSTP 的服务器环境需要同一份随机 `HOME_SSO_SECRET`（至少 32 字符，部署时生成，不写入仓库）。SSTP 还需要配置 `HOME_SSO_ORIGIN=https://subaimu.com` 与内部兑换地址 `HOME_SSO_REDEEM_URL=http://home:8080/api/internal/sso/redeem`。服务器之间必须可访问该内部地址。

主页仅向已登录管理员的 `/api/config` 增加 `launchUrl`，不改存储的网址格式。点击后，主页生成 60 秒有效的一次性随机凭证，通过浏览器 POST 交给 SSTP；SSTP 使用服务器共享密钥到主页兑换。兑换绑定原管理员会话、浏览器 User-Agent 和 SSTP 服务，并同步消费凭证，防止重复或并发兑换。SSTP 创建与原生密码登录完全相同的 HttpOnly/Secure、主机专属 Cookie，原密码和两步验证逻辑保持独立。

一次性凭证不放 URL；交接页禁止缓存和嵌入，使用带 nonce 的 CSP，仅允许向固定的 SSTP 地址提交。`strict-origin` 引用策略保留跨站表单的 Origin 以供校验。主页退出后，尚未兑换的凭证立即失效；已创建的 SSTP 会话按 SSTP 原有 24 小时有效期与退出方式管理。主页重启仍会清空它原有的内存登录会话，需要重新登录。

当前只接入 SSTP 的订阅管理后台；结果看板的 Basic 登录以及其他应用不受此功能覆盖。增加其他服务应增加对应的后端兑换与原生会话适配，不能将密码写进卡片、URL 或浏览器存储。

测试使用隔离目录和测试密码：

```sh
node --test tests/sso.test.mjs
```

测试检查匿名访问、现有密码登录、来源限制、共享密钥、一次性兑换、并发、浏览器绑定、服务范围、精确过期边界、功能关闭及退出后撤销。部署 Dockerfile 在构建前运行这些检查。

此服务器使用本地功能分支 `feat/sstp-sso`。`/data/apps/home/update.sh` 会先 rebase `origin/dev`，冲突时 abort 并保留线上服务；构建含测试的新镜像后切换 Compose，健康失败恢复上一镜像。SSTP 的适配位于 Gate 本地部署目录 `.deploy/vps/`，构建时验证上游补丁锚点与原生 Cookie 互通。环境密钥和运行数据须随部署目录保留。
