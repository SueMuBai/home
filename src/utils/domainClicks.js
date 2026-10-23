import { onBeforeUnmount } from "vue";
import { mainStore } from "@/store";

export const useDomainClicks = (singleClick) => {
  const store = mainStore();
  let count = 0;
  let timer;
  onBeforeUnmount(() => clearTimeout(timer));
  return () => {
    clearTimeout(timer);
    count += 1;
    if (count === 3) {
      count = 0;
      store.adminEntryShow = !store.adminEntryShow;
      return;
    }
    timer = setTimeout(() => {
      if (count === 1) singleClick?.();
      count = 0;
    }, 500);
  };
};
