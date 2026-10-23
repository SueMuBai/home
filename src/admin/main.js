import { createApp } from "vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "element-plus/theme-chalk/dark/css-vars.css";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import "./admin.scss";
import Admin from "./Admin.vue";

document.documentElement.classList.add("dark");
createApp(Admin).use(ElementPlus, { locale: zhCn }).mount("#admin");
