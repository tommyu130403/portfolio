import type { CSSProperties, FC, ReactNode } from "react";
import React, { useMemo } from "react";
import Headline from "./Headline";
import {
  parseImageAttrs,
  widthToCss,
  type ImageAlign,
} from "@/lib/image-layout";
import FlowchartEmbed, { FlowchartFigureContext } from "./FlowchartEmbed";
import WorkCardEmbed from "./WorkCardEmbed";
import InfoCard from "./InfoCard";
import { TableGrid, TableKeyValue } from "./Table";
import ProtectedImage from "./ProtectedImage";

/**
 * Work 詳細・本文 markdown の共有レンダラ（公開モーダル / admin プレビュー共用）。
 *
 * タイポ体系（Figma 457:2366）:
 *  - `## `   → 見出し01（横線＋Noto Bold 16px mint #B3FFE7・Library Headline type=02 304:302）
 *  - `### `  → 見出し02（01 と同形）
 *  - `#### ` → 見出し03（Avenir Heavy 17px gray #9e9e9e）
 *  - `##### `→ 小本文 Body02（13px white）
 *  - `> `    → 引用（13px system-400 #BDBDBD・左ボーダー、連続行対応）
 *  - 段落・リスト → 直前の見出しに応じて本文サイズを切替
 *      ・見出し01（`## `）配下 / 見出し02（`### `）配下 → Body01（15px / 0.45px）
 *      ・見出し03（`#### `）配下 → Body02（13px / 0.39px）
 * 拡張記法:
 *  - **太字** / *斜体* / ~~取消線~~ / `インラインコード` / [リンク](url)（外部はアイコン付き）
 *  - `- ` 箇条書き / `1. ` 番号リスト / `---` 区切り線 / ``` コードブロック
 *  - `::: grid cols=N gap=M` 〜 `---` 区切り 〜 `:::` の複数カラムグリッド
 *  - `::: card 見出し` 〜 `:::` の汎用カード / `::: workcard id=<uuid>` の作品リンクカード
 *  - 画像 `![caption](url){width=260 align=left scale=1.2}`（単独行は回り込みブロック。
 *    align=left は画像＋右列（直後の1段落＋キャプション）の横並び。Figma Master 994:5656）
 */

/* ------------------------------------------------------------------ *
 * インライン
 * ------------------------------------------------------------------ */

const ExternalIcon: FC = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 12 12"
    fill="none"
    className="ml-0.5 inline-block shrink-0"
    aria-hidden
  >
    <path d="M4 2h6v6M10 2 4.5 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

function renderInlineLine(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const push = (n: ReactNode) =>
    nodes.push(<React.Fragment key={`${keyBase}-${key++}`}>{n}</React.Fragment>);

  while (i < text.length) {
    const rest = text.slice(i);

    // 画像（インライン）: ![alt](url){attrs}
    const img = rest.match(/^!\[([^\]]*)\]\(([^)\s]+)\)(\{[^}]*\})?/);
    if (img) {
      const layout = parseImageAttrs(img[3]?.slice(1, -1), img[2]);
      push(
        <ProtectedImage
          src={layout.base}
          alt={img[1]}
          style={{ width: widthToCss(layout.width), maxWidth: "100%" }}
          className="my-2 inline-block rounded-r16 align-top"
        />
      );
      i += img[0].length;
      continue;
    }

    // リンク: [text](url)
    const link = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/);
    if (link) {
      const external = /^https?:\/\//i.test(link[2]);
      push(
        <a
          href={link[2]}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="text-main-100 underline decoration-main-100/50 underline-offset-4 transition-colors hover:decoration-main-100"
        >
          {link[1]}
          {external && <ExternalIcon />}
        </a>
      );
      i += link[0].length;
      continue;
    }

    // インラインコード
    const code = rest.match(/^`([^`]+)`/);
    if (code) {
      push(
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.88em] text-main-050">
          {code[1]}
        </code>
      );
      i += code[0].length;
      continue;
    }

    // 太字 / 斜体 / 取消線
    const bold = rest.match(/^\*\*([^*]+)\*\*/);
    if (bold) {
      push(<strong className="font-bold">{renderInlineLine(bold[1], `${keyBase}-b${key}`)}</strong>);
      i += bold[0].length;
      continue;
    }
    const italic = rest.match(/^\*([^*]+)\*/);
    if (italic) {
      push(<em className="italic">{renderInlineLine(italic[1], `${keyBase}-i${key}`)}</em>);
      i += italic[0].length;
      continue;
    }
    const strike = rest.match(/^~~([^~]+)~~/);
    if (strike) {
      push(<s>{renderInlineLine(strike[1], `${keyBase}-s${key}`)}</s>);
      i += strike[0].length;
      continue;
    }

    // 裸URL
    const url = rest.match(/^(https?:\/\/[^\s<]+)/);
    if (url) {
      push(
        <a
          href={url[1]}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-main-100 underline decoration-main-100/50 underline-offset-4 hover:decoration-main-100"
        >
          {url[1]}
          <ExternalIcon />
        </a>
      );
      i += url[1].length;
      continue;
    }

    // プレーンテキスト（次の特殊トークンまで）
    let next = text.length;
    for (const s of ["![", "[", "`", "**", "*", "~~", "http"]) {
      const idx = text.indexOf(s, i + 1);
      if (idx !== -1 && idx < next) next = idx;
    }
    push(text.slice(i, next));
    i = next;
  }
  return nodes;
}

/** 複数行テキストを <br> 区切りでインライン描画する */
function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  text.split("\n").forEach((line, li) => {
    if (li > 0) out.push(<br key={`${keyBase}-br${li}`} />);
    out.push(...renderInlineLine(line, `${keyBase}-l${li}`));
  });
  return out;
}

/* ------------------------------------------------------------------ *
 * 画像ブロック（単独行）
 * ------------------------------------------------------------------ */

const ImageFigure: FC<{
  url: string;
  align: ImageAlign;
  width: string;
  scale: number;
  caption?: string;
}> = ({ url, align, width, scale, caption }) => {
  const cssW = widthToCss(width);
  const figStyle: CSSProperties = {
    width: align === "full" ? "100%" : cssW ?? "50%",
    maxWidth: "100%",
    ...(align === "center" ? { marginLeft: "auto", marginRight: "auto" } : {}),
  };
  const floatClass =
    align === "left" ? "float-left mr-10 mb-2" : align === "right" ? "float-right ml-10 mb-2" : "clear-both mt-10 mb-10";

  return (
    <figure className={floatClass} style={figStyle}>
      <div className="overflow-hidden rounded-r16">
        <ProtectedImage
          src={url}
          alt={caption ?? ""}
          className="block h-auto w-full"
          style={scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: "center" } : undefined}
        />
      </div>
      {caption && (
        <figcaption
          className={`mt-2 text-[10px] leading-[12px] tracking-[0.3px] text-fg-muted ${align === "center" ? "text-center" : ""}`}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
};

/**
 * align=left の画像＋右列（本文＋キャプション）の横並びブロック（Figma Master 994:5656）。
 * 560px 未満は縦積みにする（@container クエリ）。
 */
const ImageTextRow: FC<{
  url: string;
  width: string;
  scale: number;
  caption?: string;
  text: string | null;
  keyBase: string;
}> = ({ url, width, scale, caption, text, keyBase }) => (
  <div className="@container mt-10 mb-10">
    <div className="flex flex-col items-start gap-2 @min-[560px]:flex-row @min-[560px]:gap-10">
      <div
        className="min-w-0 shrink overflow-hidden rounded-r16"
        style={{ width: widthToCss(width) ?? "200px", maxWidth: "100%" }}
      >
        <ProtectedImage
          src={url}
          alt={caption ?? ""}
          className="block h-auto w-full"
          style={scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: "center" } : undefined}
        />
      </div>
      {(text || caption) && (
        <div className="flex min-w-0 flex-col justify-center gap-2 @min-[560px]:min-w-[200px] @min-[560px]:flex-1">
          {text && (
            <p className="text-[15px] leading-[24px] tracking-[0.45px] text-white">
              {renderInline(text, `${keyBase}-t`)}
            </p>
          )}
          {caption && (
            <p className="text-[10px] leading-[12px] tracking-[0.3px] text-fg-muted">{caption}</p>
          )}
        </div>
      )}
    </div>
  </div>
);

/* ------------------------------------------------------------------ *
 * ブロックパース
 * ------------------------------------------------------------------ */

type ImageBlock = {
  type: "image";
  caption: string;
  url: string;
  align: ImageAlign;
  width: string;
  scale: number;
};

type Block =
  | { type: "h1"; content: string }
  | { type: "h2"; content: string }
  | { type: "h3"; content: string }
  | { type: "small"; content: string }
  | { type: "paragraph"; content: string }
  | { type: "quote"; content: string }
  | ImageBlock
  | { type: "imageText"; image: ImageBlock; text: string | null }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "hr" }
  | { type: "code"; lang: string; content: string }
  | { type: "flowchart"; id: string }
  | { type: "workcard"; id: string }
  | { type: "card"; title: string; body: string }
  | { type: "grid"; cols: number; gap: number; cells: string[] }
  | { type: "tableKeyValue"; rows: { label: string; value: string }[] }
  | { type: "tableGrid"; header: string[]; rows: string[][] };

/** pipe table の1行をセルに分ける（先頭末尾の | を除き、\| は文字の | として扱う） */
function splitTableRow(line: string): string[] {
  const body = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  return body.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
}

/** 区切り行（各セルがダッシュ3本以上で、両端に任意の : を付けたもの。例: |---|:--:|） */
const isTableSeparator = (line: string) => {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));
};

/**
 * 閉じ `:::` が必要な入れ子ブロックの開始行（grid / card）。深さの数え上げに使う。
 * 下の gridOpen / cardOpen と同じ条件にそろえる（\b だと `::: card見出し` も数えてしまい、閉じが見つからず後続を飲み込む）
 */
const NESTABLE_OPEN = /^:::\s*(?:grid|card(?:\s|$))/;

function parseBlocks(src: string): Block[] {
  const lines = src.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  const isBlockStart = (line: string) =>
    /^#{2,5}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^```/.test(line) ||
    /^:::\s*(grid|card|workcard|timeline|stakeholders|flowchart)\b/.test(line) ||
    /^\|/.test(line) ||
    /^(\*\*\*|---|___)\s*$/.test(line) ||
    /^!\[[^\]]*\]\([^)\s]+\)(\{[^}]*\})?\s*$/.test(line.trim());

  while (i < lines.length) {
    const line = lines[i].trimEnd();

    // 旧 ::: timeline / ::: stakeholders ディレクティブは廃止（モーダル表示へ移行）。
    // 既存本文に残る行は何も描画せず読み飛ばす（isBlockStart と同じ \b 判定で、
    // 後続テキスト付きの行もリテラル露出させない）。
    if (/^:::\s*(timeline|stakeholders)\b/.test(line)) {
      i++;
      continue;
    }

    // フローチャートは1行完結。既存の数値属性パーサはUUIDに使えないため専用正規表現で読む。
    const flowchart = line.match(
      /^:::\s*flowchart\s+id\s*=\s*([0-9a-fA-F-]{36})\s*$/,
    );
    if (flowchart) {
      blocks.push({ type: "flowchart", id: flowchart[1] });
      i++;
      continue;
    }

    // 作品リンクカードも1行完結（id は UUID 専用の正規表現で読む。不正な id は段落のまま）
    const workcard = line.match(
      /^:::\s*workcard\s+id\s*=\s*([0-9a-fA-F-]{36})\s*$/,
    );
    if (workcard) {
      blocks.push({ type: "workcard", id: workcard[1] });
      i++;
      continue;
    }

    // 汎用カード: ::: card 見出し 〜 :::（ネストした grid / card の入れ子を数えて閉じを探す）
    const cardOpen = line.match(/^:::\s*card(?:\s+(.*))?$/);
    if (cardOpen) {
      const buf: string[] = [];
      let depth = 0;
      let inFence = false; // コードブロック内の ::: / --- は数えない
      i++;
      while (i < lines.length) {
        // 開きは ``` で始まる行、閉じは ``` だけの行（code ブロック本体の判定と同じ）
        if (inFence ? /^```\s*$/.test(lines[i]) : /^```/.test(lines[i])) {
          inFence = !inFence;
        } else if (inFence) {
          // コードの中身はそのまま本文へ
        } else if (/^:::\s*$/.test(lines[i])) {
          if (depth === 0) break;
          depth--;
        } else if (NESTABLE_OPEN.test(lines[i])) {
          depth++;
        }
        buf.push(lines[i]);
        i++;
      }
      i++; // closing :::（EOF で閉じが無いときは末尾を越えるだけ）
      blocks.push({
        type: "card",
        title: (cardOpen[1] ?? "").trim(),
        body: buf.join("\n").trim(),
      });
      continue;
    }

    // グリッド: ::: grid cols=N gap=M
    const gridOpen = line.match(/^:::\s*grid\s*(.*)$/);
    if (gridOpen) {
      let cols = 2;
      let gap = 4;
      const re = /(\w+)\s*=\s*(\d+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(gridOpen[1])) !== null) {
        if (m[1] === "cols") cols = Math.max(1, parseInt(m[2], 10) || 2);
        if (m[1] === "gap") {
          const n = parseInt(m[2], 10);
          gap = Number.isNaN(n) ? 4 : n;
        }
      }
      const cells: string[] = [];
      let buf: string[] = [];
      let depth = 0;
      let inFence = false; // コードブロック内の ::: / --- は数えない
      i++;
      while (i < lines.length) {
        // 開きは ``` で始まる行、閉じは ``` だけの行（code ブロック本体の判定と同じ）
        if (inFence ? /^```\s*$/.test(lines[i]) : /^```/.test(lines[i])) {
          inFence = !inFence;
          buf.push(lines[i]);
        } else if (inFence) {
          buf.push(lines[i]);
        } else if (/^:::\s*$/.test(lines[i])) {
          if (depth === 0) break;
          depth--;
          buf.push(lines[i]);
        } else if (NESTABLE_OPEN.test(lines[i])) {
          depth++;
          buf.push(lines[i]);
        } else if (depth === 0 && /^---\s*$/.test(lines[i])) {
          cells.push(buf.join("\n").trim());
          buf = [];
        } else {
          buf.push(lines[i]);
        }
        i++;
      }
      if (buf.length) cells.push(buf.join("\n").trim());
      i++; // closing :::
      blocks.push({ type: "grid", cols, gap, cells: cells.filter(Boolean) });
      continue;
    }

    // 表: 行頭が | の連続行。区切り行あり=グリッド / 区切り行なしで全行2セル=項目-値 / それ以外は段落
    if (/^\|/.test(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        tableLines.push(lines[i].trimEnd());
        i++;
      }
      if (tableLines.length >= 2 && isTableSeparator(tableLines[1])) {
        const header = splitTableRow(tableLines[0]);
        const rows = tableLines.slice(2).map((l) => {
          const cells = splitTableRow(l).slice(0, header.length);
          while (cells.length < header.length) cells.push("");
          return cells;
        });
        blocks.push({ type: "tableGrid", header, rows });
      } else {
        const rows = tableLines.map(splitTableRow);
        if (!tableLines.some(isTableSeparator) && rows.every((r) => r.length === 2)) {
          blocks.push({ type: "tableKeyValue", rows: rows.map(([label, value]) => ({ label, value })) });
        } else {
          blocks.push({ type: "paragraph", content: tableLines.join("\n") });
        }
      }
      continue;
    }

    // コードブロック
    const codeOpen = line.match(/^```(\w*)\s*$/);
    if (codeOpen) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: "code", lang: codeOpen[1], content: buf.join("\n") });
      continue;
    }

    // 画像（単独行）
    const imgOnly = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)(\{[^}]*\})?$/);
    if (imgOnly) {
      const layout = parseImageAttrs(imgOnly[3]?.slice(1, -1), imgOnly[2]);
      blocks.push({
        type: "image",
        caption: imgOnly[1],
        url: layout.base,
        align: layout.align,
        width: layout.width,
        scale: layout.scale,
      });
      i++;
      continue;
    }

    // 見出し（## / ### / #### / #####）。# はセクション分割記号のため本文では段落扱い
    const h = line.match(/^(#{2,5})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      blocks.push(
        level === 2
          ? { type: "h1", content: h[2] }
          : level === 3
            ? { type: "h2", content: h[2] }
            : level === 4
              ? { type: "h3", content: h[2] }
              : { type: "small", content: h[2] }
      );
      i++;
      continue;
    }

    // 区切り線
    if (/^(\*\*\*|---|___)\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // 引用（連続行をまとめる）
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", content: buf.join("\n") });
      continue;
    }

    // リスト
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // 空行
    if (line.trim() === "") {
      i++;
      continue;
    }

    // 段落（# は本文テキストとして扱う）
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) {
      buf.push(lines[i].replace(/^#\s+/, ""));
      i++;
    }
    if (buf.length) {
      blocks.push({ type: "paragraph", content: buf.join("\n") });
    } else {
      // どの分岐にも一致せず段落も空（未知の ::: 行など）→ 強制的に1行進めて無限ループを防ぐ
      blocks.push({ type: "paragraph", content: line.replace(/^#\s+/, "") });
      i++;
    }
  }
  return blocks;
}

/**
 * align=left の単独画像を直後の段落と束ねて「画像＋右列」の横並びブロックにする
 * （Figma Master 994:5656）。直後が段落でなければテキスト無しの横並びとして扱う。
 */
function groupImageText(blocks: Block[]): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === "image" && b.align === "left") {
      const next = blocks[i + 1];
      if (next && next.type === "paragraph") {
        out.push({ type: "imageText", image: b, text: next.content });
        i += 2;
        continue;
      }
      out.push({ type: "imageText", image: b, text: null });
      i += 1;
      continue;
    }
    out.push(b);
    i += 1;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * ブロック描画
 * ------------------------------------------------------------------ */

/** 本文サイズ（直前の見出しレベルで決まる）。01=15px（見出し01・02 配下）/ 02=13px（見出し03 配下） */
type BodyLevel = "01" | "02";

/** 本文（段落・リスト）の Body01 / Body02 タイポクラス */
const bodyTypo = (level: BodyLevel) =>
  level === "02" ? "text-[13px] leading-[21px] tracking-[0.39px]" : "text-[15px] leading-[24px] tracking-[0.45px]";

function RenderBlock({
  block,
  idx,
  bodyLevel = "01",
}: {
  block: Block;
  idx: number;
  bodyLevel?: BodyLevel;
}) {
  const k = `b-${idx}`;
  switch (block.type) {
    case "h1":
      return (
        <div className="mb-6 mt-10 flex w-full items-center gap-2">
          <span aria-hidden className="h-px w-4 shrink-0 bg-main-050" />
          <p className="flex-1 text-[16px] font-bold leading-[1.5] tracking-[0.05em] text-main-050">
            {renderInline(block.content, k)}
          </p>
        </div>
      );
    case "h2":
      return (
        <div className="mb-6 mt-10 flex w-full items-center gap-2">
          <span aria-hidden className="h-px w-4 shrink-0 bg-main-050" />
          <p className="flex-1 text-[16px] font-bold leading-[1.5] tracking-[0.05em] text-main-050">
            {renderInline(block.content, k)}
          </p>
        </div>
      );
    case "h3":
      return (
        <p className="font-en mb-4 mt-10 text-[17px] font-extrabold leading-normal tracking-[0.85px] text-fg-muted">
          {renderInline(block.content, k)}
        </p>
      );
    case "small":
      return (
        <p className="mb-3 text-[13px] leading-[21px] tracking-[0.39px] text-white">
          {renderInline(block.content, k)}
        </p>
      );
    case "paragraph":
      return (
        <p className={`mb-6 ${bodyTypo(bodyLevel)} text-white`}>
          {renderInline(block.content, k)}
        </p>
      );
    case "quote":
      return (
        <div className="mb-3 border-l-2 border-border-light pl-3">
          {block.content.split("\n").map((l, i) => (
            <p key={i} className="text-[13px] leading-[21px] tracking-[0.39px] text-system-400">
              {renderInlineLine(l, `${k}-q${i}`)}
            </p>
          ))}
        </div>
      );
    case "image":
      return (
        <ImageFigure
          url={block.url}
          align={block.align}
          width={block.width}
          scale={block.scale}
          caption={block.caption || undefined}
        />
      );
    case "imageText":
      return (
        <ImageTextRow
          url={block.image.url}
          width={block.image.width}
          scale={block.image.scale}
          caption={block.image.caption || undefined}
          text={block.text}
          keyBase={k}
        />
      );
    case "ul":
      return (
        <ul className={`mb-4 list-disc space-y-1 pl-6 ${bodyTypo(bodyLevel)} text-white marker:text-fg-muted`}>
          {block.items.map((it, i) => (
            <li key={i}>{renderInlineLine(it, `${k}-li${i}`)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className={`mb-4 list-decimal space-y-1 pl-6 ${bodyTypo(bodyLevel)} text-white marker:text-fg-muted`}>
          {block.items.map((it, i) => (
            <li key={i}>{renderInlineLine(it, `${k}-li${i}`)}</li>
          ))}
        </ol>
      );
    case "hr":
      return <hr className="my-6 border-border-light" />;
    case "code":
      return (
        <pre className="mb-4 mt-10 overflow-x-auto rounded-[12px] border border-[#2a2a2a] bg-[#0a0a0a] p-4 font-mono text-[13px] leading-[1.6] text-system-300">
          <code>{block.content}</code>
        </pre>
      );
    case "flowchart":
      return <FlowchartEmbed id={block.id} />;
    case "workcard":
      return <WorkCardEmbed id={block.id} />;
    case "card":
      return (
        <div className="mb-4 mt-10">
          <InfoCard title={block.title ? renderInline(block.title, `${k}-ct`) : undefined}>
            <MarkdownBody md={block.body} />
          </InfoCard>
        </div>
      );
    case "tableKeyValue":
      return (
        <div className="mb-4 mt-10">
          <TableKeyValue
            rows={block.rows.map((r, ri) => ({
              label: renderInline(r.label, `${k}-tl${ri}`),
              value: renderInline(r.value, `${k}-tv${ri}`),
            }))}
          />
        </div>
      );
    case "tableGrid":
      return (
        <div className="mb-4 mt-10">
          <TableGrid
            header={block.header.map((h, ci) => renderInline(h, `${k}-th${ci}`))}
            rows={block.rows.map((r, ri) => r.map((c, ci) => renderInline(c, `${k}-tc${ri}-${ci}`)))}
          />
        </div>
      );
    case "grid":
      return (
        <div
          className="mb-4 mt-10 grid"
          style={{
            gridTemplateColumns: `repeat(${block.cols}, minmax(0, 1fr))`,
            gap: `${block.gap * 4}px`,
          }}
        >
          {block.cells.map((cell, i) => (
            <div key={i} className="min-w-0">
              <MarkdownBody md={cell} />
            </div>
          ))}
        </div>
      );
  }
}

/** 本文 markdown を描画する（flow-root で float 画像を内包し回り込みを成立させる） */
export const MarkdownBody: FC<{ md: string }> = ({ md }) => {
  const blocks = groupImageText(parseBlocks(md));
  // 各ブロックの本文サイズを直前の見出しから事前算出（見出し01・02 配下=Body01、見出し03 配下=Body02）
  const bodyLevels: BodyLevel[] = [];
  let level: BodyLevel = "01";
  for (const b of blocks) {
    if (b.type === "h1" || b.type === "h2") level = "01";
    else if (b.type === "h3") level = "02";
    bodyLevels.push(level);
  }
  // flow-root の先頭ブロックの mt（ブロック区切り 40）はセクション gap が担うため打ち消す。
  // 末尾ブロックの mb はセクション間 gap / カラム下端 padding が担うため打ち消す
  return (
    <div style={{ display: "flow-root" }} className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      {blocks.map((b, i) => (
        <RenderBlock key={i} block={b} idx={i} bodyLevel={bodyLevels[i]} />
      ))}
    </div>
  );
};

/** セクション（見出し＋本文 markdown）。公開ページ / admin プレビューで共有 */
export type WorkSection = { heading: string; md: string };

/**
 * 見出し＋本文セクションの並びを描画する共有レンダラ。
 * 公開ページ（WorkDetailContent）と admin プレビュー（WorkMarkdownDocument）が
 * 同じ「Headline + MarkdownBody」ループを共有し、片方だけ崩れる乖離を防ぐ。
 */
export const WorkSections: FC<{
  sections: WorkSection[];
}> = ({ sections }) => {
  // 本文全体で登場順にフローチャートへ Fig. 番号を振る（同じ id は最初の番号を使う）
  const figureNumbers = useMemo(() => {
    const map = new Map<string, number>();
    // MarkdownBody と同じ解析結果をたどる（コードブロック内や分割行は数えず、grid のセルは再帰して数える）
    const collect = (md: string) => {
      for (const block of parseBlocks(md)) {
        if (block.type === "flowchart") {
          if (!map.has(block.id)) map.set(block.id, map.size + 1);
        } else if (block.type === "grid") {
          block.cells.forEach(collect);
        } else if (block.type === "card") {
          collect(block.body);
        }
      }
    };
    sections.forEach((sec) => collect(sec.md));
    return map;
  }, [sections]);

  // 1カラム。見出し（Headline section-aside = Library Headline type=01 + 右罫線）→ 32px → 本文。セクション間 80px。
  // 区切り線は見出しの罫線が兼ねる（Claude Design「Works 詳細 1カラム 提案」B案）
  return (
    <FlowchartFigureContext.Provider value={figureNumbers}>
      <div className="flex flex-col gap-20">
        {sections.map((sec, i) => (
          <section key={i} className="flex w-full flex-col gap-8">
            {sec.heading && <Headline title={sec.heading} variant="section-aside" />}
            <div className="min-w-0 w-full">
              <MarkdownBody md={sec.md} />
            </div>
          </section>
        ))}
      </div>
    </FlowchartFigureContext.Provider>
  );
};

/**
 * `# 見出し` でセクション分割された markdown ドキュメント全体を描画する
 * （admin の本文プレビュー用。公開側 WorkDetailContent と同じ見出し・本文の見た目）。
 */
export const WorkMarkdownDocument: FC<{ md: string }> = ({ md }) => {
  const sections: WorkSection[] = [];
  let current: { heading: string; body: string[] } | null = null;
  const flush = () => {
    // 見出しも本文も空のセクション（先頭の空行など）は捨てる。残すと空のセクション分の余白（80px）だけが出る
    if (current && (current.heading || current.body.join("").trim())) sections.push({ heading: current.heading, md: current.body.join("\n").trim() });
  };
  for (const line of md.split("\n")) {
    if (line.startsWith("# ")) {
      flush();
      current = { heading: line.slice(2).trim(), body: [] };
    } else {
      if (!current) current = { heading: "", body: [] };
      current.body.push(line);
    }
  }
  flush();
  if (sections.length === 0) {
    return <p className="text-[13px] text-fg-muted">本文がありません</p>;
  }
  // 公開側（WorkDetailContent）と同じ 1 カラム（見出し + 右罫線 → 本文）・セクション間隔で描画する
  return <WorkSections sections={sections} />;
};
