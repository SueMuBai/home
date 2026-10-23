export class ConfigError extends Error {}

const fail = (label, message) => {
  throw new ConfigError(`${label}：${message}`);
};

const object = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(label, "格式错误");
  return value;
};

const text = (value, label, { max = 300, required = false, pattern, hint } = {}) => {
  if (value == null) value = "";
  if (typeof value !== "string") fail(label, "必须是文本");
  const result = value.trim();
  if (required && !result) fail(label, "不能为空");
  if (result.length > max) fail(label, `长度不能超过 ${max}`);
  if (result && pattern && !pattern.test(result)) fail(label, hint);
  return result;
};

// href / window.open 会直接使用这些值，必须拦截 javascript: 等协议
const link = (value, label, { schemes = ["http:", "https:"], allowPath = false, required = true } = {}) => {
  const result = text(value, label, { max: 2000, required });
  if (!result) return result;
  if (allowPath && result.startsWith("/") && !result.startsWith("//")) return result;
  let url;
  try {
    url = new URL(result);
  } catch {
    fail(label, allowPath ? "需为完整链接或以 / 开头的站内路径" : "不是合法的链接");
  }
  if (!schemes.includes(url.protocol)) fail(label, `仅支持 ${schemes.join(" ")} 链接`);
  return result;
};

const oneOf = (value, label, options) => {
  if (!options.includes(value)) fail(label, `必须是 ${options.join(" / ")} 之一`);
  return value;
};

const list = (value, label, max, item) => {
  if (!Array.isArray(value)) fail(label, "格式错误");
  if (value.length > max) fail(label, `最多 ${max} 项`);
  return value.map((entry, index) => item(object(entry, `${label}第 ${index + 1} 项`), `${label}第 ${index + 1} 项`));
};

export const SONG_SERVERS = ["netease", "tencent"];
export const SONG_TYPES = ["song", "playlist", "album", "search", "artist"];

export const sanitizeConfig = (input) => {
  const config = object(input, "配置");
  const site = object(config.site, "站点信息");
  const desc = object(config.desc, "简介");
  const weather = object(config.weather, "天气");
  const music = object(config.music, "音乐");
  const asset = (value, label) => link(value, label, { allowPath: true });

  return {
    site: {
      name: text(site.name, "站点名称", { max: 50, required: true }),
      author: text(site.author, "作者", { max: 50, required: true }),
      keywords: text(site.keywords, "关键词", { max: 200 }),
      description: text(site.description, "站点简介", { max: 300 }),
      url: text(site.url, "站点地址", {
        max: 200,
        required: true,
        pattern: /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?\/?$/i,
        hint: "格式应为 example.com 或 https://example.com",
      }),
      logo: asset(site.logo, "站点图标"),
      mainLogo: asset(site.mainLogo, "主页图标"),
      appleLogo: asset(site.appleLogo, "Apple 端图标"),
      startDate: text(site.startDate, "建站日期", {
        max: 10,
        pattern: /^\d{4}(-\d{2}-\d{2})?$/,
        hint: "格式应为 YYYY 或 YYYY-MM-DD",
      }),
      icp: text(site.icp, "ICP 备案号", { max: 50 }),
      github: link(site.github, "源代码仓库", { required: false }),
    },
    desc: {
      hello: text(desc.hello, "简介标题", { max: 100 }),
      text: text(desc.text, "简介内容", { max: 300 }),
      helloOther: text(desc.helloOther, "展开时标题", { max: 100 }),
      textOther: text(desc.textOther, "展开时内容", { max: 300 }),
    },
    siteLinks: list(config.siteLinks, "网站列表", 60, (item, label) => ({
      icon: text(item.icon, `${label} · 图标`, {
        max: 50,
        required: true,
        pattern: /^[A-Za-z]+$/,
        hint: "图标名称无效",
      }),
      name: text(item.name, `${label} · 名称`, { max: 20, required: true }),
      link: link(item.link, `${label} · 链接`),
      hidden: item.hidden === true,
    })),
    friendLinks: list(config.friendLinks ?? [], "友站链接", 60, (item, label) => ({
      name: text(item.name, `${label} · 名称`, { max: 20, required: true }),
      link: link(item.link, `${label} · 链接`),
      avatar: link(item.avatar, `${label} · 头像`, { allowPath: true, required: false }),
      desc: text(item.desc, `${label} · 简介`, { max: 60 }),
    })),
    socialLinks: list(config.socialLinks, "社交链接", 20, (item, label) => ({
      name: text(item.name, `${label} · 名称`, { max: 30, required: true }),
      icon: asset(item.icon, `${label} · 图标`),
      tip: text(item.tip, `${label} · 提示语`, { max: 50 }),
      url: link(item.url, `${label} · 链接`, { schemes: ["http:", "https:", "mailto:"] }),
    })),
    weather: {
      amapKey: text(weather.amapKey, "高德 Key", {
        max: 64,
        pattern: /^[A-Za-z0-9]+$/,
        hint: "只能包含字母和数字",
      }),
    },
    music: {
      api: link(music.api, "歌曲 API 地址", { required: false }),
      server: oneOf(music.server, "歌曲服务器", SONG_SERVERS),
      type: oneOf(music.type, "播放类型", SONG_TYPES),
      id: text(music.id, "播放 ID", { max: 100 }),
    },
  };
};
