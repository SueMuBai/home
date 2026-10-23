<template>
  <div class="link-cards">
    <article v-for="(row, index) in items" :key="index" class="link-card">
      <div class="card-summary">
        <div class="card-avatar">
          <Icon v-if="kind === 'siteLinks'" size="22"><component :is="siteIcons[row.icon] || siteIcons.Link" /></Icon>
          <img v-else-if="row.icon || row.avatar" :src="row.icon || row.avatar" alt="" />
          <span v-else>{{ row.name?.slice(0, 1) || '+' }}</span>
        </div>
        <div class="summary-text"><strong>{{ row.name || '未命名链接' }}</strong><span>{{ row.link || row.url || '填写下方链接地址' }}</span></div>
      </div>
      <details class="card-editor">
        <summary>编辑链接</summary>
        <div class="card-fields">
        <label>名称<el-input v-model="row.name" placeholder="链接名称" /></label>
        <label v-if="kind === 'siteLinks'">图标<el-select v-model="row.icon" filterable><el-option v-for="name in Object.keys(siteIcons)" :key="name" :label="name" :value="name" /></el-select></label>
        <label class="wide">链接<el-input v-if="kind === 'socialLinks'" v-model="row.url" placeholder="https:// 或 mailto:" /><el-input v-else v-model="row.link" placeholder="https://" /></label>
        <template v-if="kind !== 'siteLinks'">
          <label class="wide">{{ kind === 'socialLinks' ? '图标地址' : '头像地址' }}<el-input v-if="kind === 'socialLinks'" v-model="row.icon" /><el-input v-else v-model="row.avatar" placeholder="可留空" /></label>
          <label class="wide">{{ kind === 'socialLinks' ? '提示语' : '简介' }}<el-input v-if="kind === 'socialLinks'" v-model="row.tip" /><el-input v-else v-model="row.desc" /></label>
        </template>
        </div>
      </details>
      <div class="card-operations">
        <label v-if="kind === 'siteLinks'" class="visibility"><el-switch v-model="row.hidden" aria-label="仅管理员可见" />仅管理员可见</label>
        <RowActions :index="index" :total="items.length" @move="emit('move', index, $event)" @remove="emit('remove', index)" />
      </div>
    </article>
    <div v-if="!items.length" class="empty-cards">暂无链接，点击下方按钮添加</div>
  </div>
</template>
<script setup>
import { Icon } from "@vicons/utils";
import { siteIcons } from "@/utils/siteIcons";
import RowActions from "./RowActions.vue";
defineProps({ items: { type: Array, required: true }, kind: { type: String, required: true } });
const emit = defineEmits(["move", "remove"]);
</script>
<style scoped>
.card-editor summary { margin-top: 8px; min-height: 36px; display: flex; align-items: center; color: #34d399; font-size: 12px; cursor: pointer; list-style: none; }
.card-editor summary::after { content: '⌄'; margin-left: auto; }
.card-editor[open] summary::after { content: '⌃'; }
</style>
<style scoped lang="scss">
.link-cards { display: none; }
@media (max-width: 760px) {
  .link-cards { display: grid; gap: 12px; }
  .link-card { padding: 14px; border: 1px solid #ffffff0d; border-radius: 12px; background: #ffffff06; box-shadow: 0 4px 18px #00000012; }
  .card-summary { display: flex; align-items: center; gap: 10px; }
  .card-avatar { display: grid; place-items: center; flex-shrink: 0; width: 40px; height: 40px; border-radius: 10px; background: #ffffff10; img { width: 26px; height: 26px; object-fit: contain; } }
  .summary-text { display: grid; gap: 4px; min-width: 0; strong { font-size: 14px; font-weight: 500; } span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #9ca3af; font-size: 12px; } }
  .card-fields { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; margin-top: 14px; label { display: grid; gap: 6px; color: #9ca3af; font-size: 12px; min-width: 0; } .wide { grid-column: 1 / -1; } }
  .card-operations { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px solid #ffffff0d; }
  .visibility { margin-right: auto; display: flex; align-items: center; gap: 6px; font-size: 12px; color: #9ca3af; }
  .empty-cards { text-align: center; padding: 24px; color: #9ca3af; font-size: 12px; }
}
</style>
