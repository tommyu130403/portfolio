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

type RawSection = { heading: string; bodyLines: string[]; line: number };

/**
 * markdown 全文を `# 見出し` 行で区切る（共通ロジック）。line は見出し行の行番号。
 * 先頭に見出しの無い本文があれば heading="" のセクションになり、line はその最初の空でない行。
 */
function splitSections(md: string): RawSection[] {
  const result: RawSection[] = [];
  let cur: RawSection = { heading: "", bodyLines: [], line: 0 };
  let firstBodySet = false;
  md.split("\n").forEach((line, i) => {
    if (line.startsWith("# ")) {
      result.push(cur);
      cur = { heading: line.slice(2).trim(), bodyLines: [], line: i };
      firstBodySet = true;
    } else {
      if (!firstBodySet && line.trim()) {
        cur.line = i;
        firstBodySet = true;
      }
      cur.bodyLines.push(line);
    }
  });
  result.push(cur);
  return result;
}

/** markdown 全文を `# 見出し` 区切りで sections(jsonb) 形へ（見出しも本文も空のものは落とす） */
export function markdownToSections(md: string): Json {
  const result: SectionItem[] = [];
  for (const s of splitSections(md)) {
    const body = s.bodyLines.join("\n").trim();
    if (s.heading || body) result.push({ heading: s.heading, body });
  }
  return result as unknown as Json;
}

/**
 * markdownToSections が残す各セクションの先頭行の行番号を、同じ並びで返す。
 * ignoreLine を渡すと、その行は「本文が空か」の判定から外す（例: 画像アップロード中の仮の行）。
 * エディタ側で「プレビューの n 番目のセクション」と「本文の行」を対応づけるために使う。
 */
export function sectionStartLines(md: string, ignoreLine?: (line: string) => boolean): number[] {
  const lines: number[] = [];
  for (const s of splitSections(md)) {
    const body = s.bodyLines.filter((l) => !ignoreLine?.(l)).join("\n").trim();
    if (s.heading || body) lines.push(s.line);
  }
  return lines;
}
