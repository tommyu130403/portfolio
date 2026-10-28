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

/** サムネイル未登録の作品に出す既定画像（一覧カード・前後ナビ共通） */
export const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80";

/** 構成サムネイル（works.thumbnail）のレイアウト種別 */
export const THUMBNAIL_LAYOUTS = ["a1", "a2", "a3", "d"] as const;
export type ThumbnailLayout = (typeof THUMBNAIL_LAYOUTS)[number];

/** 構成サムネイルの整形済みデータ。空き枠は mobile_urls / capture_urls の "" で位置を保つ */
export type WorkThumbnailData = {
  layout: ThumbnailLayout;
  logo_url: string | null;
  desktop_url: string | null;
  mobile_urls: string[];
  capture_urls: string[];
};

/** works.thumbnail（Json）を WorkThumbnailData へ整形する。不正な値は null */
export function parseThumbnail(raw: unknown): WorkThumbnailData | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const layout = THUMBNAIL_LAYOUTS.find((l) => l === obj.layout);
  if (!layout) return null;
  const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);
  const slots = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.map((s) => (typeof s === "string" ? s : "")).slice(0, 2)
      : [];
  return {
    layout,
    logo_url: str(obj.logo_url),
    desktop_url: str(obj.desktop_url),
    mobile_urls: slots(obj.mobile_urls),
    capture_urls: slots(obj.capture_urls),
  };
}
