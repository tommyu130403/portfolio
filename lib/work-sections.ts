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

const FENCE_OPEN = /^```([^`]*)$/;
const FENCE_CLOSE = /^```\s*$/;
/** `::: html` の開き行と、ブロック共通の閉じ `:::` 行。html の中身は生 HTML なのでフェンスや見出しとして数えない */
export const HTML_BLOCK_OPEN = /^:::\s*html\s*$/;
export const BLOCK_CLOSE = /^:::\s*$/;

/**
 * 閉じ `:::` が必要な入れ子ブロックの開始行（grid / card / html / figure / beforeafter / flow / bars）。深さの数え上げに使う。
 * parseBlocks の gridOpen / cardOpen と同じ条件にそろえる（\b だと `::: card見出し` も数えてしまい、閉じが見つからず後続を飲み込む）
 */
export const NESTABLE_OPEN = /^:::\s*(?:grid|card(?:\s|$)|html\s*$|(?:figure|beforeafter|flow|bars)(?:\s|$))/;
const BLOCK_WITH_BODY_OPEN = /^:::\s*(?:grid|card(?:\s|$)|figure(?:\s|$))/;

export type LeafKind = "beforeafter" | "flow" | "bars";

/** 各図版ブロックが自分の中身として認める行（空行は常に可） */
const LEAF_LINE: Record<LeafKind, RegExp> = {
  flow: /^\s*[-*+]\s+/,
  bars: /^(?:\s*[-*+]\s+|\s*legend\s*[:：])/i,
  beforeafter: /^\s*(?:before|after|note)\s*[:：]/i,
};

/**
 * 図版ブロック（beforeafter / flow / bars）の開き行の次（start）から、中身の行を集める。
 * 自分の行の形でも空行でも `:::` でもない行が来たらそこで終わる（閉じ忘れで後続の本文を飲み込まない）。
 * 止まった行が `:::` ならそれを閉じとして消費し、そうでなければその行は通常のパースに残す。next は次に読む行
 */
export function takeLeafBlock(lines: string[], start: number, kind: LeafKind): { body: string[]; next: number; closed: boolean } {
  const body: string[] = [];
  let i = start;
  while (i < lines.length) {
    const l = lines[i];
    if (BLOCK_CLOSE.test(l)) return { body, next: i + 1, closed: true };
    if (l.trim() !== "" && !LEAF_LINE[kind].test(l)) break;
    body.push(l);
    i++;
  }
  return { body, next: i, closed: false };
}

/**
 * card / grid / figure の閉じ探しで、NESTABLE_OPEN に一致した行が「閉じ `:::` を持つ入れ子」かどうか。
 * 図版ブロックは閉じ忘れだと閉じを持たないので、深さを増やさない（増やすと外側の閉じを取ってしまう）
 */
function opensNested(lines: string[], idx: number): boolean {
  const leaf = lines[idx].match(/^:::\s*(beforeafter|flow|bars)(?:\s|$)/);
  return leaf ? takeLeafBlock(lines, idx + 1, leaf[1] as LeafKind).closed : true;
}

/**
 * card / grid / figure の中身の終わり（親の閉じ `:::`）を探す。start は開き行の次の行。
 * コードブロック内と ::: html の中身は何も数えない。splits は深さ0の `---` 行（grid のセル区切り）。
 * leafNests=false のときは図版ブロックを入れ子として数えない（閉じ忘れの救済用）
 */
function scanBlockEnd(
  lines: string[],
  start: number,
  leafNests: boolean,
): { end: number; found: boolean; splits: number[] } {
  const splits: number[] = [];
  let depth = 0;
  let inFence = false;
  let inHtml = false;
  let i = start;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (inHtml) {
      if (BLOCK_CLOSE.test(l)) {
        inHtml = false;
        depth--;
      }
      continue;
    }
    if (inFence ? FENCE_CLOSE.test(l) : FENCE_OPEN.test(l)) {
      inFence = !inFence;
    } else if (inFence) {
      // コードの中身は数えない
    } else if (BLOCK_CLOSE.test(l)) {
      if (depth === 0) return { end: i, found: true, splits };
      depth--;
    } else if (NESTABLE_OPEN.test(l)) {
      const leaf = /^:::\s*(?:beforeafter|flow|bars)(?:\s|$)/.test(l);
      if (!leaf || (leafNests && opensNested(lines, i))) {
        depth++;
        inHtml = HTML_BLOCK_OPEN.test(l);
      }
    } else if (depth === 0 && /^---\s*$/.test(l)) {
      splits.push(i);
    }
  }
  return { end: i, found: false, splits };
}

/**
 * 親ブロックの終わりを探す。閉じ忘れの図版ブロックが親の閉じを取ってしまい親が閉じなかったときだけ、
 * 図版ブロックを入れ子として数えずにもう一度探す（正しく書かれた本文は1回目の結果のまま）。
 * 見つからなければ end = 末尾（lines.length）、found = false
 */
export function findBlockEnd(lines: string[], start: number): { end: number; found: boolean; splits: number[] } {
  const first = scanBlockEnd(lines, start, true);
  return first.found ? first : scanBlockEnd(lines, start, false);
}

/**
 * lines[idx] が card / grid / figure の開き行で、対応する閉じ `:::` が本文中にあれば、その行番号を返す（無ければ -1）。
 * セクション分割で「閉じたブロックの中の `# ` は見出しにしない」ための判定に使う
 */
export function closedBlockEnd(lines: string[], idx: number): number {
  if (!BLOCK_WITH_BODY_OPEN.test(lines[idx])) return -1;
  const r = findBlockEnd(lines, idx + 1);
  return r.found ? r.end : -1;
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
  let inFence = false;
  let inHtml = false;
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // ::: html の中身はフェンス・見出しとして扱わず、そのまま本文行にする
    if (inHtml || (!inFence && HTML_BLOCK_OPEN.test(line))) {
      if (inHtml && BLOCK_CLOSE.test(line)) inHtml = false;
      else inHtml = true;
      if (!firstBodySet && line.trim()) {
        cur.line = i;
        firstBodySet = true;
      }
      cur.bodyLines.push(line);
      continue;
    }
    // 閉じのある card / grid / figure は、中の `# ` を見出しにせず丸ごと本文行にする
    const blockEnd = inFence ? -1 : closedBlockEnd(lines, i);
    if (blockEnd !== -1) {
      if (!firstBodySet) {
        cur.line = i;
        firstBodySet = true;
      }
      cur.bodyLines.push(...lines.slice(i, blockEnd + 1));
      i = blockEnd;
      continue;
    }
    // コードブロック内の `# コメント` でセクションを割らない
    if (inFence ? FENCE_CLOSE.test(line) : FENCE_OPEN.test(line)) inFence = !inFence;
    if (!inFence && line.startsWith("# ")) {
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
  }
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
