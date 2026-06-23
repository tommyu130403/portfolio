import { buildImageMarkdown } from "./image-layout";
import type { Json } from "@/src/types/supabase";

/**
 * works.sections(jsonb) ↔ 本文 markdown の相互変換。
 * 保存形は `[{ heading, body }]`（body = markdown）。`# 見出し` がセクション区切り。
 * 旧ブロック形式 `{ heading, blocks }` は読み込み時に markdown へ畳み込んで互換維持する。
 */

export type SectionItem = { heading: string; body: string };

/**
 * 旧ブロック形式 `blocks:[{type:image,...}|{md}|{body}]` を markdown 本文へ畳み込む共有ロジック。
 * 公開側（normalizeSections）と admin 側（sectionsToMarkdown）で同一の変換を保証するため、
 * ここを単一ソースとする（過去に blk.body 互換の有無で両者が乖離していた）。
 */
export function blocksToMarkdown(blocks: unknown[]): string {
  return blocks
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
}

/** works.sections を markdown 全文へ */
export function sectionsToMarkdown(sections: unknown): string {
  return (Array.isArray(sections) ? sections : [])
    .map((raw) => {
      const s = (raw ?? {}) as Record<string, unknown>;
      const heading = typeof s.heading === "string" ? s.heading : "";
      const body = Array.isArray(s.blocks)
        ? blocksToMarkdown(s.blocks)
        : typeof s.body === "string"
          ? s.body
          : "";
      return `# ${heading}\n\n${body}`;
    })
    .join("\n\n");
}

/** markdown 全文を `# 見出し` 区切りで sections(jsonb) 形へ */
export function markdownToSections(md: string): Json {
  const result: SectionItem[] = [];
  let heading = "";
  const bodyLines: string[] = [];
  const flush = () => {
    if (heading) result.push({ heading, body: bodyLines.join("\n").trim() });
  };
  for (const line of md.split("\n")) {
    if (line.startsWith("# ")) {
      flush();
      heading = line.slice(2).trim();
      bodyLines.length = 0;
    } else {
      bodyLines.push(line);
    }
  }
  flush();
  return result as unknown as Json;
}
