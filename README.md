简体中文 | [English](./README_EN.md)

> [!IMPORTANT]
> ## 致大家
> 此项目最初只是一个简单的主页。然而，随着越来越多的小伙伴发现了这个项目，它受到了大量本不应有的关注。而且，此项目作为初学前端的作品，其代码相当杂乱且质量低下。此外，该项目还遭到众多不明资源站或下载站的倒卖，致使许多不明真相的购买者从源代码中找到本人的联系方式进行问题咨询或提出功能需求。由于目前个人原因，该仓库进行存档，敬请谅解！

<p>
<strong><h2>無名の主页</h2></strong>
简单的小主页，原来的看够了，重新弄了一个
</p>

![無名の主页](/screenshots/main.jpg)

> 主页的 Logo 字体已经过压缩，若用本站 Logo 以外的字母会变回默认字体，这里是 [完整字体](https://file.imsyy.top/font/Other/Pacifico-Regular.ttf)，若无法下载，可将字体目录下的 `Pacifico-Regular-all.ttf` 进行替换

### 👀 Demo

> 由于 CDN 缓存原因，查看最新效果可能需要 `Ctrl` + `F5` 强制刷新浏览器缓存

- [無名の主页](https://www.imsyy.top)
- [無名の主页 - Dev](https://home-imsyy.vercel.app)
- [無名の主页 - 备用线路](https://home-5iw.pages.dev)

### 🎉 功能

- [x] 载入动画
- [x] 站点简介
- [x] Hitokoto 一言
- [x] 日期及时间
- [x] 实时天气
- [x] 时光进度条
- [x] 音乐播放器
- [x] 移动端适配
- [x] 后台管理（密码登录 + 两步验证）

### ⚙️ 自动部署

如果遇到构建环境或者打包过程出现错误，则可以采用 `Github Actions` 来进行自动构建

- 在成功 `fork` 仓库后，前往 `Actions` 页面，若您是首次开启，则会出现下面的提示，点击开启

  ![步骤1](/screenshots/step1.jpg)

- 然后在仓库中进行任意修改后均会触发工作流的运行，在工作流完成后，会在下方生成一个可供下载的压缩包，即构建出的 `dist` 目录，需与 `server/`、`package.json` 一起放到服务器上通过 `pnpm start` 运行（见下方「部署」）

  ![步骤2](/screenshots/step2.jpg)

### ⚙️ 部署

站点由 `server/` 下的 Node 服务提供：它同时托管主页、`/admin` 后台和配置接口，因此**不能再作为纯静态文件部署**（Vercel / Pages 等静态托管不再适用）。

- **安装** [node.js](https://nodejs.org/zh-cn/) **环境**（node >= 18）

```bash
# 安装依赖
pnpm install

# 开发预览（默认 http://localhost:3000）
pnpm dev

# 构建并启动（默认 http://localhost:12445）
pnpm build
pnpm start
```

可用环境变量：

| 变量 | 说明 |
| --- | --- |
| `PORT` | 监听端口，开发默认 `3000`，生产默认 `12445` |
| `ADMIN_PASSWORD` | 首次启动时的管理员密码；不设置则随机生成并打印在启动日志中 |
| `HOME_DATA_DIR` | 配置与账号数据目录，默认 `./data`（已加入 `.gitignore`） |
| `TRUST_PROXY` | 位于 Nginx 等反向代理之后时设置（如 `1`），以便正确识别访客 IP 进行登录限流 |

### ⚙️ Docker 部署

```bash
# 首次启动前可在 docker-compose.yml 中设置 ADMIN_PASSWORD
docker compose up -d --build
```

数据保存在宿主机的 `./data` 目录中。

### 🔐 后台管理

访问 `/admin` 输入管理员密码即可进入后台，也可以连续点击三次主页域名显示右上角入口，再次三击可隐藏入口。后台与主页使用一致的模糊壁纸、毛玻璃卡片和域名字体。可在线修改：

- 站点信息（名称、作者、地址、图标、建站日期、ICP 备案号、简介卡片等）
- 网站列表（图标、名称、链接、排序、隐藏开关）。隐藏链接仅向已登录管理员下发，普通访客的接口响应中不包含这些链接；登录或退出后刷新主页生效。隐藏入口并不代替密码认证，隐藏链接也不保护目标网站自身的访问权限。
- 友站链接（名称、链接、可选头像、简介、排序），显示在主页网站列表下方；列表为空时不显示该模块
- 社交链接：点击「添加社交链接」新增一行，填写名称、目标链接等信息后点击底部「保存配置」。新增项默认使用站点 Logo，可替换为其他图标地址。后台采用全窗口布局，底部保存栏独立于内容区域。
- 天气（高德 Web 服务 Key，留空则使用备用接口）
- 音乐（Meting API 地址、平台、类型、ID）

后台桌面端使用侧栏导航与双列表单；手机端使用横向滚动导航、单列表单和独立链接卡片。卡片点击「编辑链接」展开字段，底部可切换隐藏状态、排序和删除。保存栏固定在屏幕底部，修改后点击「保存配置」；「放弃修改」重新载入已保存配置。

保存后刷新主页即可生效，无需重新构建。

在「安全」页可修改密码，以及开启 **两步验证 (2FA)**：使用 Google Authenticator、Microsoft Authenticator 等应用扫码绑定后，登录时需额外输入 6 位动态验证码。

连续 5 次登录失败会锁定该 IP 15 分钟。忘记密码或丢失 2FA 设备时，在服务器上执行以下命令可重置密码并关闭两步验证：

```bash
# 不设置 ADMIN_PASSWORD 时会生成随机密码并打印
ADMIN_PASSWORD=新密码 pnpm reset-password
```

网站列表可选的图标在 `src/utils/siteIcons.js` 中维护，可前往 [xicons](https://www.xicons.org) 挑选 `fa` 类图标引入。

### 天气

天气及地区获取需要 `高德开放平台` 相关 API：前往 [高德开放平台控制台](https://console.amap.com/dev/index) 创建一个 `Web 服务` 类型的 `Key`，在后台「天气」页填入。

### 音乐

> 本项目采用了基于 `MetingJS` 的 `Aplayer` 音乐播放器，可实现快速自定义歌单  
> \*仅支持 **中国大陆地区**

在后台「音乐」页配置歌曲 API 地址（参照 [Meting-API](https://github.com/xizeyoupan/Meting-API) 自行部署）、平台、播放类型与 ID。

### 字体

现采用 `HarmonyOS Sans` 开源字体，采用字体拆分，提升加载速度

> 由于本站 `CDN` 已开启防盗链，**非本站域名不可访问**，请将字体引入链接更改为下方内容，否则 **自定义字体将失效**
>
> `https://s1.hdslb.com/bfs/static/jinkela/long/font/regular.css`

<details>
<summary>旧版方式</summary>

> 由于本项目引入了中文字体，需要压缩中文字体以提高网页加载速度（ 也可以取消使用中文字体 ）

#### 中文字体去除繁体

- 安装 `Python 3.7` 和 `pip`
- 运行 `pip install fonttools`
- 下载 [sc_unicode.txt](https://gist.githubusercontent.com/imaegoo/d64e5088b723c2e02c40985f55ff12db/raw/5ebd2ce49418c73459a9dfe050483409306a6c1d/sc_unicode.txt)
- 运行 `pyftsubset 字体名称.ttf --unicodes-file=sc_unicode.txt`

#### 字体进一步压缩

- 编译安装 `Google woff2`

```bash
sudo apt-get install -y git g++ make
git clone --recursive https://github.com/google/woff2.git
cd woff2
make clean all
```

- 再压缩字体

```
./woff2_compress ./字体名称.ttf
```

- 最终可对原字体进行缓加载，**先行加载压缩后的字体**

> 详细信息可前往 [虹墨空间站](https://www.imaegoo.com/2020/chinese-font-compress/) 查看原文

</details>

### 网站图标及网站背景

#### 网站背景

可以在 `public/images` 中修改网站背景

如果想要添加更多的本地图片作为网站背景，可以将图片重命名 `background+数字` 的形式，并在 `src/components/Background/index.vue` 中进行修改：

```js
if (type == 0) {
  // 修改此处 Math.random() 后面的第一个数字为图片的数量
  bgUrl.value = `/images/background${Math.floor(Math.random() * 10 + 1)}.webp`;
}
```

#### 网站图标

可以在 `public/images/icon` 中修改网站图标。

### 技术栈

- [Vue](https://cn.vuejs.org/)
- [Vite](https://vitejs.cn/vite3-cn/)
- [Pinia](https://pinia.vuejs.org/zh/)
- [IconPark](https://iconpark.oceanengine.com/official)
- [xicons](https://xicons.org/)
- [Aplayer](https://aplayer.js.org/)

### API

- [韩小韩 WebAPI 接口](https://api.vvhan.com/)
- [搏天 API](https://api.btstu.cn/doc/sjbz.php)
- [教书先生 API](https://api.oioweb.cn/doc/weather/GetWeather)
- [高德开放平台](https://lbs.amap.com/)
- [Hitokoto 一言](https://hitokoto.cn/)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=imsyy/home&type=Date)](https://star-history.com/#imsyy/home&Date)

<a title="SSL" target="_blank" href="https://myssl.com/seal/detail?domain=blog.imsyy.top"><img src="https://img.shields.io/badge/MySSL-安全认证-brightgreen"></a>&nbsp;<a title="CDN" target="_blank" href="https://cdnjs.com/"><img src="https://img.shields.io/badge/CDN-Cloudflare-blue"></a>&nbsp;<a title="Copyright" target="_blank" href="https://imsyy.top/"><img src="https://img.shields.io/badge/Copyright%20%C2%A9%202020--2023-%E7%84%A1%E5%90%8D-red"></a>
