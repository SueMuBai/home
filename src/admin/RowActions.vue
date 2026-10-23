<template>
  <div class="row-actions">
    <el-button :disabled="index === 0" aria-label="上移" title="上移" @click="emit('move', -1)"><span aria-hidden="true">↑</span></el-button>
    <el-button :disabled="index === total - 1" aria-label="下移" title="下移" @click="emit('move', 1)"><span aria-hidden="true">↓</span></el-button>
    <el-button type="danger" plain aria-label="删除" title="删除" @click="emit('remove')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" /></svg>
    </el-button>
  </div>
</template>
<script setup>
defineProps({ index: { type: Number, required: true }, total: { type: Number, required: true } });
const emit = defineEmits(["move", "remove"]);
</script>
<style scoped>
.row-actions { display: flex; gap: 6px; }
.row-actions .el-button { width: 36px; height: 36px; padding: 0; margin: 0; font-size: 18px; }
@media (max-width: 760px) { .row-actions .el-button { width: 40px; height: 40px; } }
</style>
