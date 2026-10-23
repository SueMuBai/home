<template>
  <div class="login">
    <div class="box glass">
      <div class="brand">
        <span class="bg">{{ domain[0] }}</span>
        <span v-if="domain[1]" class="sm">.{{ domain[1] }}</span>
      </div>
      <p class="subtitle">{{ needCode ? "请输入身份验证器中的 6 位验证码" : "管理员登录" }}</p>
      <el-form @submit.prevent="submit">
        <el-form-item v-if="!needCode">
          <el-input
            v-model="password"
            type="password"
            size="large"
            placeholder="管理员密码"
            show-password
            autocomplete="current-password"
            autofocus
          />
        </el-form-item>
        <el-form-item v-else>
          <el-input
            ref="codeInput"
            v-model="code"
            size="large"
            placeholder="验证码"
            maxlength="6"
            inputmode="numeric"
            autocomplete="one-time-code"
          />
        </el-form-item>
        <p v-if="error" class="error">{{ error }}</p>
        <el-button class="submit" type="primary" size="large" native-type="submit" :loading="loading">
          {{ needCode ? "验证" : "登录" }}
        </el-button>
        <el-button v-if="needCode" class="back" text @click="reset">返回</el-button>
      </el-form>
      <a class="home" href="/">← 返回主页</a>
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref } from "vue";
import { adminApi } from "./api";
import { useDomain } from "./domain";

const emit = defineEmits(["success"]);
const domain = useDomain();
const password = ref("");
const code = ref("");
const needCode = ref(false);
const loading = ref(false);
const error = ref("");
const codeInput = ref(null);

const reset = () => {
  needCode.value = false;
  code.value = "";
  error.value = "";
};

const submit = async () => {
  if (!password.value) return;
  loading.value = true;
  error.value = "";
  try {
    const result = await adminApi.login(password.value, needCode.value ? code.value : undefined);
    if (result.requireTotp) {
      needCode.value = true;
      await nextTick();
      codeInput.value?.focus();
      return;
    }
    password.value = "";
    emit("success");
  } catch (e) {
    error.value = e.message;
    if (needCode.value) code.value = "";
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped lang="scss">
.login {
  display: flex;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  box-sizing: border-box;
}
.box {
  width: 360px;
  padding: 32px 28px 24px;
  animation: fade 0.5s;
}
.brand {
  text-align: center;
  font-family: "Pacifico-Regular";
  .bg {
    font-size: 3rem;
  }
  .sm {
    margin-left: 4px;
    font-size: 1.4rem;
  }
}
.subtitle {
  margin: 4px 0 24px;
  text-align: center;
  color: #ffffffa0;
  font-size: 0.95rem;
}
.error {
  margin: -6px 0 14px;
  color: #ff8a8a;
  font-size: 0.9rem;
}
.submit,
.back {
  width: 100%;
  margin: 0;
}
.back {
  margin-top: 8px;
}
.home {
  display: block;
  margin-top: 20px;
  text-align: center;
  font-size: 0.85rem;
  color: #ffffff90;
  &:hover {
    color: #fff;
  }
}
@keyframes fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
