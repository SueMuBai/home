<template>
  <div v-if="friendLinks.length" class="friends">
    <div class="line">
      <Icon size="20">
        <UserFriends />
      </Icon>
      <span class="title">友站链接</span>
    </div>
    <div class="friend-all">
      <a
        v-for="item in friendLinks"
        :key="item.link"
        class="friend cards"
        :href="item.link"
        :title="item.desc || item.name"
        target="_blank"
        rel="noopener"
      >
        <img v-if="item.avatar" class="avatar" :src="item.avatar" alt="" loading="lazy" />
        <span v-else class="avatar letter">{{ item.name.slice(0, 1) }}</span>
        <span class="name text-hidden">{{ item.name }}</span>
      </a>
    </div>
  </div>
</template>

<script setup>
import { Icon } from "@vicons/utils";
import { UserFriends } from "@vicons/fa";
import { siteConfig } from "@/config";

const friendLinks = computed(() => siteConfig.friendLinks ?? []);
</script>

<style lang="scss" scoped>
.friends {
  .line {
    margin: 1rem 0.25rem 0.75rem;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    animation: fade 0.5s;
    .title {
      margin-left: 8px;
      font-size: 1.15rem;
      text-shadow: 0 0 5px #00000050;
    }
  }
  .friend-all {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    padding: 4px 2px 6px;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
  .friend {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 160px;
    height: 40px;
    padding: 0 14px 0 6px;
    border-radius: 20px;
    animation: fade 0.5s;
    &:hover {
      color: #fff;
      text-decoration: none;
      background: rgb(0 0 0 / 40%);
    }
    .avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }
    .letter {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #ffffff30;
      font-size: 0.9rem;
    }
    .name {
      font-size: 0.95rem;
    }
  }
}
</style>
