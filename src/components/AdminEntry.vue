<template>
  <Transition name="fade">
    <a v-if="store.adminEntryShow && siteConfig.adminPath" class="admin-entry" :href="siteConfig.adminPath" target="_blank" rel="noopener noreferrer">
      <Icon size="16"><UserShield /></Icon>
      <span>{{ siteConfig.isAdmin ? "进入后台" : "管理员登录" }}</span>
    </a>
  </Transition>
</template>

<script setup>
import { Icon } from "@vicons/utils";
import { UserShield } from "@vicons/fa";
import { mainStore } from "@/store";
import { siteConfig } from "@/config";

const store = mainStore();
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
