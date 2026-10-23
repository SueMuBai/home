<template>
  <div class="cover">
    <img class="bg" :src="background" alt="" />
    <div class="gray" />
  </div>
  <div class="admin-root">
    <div v-if="state === 'loading'" class="center">加载中…</div>
    <Login v-else-if="state === 'login'" @success="refresh" />
    <Dashboard v-else :totp-enabled="totpEnabled" @logout="state = 'login'" @refresh="refresh" />
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { adminApi } from "./api";
import Login from "./Login.vue";
import Dashboard from "./Dashboard.vue";

const background = `/images/background${Math.floor(Math.random() * 10 + 1)}.jpg`;
const state = ref("loading");
const totpEnabled = ref(false);

const refresh = async () => {
  const session = await adminApi.session();
  totpEnabled.value = Boolean(session.totpEnabled);
  state.value = session.authenticated ? "dashboard" : "login";
};

onMounted(refresh);
</script>

<style scoped lang="scss">
.cover {
  position: fixed;
  inset: 0;
  z-index: -1;
  .bg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(20px) brightness(0.5);
    transform: scale(1.1);
  }
  .gray {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(0, 0, 0, 0) 0, rgba(0, 0, 0, 0.5) 100%),
      radial-gradient(rgba(0, 0, 0, 0) 33%, rgba(0, 0, 0, 0.3) 166%);
  }
}
.center {
  display: flex;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  color: #ffffffa0;
}
</style>
