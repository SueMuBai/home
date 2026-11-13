<template>
  <div class="auto-login">
    <p>在白名单网络下登录主页后，点击网站卡片即可使用这里的配置。已保存的密码不会显示；编辑时密码留空表示保留。</p>
    <p>选择服务对应的登录方式。JSON 和 MetAPI 登录需在目标站网关接入交接入口；验证码或双因素验证仍须在原页面完成。</p>
    <el-button type="primary" @click="edit()">添加服务</el-button>
    <el-card v-for="item in items" :key="item.id" class="entry">
      <strong>{{ item.name }}</strong><span>{{ item.enabled ? '已启用' : '已停用' }}</span>
      <p>{{ item.targetUrl }}</p>
      <el-button @click="edit(item)">编辑</el-button>
      <el-button type="danger" plain @click="remove(item)">删除</el-button>
    </el-card>
    <el-dialog v-model="show" class="auto-login-dialog" :title="draft.id ? '编辑自动登录' : '添加自动登录'" width="min(620px, 94vw)" top="5vh" append-to-body destroy-on-close @closed="draft.password = ''; extra = '{}'">
      <el-form id="auto-login-form" label-position="top" @submit.prevent="save">
        <el-form-item label="服务名称"><el-input v-model="draft.name" maxlength="30" /></el-form-item>
        <el-form-item label="登录方式"><el-select v-model="draft.adapter" @change="adapterChanged"><el-option v-for="option in adapters" :key="option.value" :label="option.label" :value="option.value" /></el-select></el-form-item>
        <el-form-item v-if="['metapi','sub2api','cpa','new-api'].includes(draft.adapter)" label="远端 Nginx 中转"><el-switch v-model="draft.remote" active-text="目标服务部署在其他服务器" /></el-form-item>
        <p v-if="draft.remote">远端 Nginx 的 /.home-login 需代理 https://subaimu.com/_home_login/client；无需在 Nginx 填写账号或密码。</p>
        <p v-if="draft.adapter === 'metapi'">MetAPI 使用管理员 Token，请填在密码栏；用户名留空，接口为 /api/settings/auth/info。Token 仅在本次后台页面内存中使用，刷新后请重新从主页进入。远端 Nginx 需按部署说明接入 /.home-login。</p>
        <p v-if="draft.adapter === 'sub2api'">Sub2API 使用邮箱密码，用户名字段填 email，登录接口为 /api/v1/auth/login。登录状态仅保存在当前页面内存，刷新后请重新从主页进入；验证码或双因素仍需在原站完成。</p>
        <el-form-item label="对应的网站链接"><el-input v-model="draft.targetUrl" placeholder="https://example.com/dashboard" /></el-form-item>
        <el-form-item label="登录接口地址"><el-input v-model="draft.loginUrl" placeholder="https://example.com/login" /></el-form-item>
        <el-form-item label="用户名字段（仅密码登录可留空）"><el-input v-model="draft.usernameField" placeholder="例如 username" /></el-form-item>
        <el-form-item label="用户名"><el-input v-model="draft.username" autocomplete="off" /></el-form-item>
        <el-form-item label="密码字段"><el-input v-model="draft.passwordField" placeholder="例如 password" /></el-form-item>
        <el-form-item :label="draft.id ? '新密码（留空保留）' : '密码'"><el-input v-model="draft.password" type="password" show-password autocomplete="new-password" /></el-form-item>
        <el-form-item label="附加表单字段（JSON，新建或修改密码时保存）"><el-input v-model="extra" type="textarea" :rows="3" placeholder='例如 {"remember": "true"}' /></el-form-item>
        <el-form-item><el-switch v-model="draft.enabled" active-text="启用自动登录" /></el-form-item>
        <p>对应的网站链接须与「网站列表」的网址一致。修改登录地址或字段时，请重新填写密码和附加参数。</p>
      </el-form>
      <template #footer>
        <el-button @click="show = false">取消</el-button>
        <el-button type="primary" native-type="submit" form="auto-login-form" :loading="busy">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { adminApi } from "./api";

const items = ref([]), show = ref(false), draft = ref({}), extra = ref("{}"), busy = ref(false);
const adapters = [{value:'form',label:'普通 POST 表单'}, {value:'basic',label:'HTTP Basic 认证'}, {value:'json',label:'JSON + 会话 Cookie'}, ...['3x-ui','komari','astrbot','napcat','new-api','miaomiaowu','vm2api','memoirs','cpa','metapi','sub2api'].map(value=>({value,label:({'miaomiaowu':'妙妙屋','memoirs':'光阴叙','cpa':'CPA Plus（密钥只在页面内存）','metapi':'MetAPI（管理员 Token）','sub2api':'Sub2API（邮箱密码）'})[value]||value}))];
const load = async () => { items.value = await adminApi.listLogins(); };
const edit = (entry = {}) => {
  draft.value = { name: "", targetUrl: "", loginUrl: "", username: "", usernameField: "", passwordField: "password", adapter: "form", enabled: true, ...entry, remote: entry.remote ?? ['metapi','sub2api'].includes(entry.adapter), password: "" };
  extra.value = "{}"; show.value = true;
};
const adapterChanged = adapter => { draft.value.remote = ['metapi','sub2api'].includes(adapter); };
const save = async () => {
  busy.value = true;
  try {
    let fields;
    try { fields = JSON.parse(extra.value); } catch { throw new Error("附加参数必须是有效的 JSON 对象"); }
    await adminApi.saveLogin({ ...draft.value, extraFields: fields });
    draft.value.password = ""; show.value = false;
    ElMessage.success("已保存，刷新主页后生效"); await load();
  } catch (error) { ElMessage.error(error.message); }
  finally { busy.value = false; }
};
const remove = async (entry) => {
  try { await ElMessageBox.confirm(`删除 ${entry.name} 的自动登录配置？`, "确认删除"); }
  catch { return; }
  try { await adminApi.deleteLogin(entry.id); await load(); } catch (error) { ElMessage.error(error.message); }
};
onMounted(() => load().catch(error => ElMessage.error(error.message)));
</script>

<style scoped>
.auto-login { max-width: 760px; }
p { color: #aeb7c4; line-height: 1.8; overflow-wrap: anywhere; }
.entry { margin-top: 14px; background: #ffffff09; border-color: #ffffff15; }
.entry span { margin-left: 16px; color: #9ca3af; }
:global(.auto-login-dialog) { display: flex; flex-direction: column; max-height: 90dvh; margin-bottom: 5vh; --el-dialog-bg-color: #17221f; border: 1px solid #ffffff18; border-radius: 12px; box-shadow: 0 20px 60px #00000080; }
:global(.auto-login-dialog .el-dialog__body) { min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
:global(.auto-login-dialog .el-dialog__header), :global(.auto-login-dialog .el-dialog__footer) { flex-shrink: 0; }
</style>
