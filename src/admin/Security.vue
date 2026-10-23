<template>
  <div class="security">
    <el-card header="修改密码">
      <el-form label-width="90px" @submit.prevent="changePassword">
        <el-form-item label="当前密码">
          <el-input v-model="password.current" type="password" show-password autocomplete="current-password" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input
            v-model="password.next"
            type="password"
            show-password
            placeholder="至少 8 位"
            autocomplete="new-password"
          />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="password.confirm" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" native-type="submit" :loading="busy">修改密码</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card header="两步验证 (2FA)">
      <template v-if="totpEnabled">
        <el-alert title="两步验证已开启，登录时需要输入身份验证器中的验证码" type="success" :closable="false" />
        <el-form label-width="90px" class="disable" @submit.prevent="disableTotp">
          <el-form-item label="当前密码">
            <el-input v-model="disable.password" type="password" show-password />
          </el-form-item>
          <el-form-item label="验证码">
            <el-input v-model="disable.code" maxlength="6" inputmode="numeric" autocomplete="one-time-code" />
          </el-form-item>
          <el-form-item>
            <el-button type="danger" native-type="submit" :loading="busy">关闭两步验证</el-button>
          </el-form-item>
        </el-form>
      </template>
      <template v-else-if="setup">
        <p>1. 使用 Google Authenticator、Microsoft Authenticator 等应用扫描二维码：</p>
        <img :src="setup.qrcode" class="qrcode" alt="2FA 二维码" />
        <p class="secret">无法扫码时手动输入密钥：<code>{{ setup.secret }}</code></p>
        <p>2. 输入应用中显示的 6 位验证码完成绑定：</p>
        <el-form inline @submit.prevent="enableTotp">
          <el-form-item>
            <el-input v-model="enableCode" maxlength="6" inputmode="numeric" placeholder="验证码" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" native-type="submit" :loading="busy">确认开启</el-button>
            <el-button @click="setup = null">取消</el-button>
          </el-form-item>
        </el-form>
      </template>
      <template v-else>
        <p class="desc">开启后，登录除密码外还需要输入身份验证器生成的动态验证码。</p>
        <el-button type="primary" :loading="busy" @click="startSetup">开启两步验证</el-button>
      </template>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { adminApi } from "./api";

defineProps({ totpEnabled: Boolean });
const emit = defineEmits(["changed"]);

const busy = ref(false);
const password = reactive({ current: "", next: "", confirm: "" });
const setup = ref(null);
const enableCode = ref("");
const disable = reactive({ password: "", code: "" });

const run = async (action) => {
  busy.value = true;
  try {
    await action();
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    busy.value = false;
  }
};

const changePassword = () => {
  if (password.next !== password.confirm) return ElMessage.error("两次输入的新密码不一致");
  return run(async () => {
    await adminApi.changePassword(password.current, password.next);
    Object.assign(password, { current: "", next: "", confirm: "" });
    ElMessage.success("密码已修改，其他设备上的登录已失效");
  });
};

const startSetup = () =>
  run(async () => {
    setup.value = await adminApi.setupTotp();
    enableCode.value = "";
  });

const enableTotp = () =>
  run(async () => {
    await adminApi.enableTotp(enableCode.value);
    setup.value = null;
    ElMessage.success("两步验证已开启");
    emit("changed");
  });

const disableTotp = () =>
  run(async () => {
    await adminApi.disableTotp(disable.password, disable.code);
    Object.assign(disable, { password: "", code: "" });
    ElMessage.success("两步验证已关闭");
    emit("changed");
  });
</script>

<style scoped>
.security {
  display: grid;
  gap: 20px;
  max-width: 640px;
}
.security :deep(.el-card) {
  --el-card-bg-color: #ffffff0d;
  border: 1px solid #ffffff18;
}
.security :deep(.el-card__header) {
  background-color: #ffffff14;
  border-bottom-color: #ffffff18;
  font-weight: 500;
}
.qrcode {
  border-radius: 6px;
  background: #fff;
  padding: 6px;
}
.qrcode {
  display: block;
  width: 220px;
  height: 220px;
  margin: 8px 0;
}
.secret code {
  word-break: break-all;
  background: #00000040;
  padding: 2px 6px;
  border-radius: 4px;
}
.desc {
  color: #ffffffa0;
}
.disable {
  margin-top: 16px;
}
</style>
