<template>
  <div class="dashboard">
    <header class="header glass">
      <a class="brand" href="/" target="_blank">
        <span class="bg">{{ domain[0] }}</span>
        <span v-if="domain[1]" class="sm">.{{ domain[1] }}</span>
      </a>
      <span class="title">后台管理</span>
      <div class="header-actions">
        <el-button text tag="a" href="/" target="_blank">查看主页</el-button>
        <el-button text @click="logout">退出登录</el-button>
      </div>
      <el-button class="mobile-menu" text aria-label="打开操作菜单" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">☰</el-button>
      <div v-if="menuOpen" class="mobile-menu-panel glass">
        <a href="/" target="_blank">查看主页 ↗</a>
        <button @click="logout">退出登录</button>
      </div>
    </header>
    <nav class="sidebar glass" aria-label="后台导航">
      <button v-for="item in sections" :key="item.name" :class="{ active: tab === item.name }" @click="tab = item.name">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path :d="item.path" /></svg>
        <span>{{ item.label }}</span>
      </button>
      <div class="sidebar-note">站点控制中心<span>配置保存后，刷新主页生效</span></div>
    </nav>
    <main v-if="config" class="main glass">
      <div class="section-heading"><div><span class="eyebrow">WORKSPACE / CONFIGURATION</span><h1>{{ sections.find(item => item.name === tab)?.label }}</h1></div><span class="workspace-status"><i />本地管理中心</span></div>
      <el-tabs v-model="tab">
        <el-tab-pane label="站点信息" name="site">
          <el-form label-width="110px" class="form">
            <el-form-item label="站点名称"><el-input v-model="config.site.name" /></el-form-item>
            <el-form-item label="作者"><el-input v-model="config.site.author" /></el-form-item>
            <el-form-item label="站点地址">
              <el-input v-model="config.site.url" placeholder="example.com" />
            </el-form-item>
            <el-form-item label="关键词"><el-input v-model="config.site.keywords" /></el-form-item>
            <el-form-item label="站点简介"><el-input v-model="config.site.description" /></el-form-item>
            <el-form-item label="建站日期">
              <el-input v-model="config.site.startDate" placeholder="YYYY-MM-DD，留空则不显示" />
            </el-form-item>
            <el-form-item label="ICP 备案号">
              <el-input v-model="config.site.icp" placeholder="留空则不显示" />
            </el-form-item>
            <el-form-item label="站点图标"><el-input v-model="config.site.logo" /></el-form-item>
            <el-form-item label="主页图标"><el-input v-model="config.site.mainLogo" /></el-form-item>
            <el-form-item label="Apple 图标"><el-input v-model="config.site.appleLogo" /></el-form-item>
            <el-form-item label="源代码仓库">
              <el-input v-model="config.site.github" placeholder="留空则隐藏设置页中的 Github 按钮" />
            </el-form-item>
            <el-divider content-position="left">简介卡片</el-divider>
            <el-form-item label="标题"><el-input v-model="config.desc.hello" /></el-form-item>
            <el-form-item label="内容"><el-input v-model="config.desc.text" /></el-form-item>
            <el-form-item label="展开时标题"><el-input v-model="config.desc.helloOther" /></el-form-item>
            <el-form-item label="展开时内容"><el-input v-model="config.desc.textOther" /></el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="网站列表" name="siteLinks">
          <LinkCards :items="config.siteLinks" kind="siteLinks" @move="(index, offset) => moveRow(config.siteLinks, index, offset)" @remove="config.siteLinks.splice($event, 1)" />
          <el-table :data="config.siteLinks" class="table">
            <el-table-column label="图标" width="190">
              <template #default="{ row }">
                <el-select v-model="row.icon" filterable>
                  <el-option v-for="name in iconNames" :key="name" :label="name" :value="name">
                    <div class="icon-option">
                      <Icon size="16"><component :is="siteIcons[name]" /></Icon>
                      <span>{{ name }}</span>
                    </div>
                  </el-option>
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="名称" width="160">
              <template #default="{ row }"><el-input v-model="row.name" /></template>
            </el-table-column>
            <el-table-column label="链接">
              <template #default="{ row }"><el-input v-model="row.link" placeholder="https://" /></template>
            </el-table-column>
            <el-table-column label="隐藏" width="80" align="center">
              <template #default="{ row }">
                <el-tooltip content="开启后仅管理员登录时在主页可见" placement="top">
                  <el-switch v-model="row.hidden" />
                </el-tooltip>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="210">
              <template #default="{ $index }">
                <RowActions
                  :index="$index"
                  :total="config.siteLinks.length"
                  @move="moveRow(config.siteLinks, $index, $event)"
                  @remove="config.siteLinks.splice($index, 1)"
                />
              </template>
            </el-table-column>
          </el-table>
          <el-button
            class="add"
            @click="config.siteLinks.push({ icon: 'Link', name: '', link: '', hidden: false })"
          >
            添加网站
          </el-button>
          <p class="tip">
            开启「隐藏」的链接仅在管理员登录后显示在主页（带虚线框标记），普通访客看不到。名称为「音乐」的链接在开启「音乐链接跳转」设置时会打开播放列表。
          </p>
        </el-tab-pane>

        <el-tab-pane label="友站链接" name="friendLinks">
          <LinkCards :items="config.friendLinks" kind="friendLinks" @move="(index, offset) => moveRow(config.friendLinks, index, offset)" @remove="config.friendLinks.splice($event, 1)" />
          <el-table :data="config.friendLinks" class="table" empty-text="暂无友站">
            <el-table-column label="头像" width="70">
              <template #default="{ row }">
                <img v-if="row.avatar" :src="row.avatar" class="avatar" alt="" />
              </template>
            </el-table-column>
            <el-table-column label="名称" width="150">
              <template #default="{ row }"><el-input v-model="row.name" /></template>
            </el-table-column>
            <el-table-column label="链接" min-width="200">
              <template #default="{ row }"><el-input v-model="row.link" placeholder="https://" /></template>
            </el-table-column>
            <el-table-column label="头像地址" min-width="180">
              <template #default="{ row }">
                <el-input v-model="row.avatar" placeholder="可留空，显示名称首字" />
              </template>
            </el-table-column>
            <el-table-column label="简介" min-width="150">
              <template #default="{ row }"><el-input v-model="row.desc" placeholder="鼠标悬停时显示" /></template>
            </el-table-column>
            <el-table-column label="操作" width="210">
              <template #default="{ $index }">
                <RowActions
                  :index="$index"
                  :total="config.friendLinks.length"
                  @move="moveRow(config.friendLinks, $index, $event)"
                  @remove="config.friendLinks.splice($index, 1)"
                />
              </template>
            </el-table-column>
          </el-table>
          <el-button
            class="add"
            @click="config.friendLinks.push({ name: '', link: '', avatar: '', desc: '' })"
          >
            添加友站
          </el-button>
          <p class="tip">友站会显示在主页「网站列表」下方，没有友站时该模块不显示。</p>
        </el-tab-pane>

        <el-tab-pane label="社交链接" name="socialLinks">
          <LinkCards :items="config.socialLinks" kind="socialLinks" @move="(index, offset) => moveRow(config.socialLinks, index, offset)" @remove="config.socialLinks.splice($event, 1)" />
          <el-table :data="config.socialLinks" class="table">
            <el-table-column label="预览" width="70">
              <template #default="{ row }">
                <img v-if="row.icon" :src="row.icon" class="social-icon" alt="" />
              </template>
            </el-table-column>
            <el-table-column label="名称" width="130">
              <template #default="{ row }"><el-input v-model="row.name" /></template>
            </el-table-column>
            <el-table-column label="图标地址" width="230">
              <template #default="{ row }"><el-input v-model="row.icon" /></template>
            </el-table-column>
            <el-table-column label="提示语" width="170">
              <template #default="{ row }"><el-input v-model="row.tip" /></template>
            </el-table-column>
            <el-table-column label="链接">
              <template #default="{ row }"><el-input v-model="row.url" placeholder="https:// 或 mailto:" /></template>
            </el-table-column>
            <el-table-column label="操作" width="210">
              <template #default="{ $index }">
                <RowActions
                  :index="$index"
                  :total="config.socialLinks.length"
                  @move="moveRow(config.socialLinks, $index, $event)"
                  @remove="config.socialLinks.splice($index, 1)"
                />
              </template>
            </el-table-column>
          </el-table>
          <el-button
            class="add"
            @click="config.socialLinks.push({ name: '', icon: '/images/icon/logo.png', tip: '', url: '' })"
          >
            添加社交链接
          </el-button>
        </el-tab-pane>

        <el-tab-pane label="天气" name="weather">
          <el-form label-width="110px" class="form">
            <el-form-item label="高德 Key">
              <el-input v-model="config.weather.amapKey" placeholder="留空则使用备用天气接口" show-password />
            </el-form-item>
          </el-form>
          <p class="tip">
            前往高德开放平台创建「Web 服务」类型的 Key（不是 Web 端 JS API）。Key 会下发到访客浏览器，
            请在高德控制台为它配置域名白名单。
          </p>
        </el-tab-pane>

        <el-tab-pane label="音乐" name="music">
          <el-form label-width="110px" class="form">
            <el-form-item label="歌曲 API">
              <el-input v-model="config.music.api" placeholder="Meting API 地址，留空则关闭播放器" />
            </el-form-item>
            <el-form-item label="歌曲服务器">
              <el-select v-model="config.music.server">
                <el-option label="网易云音乐" value="netease" />
                <el-option label="QQ 音乐" value="tencent" />
              </el-select>
            </el-form-item>
            <el-form-item label="播放类型">
              <el-select v-model="config.music.type">
                <el-option label="歌曲" value="song" />
                <el-option label="播放列表" value="playlist" />
                <el-option label="专辑" value="album" />
                <el-option label="搜索" value="search" />
                <el-option label="艺术家" value="artist" />
              </el-select>
            </el-form-item>
            <el-form-item label="播放 ID">
              <el-input v-model="config.music.id" placeholder="留空则关闭播放器" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="安全" name="security">
          <Security :totp-enabled="totpEnabled" @changed="emit('refresh')" />
        </el-tab-pane>
      </el-tabs>

    </main>
    <div v-if="config && tab !== 'security'" class="actions glass">
      <el-button @click="load">放弃修改</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存配置</el-button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { Icon } from "@vicons/utils";
import { siteIcons } from "@/utils/siteIcons";
import { adminApi } from "./api";
import RowActions from "./RowActions.vue";
import Security from "./Security.vue";
import { useDomain } from "./domain";
import LinkCards from "./LinkCards.vue";

defineProps({ totpEnabled: Boolean });
const emit = defineEmits(["logout", "refresh"]);

const iconNames = Object.keys(siteIcons);
const domain = useDomain();
const tab = ref("site");
const config = ref(null);
const saving = ref(false);
const menuOpen = ref(false);
const sections = [
  { name: "site", label: "站点信息", path: "M12 16v-4m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" },
  { name: "siteLinks", label: "网站列表", path: "M2 12h20M12 2c6 5 6 15 0 20-6-5-6-15 0-20ZM22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" },
  { name: "friendLinks", label: "友站链接", path: "m10 13 4-4M8 15l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 3 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" },
  { name: "socialLinks", label: "社交链接", path: "m8 11 8-5M8 13l8 5M8 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm14-8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm0 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" },
  { name: "weather", label: "天气", path: "M7 18h10a5 5 0 0 0 0-10 6 6 0 0 0-12 1 4.5 4.5 0 0 0 2 9Z" },
  { name: "music", label: "音乐", path: "M9 18V5l12-3v13M9 8l12-3M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-3a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" },
  { name: "security", label: "安全", path: "m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Zm-4 10 3 3 5-6" },
];

const handleError = (error) => {
  if (error.status === 401) {
    ElMessage.warning("登录已过期，请重新登录");
    emit("logout");
    return;
  }
  ElMessage.error(error.message);
};

const load = async () => {
  try {
    config.value = await adminApi.getConfig();
  } catch (error) {
    handleError(error);
  }
};

const moveRow = (list, index, offset) => {
  const [item] = list.splice(index, 1);
  list.splice(index + offset, 0, item);
};

const save = async () => {
  saving.value = true;
  try {
    config.value = await adminApi.saveConfig(config.value);
    ElMessage.success("已保存，刷新主页即可生效");
  } catch (error) {
    handleError(error);
  } finally {
    saving.value = false;
  }
};

const logout = async () => {
  await adminApi.logout();
  emit("logout");
};

onMounted(load);
</script>

<style scoped lang="scss">
.dashboard { --sidebar-width: 240px; min-height: 100dvh; padding: 88px 24px 100px 288px; box-sizing: border-box; }
.header { position: fixed; inset: 0 0 auto; height: 64px; z-index: 20; display: flex; align-items: center; gap: 20px; padding: 0 28px; border-radius: 0; border-bottom: 1px solid #ffffff0d; background: #10191655; }
.brand { font-family: "Pacifico-Regular"; white-space: nowrap; .bg { font-size: 26px; } .sm { font-size: 13px; margin-left: 3px; } }
.title { font-size: 16px; font-weight: 600; padding-left: 20px; border-left: 1px solid #ffffff20; }
.header-actions { margin-left: auto; }
.mobile-menu, .mobile-menu-panel { display: none; }
.sidebar { position: fixed; top: 88px; left: 24px; bottom: 24px; width: var(--sidebar-width); padding: 12px; box-sizing: border-box; border-radius: 12px; border: 1px solid #ffffff12; box-shadow: inset 0 1px 0 #ffffff0a, 0 12px 36px #00000012; backdrop-filter: blur(20px); display: flex; flex-direction: column; gap: 6px;
  > button { display: flex; align-items: center; gap: 12px; height: 46px; flex-shrink: 0; padding: 0 16px; border: 0; border-radius: 8px; background: transparent; color: #ffffff99; font: inherit; font-size: 14px; cursor: pointer; text-align: left; transition: background .2s,color .2s; svg { width: 20px; height: 20px; } &:hover { background: #ffffff08; color: #fff; } &.active { color: #fff; background: linear-gradient(110deg,#34d399aa,#059669cc); box-shadow: 0 4px 18px #05966920; } }
}
.sidebar-note { margin: auto 12px 12px; padding-top: 24px; color: #ffffff80; font-size: 12px; span { display: block; margin-top: 8px; font-size: 11px; color: #ffffff50; } }
.main { min-width: 0; min-height: calc(100dvh - 188px); padding: 24px; border-radius: 18px; border: 1px solid #ffffff0d; background: #07120f66; box-shadow: 0 12px 48px #00000012; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; h1 { margin: 6px 0 0; font-size: 20px; font-weight: 600; } }
.eyebrow { color: #ffffff50; font-size: 10px; letter-spacing: 1.5px; }
.workspace-status { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #9ca3af; i { width: 6px; height: 6px; border-radius: 50%; background: #34d399; box-shadow: 0 0 10px #34d39960; } }
:deep(.el-tabs__header) { display: none; }
.form { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); column-gap: 24px; max-width: 1100px; :deep(.el-form-item) { display: flex; flex-direction: column; align-items: stretch; margin-bottom: 20px; min-width: 0; } :deep(.el-form-item__label) { width: auto !important; height: auto; line-height: 20px; padding: 0 0 8px; justify-content: flex-start; font-size: 13px; color: #9ca3af; } :deep(.el-form-item__content) { margin-left: 0 !important; } :deep(.el-divider) { grid-column: 1 / -1; margin: 12px 0 24px; } }
:deep(.el-table .el-table__row) { height: 56px; }
:deep(.el-table .cell) { font-size: 14px; }
.table { width: 100%; }
.add { margin-top: 20px; }
.tip { color: #9ca3af; font-size: 12px; line-height: 1.8; margin: 14px 0 0; }
.icon-option { display: flex; align-items: center; gap: 8px; }
.social-icon { width: 24px; height: 24px; object-fit: contain; }
.avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
.actions { position: fixed; z-index: 15; bottom: 0; right: 0; left: 288px; display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-radius: 16px 0 0; border-top: 1px solid #ffffff0d; background: #111c19bb; backdrop-filter: blur(20px); .el-button { height: 40px; padding: 0 24px; margin: 0; } }
@media (max-width: 1100px) and (min-width: 761px) { .dashboard { --sidebar-width: 200px; padding-left: 240px; } .sidebar { left: 16px; } .actions { left: 240px; } .main { padding: 20px; } }
@media (max-width: 760px) {
  .dashboard { padding: 128px 16px 104px; }
  .header { height: 64px; padding: 0 16px; gap: 12px; .brand .bg { font-size: 23px; } .title { font-size: 14px; padding-left: 12px; } }
  .header-actions { display: none; }
  .mobile-menu { display: inline-flex; margin-left: auto; font-size: 22px; min-width: 40px; height: 40px; }
  .mobile-menu-panel { position: absolute; top: 58px; right: 16px; display: grid; padding: 8px; min-width: 140px; background: #18251fee; border: 1px solid #ffffff12; a, button { padding: 12px; color: #fff; font: inherit; font-size: 14px; border: 0; background: transparent; text-align: left; cursor: pointer; } }
  .sidebar { top: 64px; left: 0; right: 0; bottom: auto; width: 100%; height: 52px; padding: 0 16px; flex-direction: row; align-items: center; gap: 22px; overflow-x: auto; border: 0; border-bottom: 1px solid #ffffff0d; border-radius: 0; background: #101916aa; z-index: 18; scrollbar-width: none; > button { height: 52px; border-radius: 0; padding: 0; gap: 0; white-space: nowrap; font-size: 14px; svg { display: none; } &.active { background: transparent; box-shadow: inset 0 -2px #34d399; color: #34d399; } } }
  .sidebar-note { display: none; }
  .main { padding: 16px; border-radius: 16px; min-height: calc(100dvh - 250px); }
  .section-heading { margin-bottom: 20px; h1 { font-size: 16px; } }
  .workspace-status, .eyebrow { display: none; }
  .form { grid-template-columns: minmax(0,1fr); gap: 0; :deep(.el-form-item) { margin-bottom: 18px; } }
  .table { display: none; }
  .actions { left: 0; border-radius: 0; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); .el-button { flex: 1; height: 44px; padding: 0 12px; } }
  .add { min-height: 40px; }
}
</style>
