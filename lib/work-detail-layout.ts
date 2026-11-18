export type WorkDetailLayout = "v1" | "v2";

// 作品詳細ページのレイアウト切替。
// 旧版へ戻すときはこの 1 行を "v1" にする / 新版の公開は "v2".
export const WORK_DETAIL_LAYOUT: WorkDetailLayout = "v1";

export function parseLayoutParam(v: string | null | undefined): WorkDetailLayout | null {
  return v === "v1" || v === "v2" ? v : null;
}

/**
 * 【確認用の補助】?layout=v1|v2 を付けたレイアウトをブラウザのタブの間だけ覚え、リンクで移動しても同じ見た目で見られるようにする。
 * 公開の既定は上の定数 WORK_DETAIL_LAYOUT のまま（保存が無ければ何も変わらない）。切り戻しは ?layout=v1 を付ける。
 * sessionStorage が使えない環境（プライベートモード等）では何もしない。
 */
const LAYOUT_STORAGE_KEY = "work-detail-layout";

export function readStoredLayout(): WorkDetailLayout | null {
  try {
    return parseLayoutParam(window.sessionStorage.getItem(LAYOUT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function storeLayout(layout: WorkDetailLayout): void {
  try {
    window.sessionStorage.setItem(LAYOUT_STORAGE_KEY, layout);
  } catch {
    // 保存できなくても表示には影響しない
  }
}
