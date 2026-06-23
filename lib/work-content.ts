import { blocksToMarkdown } from "@/lib/work-sections";

/* ------------------------------------------------------------------ *
 * Work 詳細コンテンツの共有データ整形ヘルパ
 * （公開ページ / admin プレビューで共用）
 * ------------------------------------------------------------------ */

/** セクション＝見出し＋本文 markdown。旧ブロック形式 {blocks} は markdown へ変換して互換維持 */
export type ContentSection = { heading: string; md: string };

/**
 * works.sections（Json）を {heading, md} の配列へ正規化する。
 * 旧ブロック形式の畳み込みは sectionsToMarkdown と同一の blocksToMarkdown を共有し、
 * 公開ページと admin エディタで同じ JSON が同じ markdown になることを保証する。
 */
export function normalizeSections(raw: unknown): ContentSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item): ContentSection => {
    const obj = (item ?? {}) as Record<string, unknown>;
    const heading = typeof obj.heading === "string" ? obj.heading : "";
    if (Array.isArray(obj.blocks)) {
      return { heading, md: blocksToMarkdown(obj.blocks) };
    }
    return { heading, md: typeof obj.body === "string" ? obj.body : "" };
  });
}

/** works.hero_screenshots（Json）を URL 文字列配列へ整形する */
export function parseScreenshots(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((u): u is string => typeof u === "string" && u.length > 0);
}
