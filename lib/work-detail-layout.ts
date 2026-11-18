export type WorkDetailLayout = "v1" | "v2";

// 作品詳細ページのレイアウト切替。
// 旧版へ戻すときはこの 1 行を "v1" にする / 新版の公開は "v2".
export const WORK_DETAIL_LAYOUT: WorkDetailLayout = "v1";

export function parseLayoutParam(v: string | null | undefined): WorkDetailLayout | null {
  return v === "v1" || v === "v2" ? v : null;
}
