import { useSyncExternalStore } from "react";

/** 下部シートに切り替える幅(727px 以下)。Modal と経歴詳細で共通 */
export const SHEET_MEDIA_QUERY = "(max-width: 727px)";
/** シートをこの距離(px)より下へ引いて離すと閉じる */
export const SHEET_CLOSE_DRAG = 100;

export function useMediaQuery(query: string) {
  // useSyncExternalStore で matchMedia を購読（SSR は false を返す）。
  // effect 内同期 setState を避けつつ、ハイドレーション後に正しい値へ同期する。
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
