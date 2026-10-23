import { createApp } from "vue";
import "@/style/style.scss";
import App from "@/App.vue";
import { loadSiteConfig } from "@/config";
// 引入 pinia
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
// swiper
import "swiper/css";

const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

app.use(pinia);

loadSiteConfig()
  .then(() => app.mount("#app"))
  .catch((error) => {
    console.error("站点配置加载失败：", error);
    document.getElementById("app").textContent = "站点配置加载失败，请稍后刷新重试";
  });

// PWA
navigator.serviceWorker.addEventListener("controllerchange", () => {
  // 弹出更新提醒
  console.log("站点已更新，刷新后生效");
  ElMessage("站点已更新，刷新后生效");
});
