import { buildImageMarkdown } from "@/lib/image-layout";

/* ------------------------------------------------------------------ *
 * Work 詳細コンテンツの共有データ整形ヘルパ
 * （公開ページ / admin プレビューで共用）
 * ------------------------------------------------------------------ */

/** セクション＝見出し＋本文 markdown。旧ブロック形式 {blocks} は markdown へ変換して互換維持 */
export type ContentSection = { heading: string; md: string };

/** works.sections（Json）を {heading, md} の配列へ正規化する */
export function normalizeSections(raw: unknown): ContentSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item): ContentSection => {
    const obj = (item ?? {}) as Record<string, unknown>;
    const heading = typeof obj.heading === "string" ? obj.heading : "";
    if (Array.isArray(obj.blocks)) {
      // 旧ブロック形式: text は markdown として、image は attrs 付き画像行へ変換
      const md = (obj.blocks as unknown[])
        .map((b) => {
          const blk = (b ?? {}) as Record<string, unknown>;
          if (blk.type === "image" && typeof blk.url === "string") {
            return buildImageMarkdown(
              typeof blk.caption === "string" ? blk.caption : "",
              blk.url,
              {
                align:
                  blk.align === "left" || blk.align === "right" || blk.align === "center"
                    ? blk.align
                    : "full",
                width: blk.width == null ? "" : String(blk.width),
                scale: typeof blk.scale === "number" ? blk.scale : 1,
              }
            );
          }
          if (typeof blk.md === "string") return blk.md;
          if (typeof blk.body === "string") return blk.body;
          return "";
        })
        .filter(Boolean)
        .join("\n\n");
      return { heading, md };
    }
    return { heading, md: typeof obj.body === "string" ? obj.body : "" };
  });
}

/** works.hero_screenshots（Json）を URL 文字列配列へ整形する */
export function parseScreenshots(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((u): u is string => typeof u === "string" && u.length > 0);
}
