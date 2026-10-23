import { reactive, computed } from "vue";

export const siteConfig = reactive({});

export const loadSiteConfig = async () => {
  const res = await fetch("/api/config", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  Object.assign(siteConfig, await res.json());
};

const stripProtocol = (url) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

// subaimu.com -> ["subaimu", "com"]，用于 Logo 大小字分开展示
export const siteDomain = computed(() => {
  const host = stripProtocol(siteConfig.site.url);
  const index = host.indexOf(".");
  return index === -1 ? [host, ""] : [host.slice(0, index), host.slice(index + 1)];
});

export const siteHref = computed(() => {
  const url = siteConfig.site.url;
  return /^https?:\/\//.test(url) ? url : `//${url}`;
});
