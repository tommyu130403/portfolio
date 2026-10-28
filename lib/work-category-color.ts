import type { CSSProperties } from "react";

/**
 * 作品カテゴリの色 (色相 hue) まわりの純関数。
 * D案 (Claude Design「カテゴリカラー 提案」D・色面タグ): タグの形は変えず、背景 oklch(0.30 0.06 h)・文字 oklch(0.88 0.09 h) だけ変える。
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
  return { backgroundColor: `oklch(0.30 0.06 ${hue})`, color: `oklch(0.88 0.09 ${hue})` };
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
