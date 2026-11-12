<template>
  <Transition name="fade">
    <a v-if="siteConfig.isAdmin && siteConfig.adminPath && !store.backgroundShow" class="admin-entry" :href="siteConfig.adminPath" target="_blank" rel="noopener noreferrer">
      <Icon size="16"><UserShield /></Icon>
      <span>进入后台</span>
    </a>
  </Transition>
  <el-dialog
    v-model="store.adminLoginOpen"
    class="home-admin-dialog"
    title="管理员登录"
    width="min(420px, calc(100vw - 32px))"
    align-center
    append-to-body
    destroy-on-close
    :close-on-click-modal="true"
    :close-on-press-escape="true"
  >
    <Login v-if="store.adminLoginOpen" embedded @success="loggedIn" />
    <p v-if="refreshError" class="refresh-error" role="alert">{{ refreshError }}</p>
  </el-dialog>
</template>

<script setup>
import { Icon } from "@vicons/utils";
import { UserShield } from "@vicons/fa";
import { mainStore } from "@/store";
import { siteConfig, loadSiteConfig } from "@/config";
import { ref, watch } from "vue";
import Login from "@/admin/Login.vue";

const store = mainStore();
const refreshError = ref("");
watch(() => store.adminLoginOpen, () => { refreshError.value = ""; });
const loggedIn = async () => {
  try {
    await loadSiteConfig();
    if (!siteConfig.isAdmin) throw new Error("当前网络无法使用管理功能，请检查代理出口后重试");
    store.adminLoginOpen = false;
  } catch (error) {
    refreshError.value = error.message;
  }
};
</script>

<style lang="scss" scoped>
.admin-entry {
  position: fixed;
  top: 20px;
  right: 24px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 25px;
  font-size: 0.95rem;
  background-color: #00000040;
  backdrop-filter: blur(10px);
  transition:
    transform 0.3s,
    background-color 0.3s;
  &:hover {
    color: #fff;
    text-decoration: none;
    background-color: #00000060;
    transform: scale(1.05);
  }
  &:active {
    transform: scale(0.98);
  }
}
</style>

<style lang="scss">
.home-admin-dialog {
  --el-dialog-bg-color: #20252ee8;
  --el-text-color-primary: #efefef;
  --el-text-color-regular: #e0e0e0;
  --el-fill-color-blank: #ffffff0d;
  --el-border-color: #ffffff30;
  --el-input-text-color: #fff;
  --el-color-primary: #10b981;
  --el-color-primary-light-3: #34d399;
  --el-color-primary-dark-2: #059669;
  border: 1px solid #ffffff20;
  border-radius: 16px;
  padding: 24px;
  backdrop-filter: blur(20px);
  box-shadow: 0 24px 100px #0008;
  .el-dialog__body { padding: 8px 8px 0; }
  .el-input__inner { user-select: text; }
  .refresh-error { color: #ff8a8a; line-height: 1.6; }
}
</style>
