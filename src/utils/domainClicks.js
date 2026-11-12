import { onBeforeUnmount, watch } from "vue";
import { mainStore } from "@/store";
import { siteConfig } from "@/config";

export const useDomainClicks = (singleClick) => {
  const store = mainStore();
  let count = 0;
  let timer;
  const reset = () => { clearTimeout(timer); count = 0; };
  watch(() => store.adminLoginOpen, reset, { flush: "sync" });
  onBeforeUnmount(reset);
  return () => {
    if (store.adminLoginOpen) return;
    clearTimeout(timer);
    count += 1;
    if (count === 3) {
      count = 0;
      if (siteConfig.adminPath && !siteConfig.isAdmin) store.adminLoginOpen = true;
      return;
    }
    timer = setTimeout(() => {
      if (count === 1) singleClick?.();
      count = 0;
    }, 500);
  };
};
