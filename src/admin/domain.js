import { onMounted, ref } from "vue";

// 后台在登录前也需要显示站点域名，直接读取公开配置
export const useDomain = () => {
  const domain = ref([location.hostname, ""]);
  onMounted(async () => {
    try {
      const res = await fetch("/api/config", { cache: "no-store" });
      const host = (await res.json()).site.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const index = host.indexOf(".");
      domain.value = index === -1 ? [host, ""] : [host.slice(0, index), host.slice(index + 1)];
    } catch {
      // 保留默认值
    }
  });
  return domain;
};
