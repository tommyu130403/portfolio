import type { CSSProperties } from "react";

/**
 * 作品カテゴリの色 (色相 hue) まわりの純関数。
 * D案 (Claude Design「カテゴリカラー 提案」D・色面タグ): タグの形は変えず、背景と文字の色だけ変える。
 * 2026-11-06: 地がインディゴになったため、保存済みの色相 h を青緑〜ローズの 190〜352° に縮めて描く
 * (プリセット 165〜120 が 190〜350 に約 23° 刻みで並ぶ)。地の彩度は低めにして背景になじませ、
 * 文字の彩度で見分けやすくする。ミントの 165° 付近は避けて主役に残す。
 * 背景 oklch(0.28 0.05 H)・文字 oklch(0.88 0.085 H)。文字/背景は約 10:1。
 * hue が null / 未指定のときは従来の見た目 (Main/600 地に Main/base)。
 */
export const WORK_CATEGORY_PRESET_HUES = [165, 210, 255, 300, 345, 30, 75, 120] as const;

/** 0〜359 の整数ならそのまま返し、それ以外は null */
export function normalizeWorkCategoryHue(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 359) return null;
  return v;
}

/** hue が null / undefined なら undefined (= 既定の見た目)。数値なら D案の色指定 */
export function workCategoryTagStyle(hue: number | null | undefined): CSSProperties | undefined {
  if (hue === null || hue === undefined) return undefined;
  const h = workCategoryDisplayHue(hue);
  return { backgroundColor: `oklch(0.28 0.05 ${h})`, color: `oklch(0.88 0.085 ${h})` };
}

/**
 * 保存済みの色相(0〜359)を、画面に描く色相(青緑〜ローズの 190〜352°)に変える。プリセット先頭の 165 が 190 になる。
 * プリセットの並ぶ 165〜120(offset 0〜315)は 190〜350 に、その先の 121〜164 は 350〜352 に詰めて範囲外へ出さない。
 * 管理画面の色見本も、保存後のタグと同じ色に見えるようにこの値で描く。
 */
export function workCategoryDisplayHue(hue: number): number {
  const offset = (((hue - 165) % 360) + 360) % 360;
  if (offset <= 315) return Math.round(190 + (offset * 160) / 315);
  return Math.round(350 + ((offset - 315) * 2) / 44);
}

/** 既存カテゴリの色相一覧から、プリセット 8 色のうち使用数が最も少ない色を返す（同数なら並び順で先）。新規カテゴリの初期色に使う */
export function pickLeastUsedPresetHue(usedHues: (number | null | undefined)[]): number {
  const counts = new Map<number, number>(WORK_CATEGORY_PRESET_HUES.map((h) => [h, 0]));
  for (const h of usedHues) {
    if (typeof h === "number" && counts.has(h)) counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  let best: number = WORK_CATEGORY_PRESET_HUES[0];
  let bestCount = Number.POSITIVE_INFINITY;
  for (const h of WORK_CATEGORY_PRESET_HUES) {
    const c = counts.get(h) ?? 0;
    if (c < bestCount) {
      best = h;
      bestCount = c;
    }
  }
  return best;
}
