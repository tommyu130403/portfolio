import type { CSSProperties, FC, ReactNode } from "react";
import React, { createContext, useContext } from "react";
import Headline from "./Headline";
import Icon from "./Icon";
import {
  parseImageAttrs,
  widthToCss,
  type ImageAlign,
} from "@/lib/image-layout";
import { BLOCK_CLOSE, HTML_BLOCK_OPEN, closedBlockEnd, findBlockEnd, takeLeafBlock, type LeafKind } from "@/lib/work-sections";
import WorkCardEmbed from "./WorkCardEmbed";
import MockupEmbed from "./MockupEmbed";
import InfoCard from "./InfoCard";
import { BarChart, BeforeAfter, FigureFrame, FlowSteps, type BarTone, type StepTone } from "./WorkFigure";
import { TableGrid, TableKeyValue } from "./Table";
import ProtectedImage from "./ProtectedImage";

/**
 * Work 詳細・本文 markdown の共有レンダラ（公開モーダル / admin プレビュー共用）。
 *
 * タイポ体系（Figma 457:2366）:
 *  - `## `   → 見出し01（横線 border-light＋Noto Bold 16px fg-subtle・Library Headline type=02 304:302。2026-11-06 見出し階層 B案）
 *  - `### `  → 見出し02（01 と同形）
 *  - `> `    → 引用（13px fg-muted・左ボーダー、連続行対応）
 * 拡張記法:
 *  - **太字** / *斜体* / `インラインコード` / [リンク](url)（外部はアイコン付き）
 *  - `- ` 箇条書き / `1. ` 番号リスト / `---` 区切り線 / ``` コードブロック
 *  - `::: caption テキスト` の補足文（12px・行の高さ 18px。表やグリッドの下などに置く1行）
 *  - `::: grid cols=N gap=M` 〜 `---` 区切り 〜 `:::` の複数カラムグリッド
 *  - `::: card 見出し` 〜 `:::` の汎用カード（`::: card tone=accent 見出し` で強調カード）/ `::: workcard id=<uuid>` の作品リンクカード
 *  - `::: figure 見出し | 補足文` 〜 `:::` の図版の枠（中に任意の本文ブロックを入れ子にできる）
 *  - `::: beforeafter タグ | 見出し` 〜 `:::` の Before/After 図（`before:` / `after:` 行を `→` で区切り、`[!悪い手順]` `[+良い手順]`、直後の `note:` が注記）
 *  - `::: flow ラベル highlight=N` 〜 `:::` の横フロー（`- ` 行が1手順。N 番目を強調、省略=最後、0=なし）
 *  - `::: bars base=1.0 max=1.4` 〜 `:::` の横棒グラフ（`- ラベル | 補助 | 値 | 表示文 | up/down/flat`、`legend:` 行で凡例）
 *  - `::: mockup phone src=<url> [src=<url>] [browser] [url=example.com]` / `::: mockup laptop src=<url> [browser] [url=example.com]` のデバイスモック
 *  - `::: html` 〜 `:::` の生 HTML / SVG 埋め込み（script・iframe・style・イベント属性は除去）
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
          className="my-2 inline-block h-auto rounded-r16 align-top [aspect-ratio:auto_16/10]"
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
        <code className="rounded bg-action-hover px-1.5 py-0.5 font-mono text-[0.88em] text-main-050">
          {code[1]}
        </code>
      );
      i += code[0].length;
      continue;
    }

    // 太字 / 斜体
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
    for (const s of ["![", "[", "`", "**", "*", "http"]) {
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
    ...(align === "full" ? { width: "100%" } : align === "center" ? { width: cssW ?? "50%" } : { "--fig-w": cssW ?? "50%" }),
    maxWidth: "100%",
    ...(align === "center" ? { marginLeft: "auto", marginRight: "auto" } : {}),
  } as CSSProperties;
  const floatClass =
    align === "left"
      ? "clear-both my-10 w-full @min-[560px]:float-left @min-[560px]:clear-none @min-[560px]:my-0 @min-[560px]:mb-2 @min-[560px]:mr-10 @min-[560px]:w-[var(--fig-w)]"
      : align === "right"
        ? "clear-both my-10 w-full @min-[560px]:float-right @min-[560px]:clear-none @min-[560px]:my-0 @min-[560px]:mb-2 @min-[560px]:ml-10 @min-[560px]:w-[var(--fig-w)]"
        : "clear-both mt-10 mb-10";

  return (
    <figure className={floatClass} style={figStyle}>
      <div className="overflow-hidden rounded-r16">
        <ProtectedImage
          src={url}
          alt={caption ?? ""}
          className="block h-auto w-full [aspect-ratio:auto_16/10]"
          style={scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: "center" } : undefined}
        />
      </div>
      {caption && (
        <figcaption
          className={`mt-2 text-[12px] leading-[18px] tracking-[0.03em] text-fg-caption ${align === "center" ? "text-center" : ""}`}
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
    <div className="flex flex-col items-start gap-2 @min-[560px]:flex-row @min-[560px]:gap-6">
      <div
        className="min-w-0 shrink overflow-hidden rounded-r16"
        style={{ width: widthToCss(width) ?? "200px", maxWidth: "100%" }}
      >
        <ProtectedImage
          src={url}
          alt={caption ?? ""}
          className="block h-auto w-full [aspect-ratio:auto_16/10]"
          style={scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: "center" } : undefined}
        />
      </div>
      {(text || caption) && (
        <div className="flex min-w-0 flex-col justify-center gap-2 @min-[560px]:min-w-[200px] @min-[560px]:flex-1">
          {text && (
            <p className="text-[15px] leading-[24px] tracking-[0.45px] text-fg">
              {renderInline(text, `${keyBase}-t`)}
            </p>
          )}
          {caption && (
            <p className="text-[12px] leading-[18px] tracking-[0.03em] text-fg-caption">{caption}</p>
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

/**
 * モックアップの画像 URL として受け付けるか。http(s):// ＋ホスト、または / ＋パス（`//` `/\` は外部扱いになるので除く）。
 * 中身のない `https://` や `/` は弾く。エディタのモックアップダイアログも同じ判定を使う
 */
export function isMockupSrc(src: string): boolean {
  return /^(https?:\/\/[^\s/?#]+|\/(?![/\\])\S+)/i.test(src);
}

type FigureStepData = { text: string; tone: StepTone };
type BeforeAfterRow = { kind: "before" | "after"; steps: FigureStepData[]; note: string };
type BarsRow = { label: string; sub: string; width: number; display: string; tone: BarTone };

type Block =
  | { type: "h1"; content: string }
  | { type: "h2"; content: string }
  | { type: "paragraph"; content: string }
  | { type: "quote"; content: string }
  | ImageBlock
  | { type: "imageText"; image: ImageBlock; text: string | null }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "hr" }
  | { type: "code"; lang: string; content: string }
  | { type: "caption"; content: string }
  | { type: "workcard"; id: string }
  | { type: "mockup"; device: "phone" | "laptop"; srcs: string[]; browser: boolean; url: string | null; caption: string }
  | { type: "card"; title: string; body: string; tone: "default" | "accent" }
  | { type: "figure"; title: string; lead: string; body: string }
  | { type: "beforeAfter"; tag: string; title: string; rows: BeforeAfterRow[] }
  | { type: "flow"; label: string; steps: string[]; highlight: number }
  | { type: "bars"; rows: BarsRow[]; base: number | null; legend: string }
  | { type: "html"; content: string }
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

// コードブロックの開き（``` で始まり、以降にバッククォートを含まない行。info string 付きも可）と閉じ（``` だけの行）
const FENCE_OPEN = /^```([^`]*)$/;
const FENCE_CLOSE = /^```\s*$/;

const HTML_REMOVE_TAGS =
  "script|iframe|object|embed|style|link|meta|base|form|input|button|textarea|select";

/** URL 属性の値を判定用に整える（HTML 実体参照を戻し、空白・制御文字を除いて小文字化） */
function normalizeUrlValue(v: string): string {
  const named: Record<string, string> = {
    colon: ":", tab: "\t", newline: "\n", nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  };
  const fromCode = (n: number) => (Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "");
  return v
    .replace(/&#x([0-9a-f]+);?/gi, (_, h: string) => fromCode(parseInt(h, 16)))
    .replace(/&#([0-9]+);?/g, (_, d: string) => fromCode(parseInt(d, 10)))
    .replace(/&(colon|tab|newline|nbsp|amp|lt|gt|quot|apos);/gi, (_, n: string) => named[n.toLowerCase()])
    .replace(/[\s\x00-\x1f]/g, "")
    .toLowerCase();
}

/**
 * `::: html` ブロック用の簡易サニタイザ（文字列操作のみ。サーバーでも動く）。
 * 危険なタグ（中身ごと）・イベント属性・srcdoc を除き、リンク系属性の javascript: 等は # に置き換える。
 * 1 回の置換で消した文字の残りが新しいタグに組み上がる（`<scr<style>ipt>` → `<script>`）ため、出力が変わらなくなるまで繰り返す
 */
function sanitizeHtml(html: string): string {
  let prev = html;
  for (let i = 0; i < 10; i++) {
    const next = sanitizeHtmlOnce(prev);
    if (next === prev) return next;
    prev = next;
  }
  return prev;
}

function sanitizeHtmlOnce(html: string): string {
  return html
    .replace(new RegExp(`<(${HTML_REMOVE_TAGS})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, "gi"), "")
    .replace(new RegExp(`<\\/?(?:${HTML_REMOVE_TAGS})\\b[^>]*>`, "gi"), "")
    .replace(/([\s/"'])on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "$1")
    .replace(/([\s/"'])srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "$1")
    .replace(
      /([\s/"']+(?:href|src|xlink:href|formaction|action)\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
      (m, head: string, dq?: string, sq?: string, uq?: string) => {
        const value = normalizeUrlValue(dq ?? sq ?? uq ?? "");
        return /^(?:javascript:|vbscript:|data:text\/html)/.test(value) ? `${head}"#"` : m;
      },
    );
}

/** `a | b` を最初の | または ｜（全角）で左右に分ける（無ければ right は空） */
function splitFirstPipe(text: string): [string, string] {
  const idx = text.search(/[|｜]/);
  return idx === -1 ? [text.trim(), ""] : [text.slice(0, idx).trim(), text.slice(idx + 1).trim()];
}

/** 手順を `→` で分ける（[ ] の中の → では分けない） */
function splitSteps(text: string): FigureStepData[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "[") depth++;
    else if (ch === "]") depth = Math.max(0, depth - 1);
    if (ch === "→" && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^\[([!+])([\s\S]*)\]$/);
      return m ? { text: m[2].trim(), tone: m[1] === "!" ? "bad" : "good" } : { text: p, tone: "default" };
    });
}

/** `::: beforeafter` の中身（before: / after: 行と、直前の行に付く note: 行） */
function parseBeforeAfter(body: string[]): BeforeAfterRow[] {
  const rows: BeforeAfterRow[] = [];
  for (const raw of body) {
    const line = raw.trim();
    const row = line.match(/^(before|after)\s*[:：]\s*(.*)$/i);
    if (row) {
      const steps = splitSteps(row[2]);
      if (steps.length > 0) rows.push({ kind: row[1].toLowerCase() === "after" ? "after" : "before", steps, note: "" });
      continue;
    }
    const note = line.match(/^note\s*[:：]\s*(.*)$/i);
    if (note && rows.length > 0 && note[1]) {
      const last = rows[rows.length - 1];
      last.note = last.note ? `${last.note}\n${note[1]}` : note[1];
    }
  }
  return rows;
}

const clampPct = (n: number) => (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);

/** 全角数字・記号を半角にし、桁区切りのカンマを除いて、最初の数値を取り出す（無ければ 0。`90%` `1,000件` `１.３` を読める） */
function parseBarNumber(text: string): number {
  const ascii = text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, ".")
    .replace(/[－−]/g, "-")
    .replace(/(\d),(?=\d{3}(?!\d))/g, "$1");
  const m = ascii.match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

/** `::: bars` の中身（`- ラベル | 補助 | 値 | 表示文 | 色` 行と `legend:` 行）と、開き行の base / max */
function parseBars(rest: string, body: string[]): { rows: BarsRow[]; base: number | null; legend: string } {
  const attr = (name: string) => {
    const m = rest.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`));
    return m ? parseFloat(m[1]) : null;
  };
  const base = attr("base");
  const maxAttr = attr("max");
  let legend = "";
  const raw: { label: string; sub: string; value: number; display: string; tone: BarTone }[] = [];
  for (const l of body) {
    const legendMatch = l.trim().match(/^legend\s*[:：]\s*(.*)$/i);
    if (legendMatch) {
      legend = legendMatch[1].trim();
      continue;
    }
    const item = l.match(/^\s*[-*+]\s+(.*)$/);
    if (!item) continue;
    const [label = "", sub = "", valueText = "", display = "", tone = ""] = item[1].split(/[|｜]/).map((c) => c.trim());
    const value = parseBarNumber(valueText);
    raw.push({
      label,
      sub,
      value,
      display: display || valueText,
      tone: tone === "up" || tone === "down" ? tone : "flat",
    });
  }
  const max = maxAttr !== null && maxAttr > 0 ? maxAttr : Math.max(...raw.map((r) => r.value), base ?? 0);
  const pct = (n: number) => (max > 0 ? clampPct((n / max) * 100) : 0);
  return {
    rows: raw.map((r) => ({ label: r.label, sub: r.sub, width: pct(r.value), display: r.display, tone: r.tone })),
    base: base === null ? null : pct(base),
    legend,
  };
}

function parseBlocks(src: string): Block[] {
  const lines = src.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  const isBlockStart = (line: string) =>
    /^#{2,3}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    FENCE_OPEN.test(line) ||
    /^:::\s*(grid|card|workcard|mockup|timeline|stakeholders|caption|figure|beforeafter|flow|bars)\b/.test(line) ||
    HTML_BLOCK_OPEN.test(line) ||
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

    // 作品リンクカードも1行完結（id は UUID 専用の正規表現で読む。不正な id は段落のまま）
    const workcard = line.match(
      /^:::\s*workcard\s+id\s*=\s*([0-9a-fA-F-]{36})\s*$/,
    );
    if (workcard) {
      blocks.push({ type: "workcard", id: workcard[1] });
      i++;
      continue;
    }

    // デバイスモックも1行完結。種別が不明 / 有効な src が無い行は段落のまま（後続を飲み込まない）
    const mockup = line.match(/^:::\s*mockup\s+(phone|laptop)((?:\s+\S+)*)\s*$/);
    if (mockup) {
      const device = mockup[1] as "phone" | "laptop";
      const srcs: string[] = [];
      let browser = false;
      let url: string | null = null;
      for (const tok of mockup[2].split(/\s+/).filter(Boolean)) {
        const src = tok.match(/^src=(.+)$/);
        if (src) {
          if (isMockupSrc(src[1])) srcs.push(src[1]);
        } else if (tok === "browser") {
          browser = true;
        } else if (tok.startsWith("url=") && tok.length > 4) {
          url = tok.slice(4);
          browser = true;
        }
      }
      if (srcs.length > 0) {
        // 直後（空行を挟んでもよい）の `::: caption` はモックの補足文として取り込み、モックのすぐ下に描く
        // （別ブロックのままだと間が空きすぎる。ユーザー指示 2026-11-02）
        let next = i + 1;
        while (next < lines.length && lines[next].trim() === "") next++;
        const mockCaption = next < lines.length ? lines[next].match(/^:::\s*caption\s+(.+)$/) : null;
        blocks.push({
          type: "mockup",
          device,
          srcs: device === "phone" ? srcs.slice(0, 3) : srcs.slice(0, 1),
          // phone も browser / url を受ける（iOS Safari 風の下部バー。2026-11-02）
          browser,
          url,
          caption: mockCaption ? mockCaption[1].trim() : "",
        });
        i = mockCaption ? next + 1 : i + 1;
        continue;
      }
    }

    // 補足文（キャプション）も1行完結。テキストの無い `::: caption` は何も描画せず読み飛ばす
    const caption = line.match(/^:::\s*caption\s+(.+)$/);
    if (caption) {
      blocks.push({ type: "caption", content: caption[1].trim() });
      i++;
      continue;
    }
    if (/^:::\s*caption\s*$/.test(line)) {
      i++;
      continue;
    }

    // 図版（Before/After・横フロー・横棒グラフ）: 開き 〜 最初の閉じ ::: までを行単位で読む（入れ子は無い）
    const figureOpen = line.match(/^:::\s*(beforeafter|flow|bars)(?:\s+(.*))?$/);
    if (figureOpen) {
      const rest = (figureOpen[2] ?? "").trim();
      const { body, next } = takeLeafBlock(lines, i + 1, figureOpen[1] as LeafKind);
      i = next;
      if (figureOpen[1] === "beforeafter") {
        const [tag, title] = splitFirstPipe(rest);
        blocks.push({
          type: "beforeAfter",
          tag: title ? tag : "",
          title: title || tag,
          rows: parseBeforeAfter(body),
        });
      } else if (figureOpen[1] === "flow") {
        const steps = body.map((l) => l.match(/^\s*[-*+]\s+(.*)$/)?.[1].trim() ?? "").filter(Boolean);
        // highlight=… は値が不正でもラベルに残さず取り除き、不正なら既定（最後）にする
        const hl = rest.match(/(?:^|\s)highlight\s*=\s*(\S*)/);
        const n = hl && /^\d+$/.test(hl[1]) ? parseInt(hl[1], 10) : steps.length;
        blocks.push({
          type: "flow",
          label: rest.replace(/(?:^|\s)highlight\s*=\s*\S*/, "").trim(),
          steps,
          highlight: n >= 1 && n <= steps.length ? n - 1 : -1,
        });
      } else {
        blocks.push({ type: "bars", ...parseBars(rest, body) });
      }
      continue;
    }

    // コードブロック（閉じ ``` が無ければ末尾まで）
    const codeOpen = line.match(FENCE_OPEN);
    if (codeOpen) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !FENCE_CLOSE.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: "code", lang: codeOpen[1].trim().split(/\s+/)[0] ?? "", content: buf.join("\n") });
      continue;
    }

    // 生 HTML / SVG: ::: html 〜 :::（中身はそのまま集める。コードフェンスも数えない）
    if (HTML_BLOCK_OPEN.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !BLOCK_CLOSE.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: "html", content: buf.join("\n") });
      continue;
    }

    // 汎用カード: ::: card 見出し 〜 :::（ネストした grid / card の入れ子を数えて閉じを探す）
    // 図版の枠 ::: figure 見出し | 補足文 〜 ::: も同じ閉じ探し（中身は任意の本文 markdown）
    const cardOpen = line.match(/^:::\s*(card|figure)(?:\s+(.*))?$/);
    if (cardOpen) {
      const end = findBlockEnd(lines, i + 1).end;
      const buf = lines.slice(i + 1, end);
      i = end + 1; // closing :::（EOF で閉じが無いときは末尾を越えるだけ）
      const rest = (cardOpen[2] ?? "").trim();
      if (cardOpen[1] === "figure") {
        const [title, lead] = splitFirstPipe(rest);
        blocks.push({ type: "figure", title, lead, body: buf.join("\n").trim() });
        continue;
      }
      // tone=accent は見出しの先頭にあるときだけ読む（それ以外は従来どおり見出しの文字）
      const accent = rest.match(/^tone=accent(?:\s+(.*))?$/);
      blocks.push({
        type: "card",
        title: accent ? (accent[1] ?? "").trim() : rest,
        body: buf.join("\n").trim(),
        tone: accent ? "accent" : "default",
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
      const { end, splits } = findBlockEnd(lines, i + 1);
      const cells: string[] = [];
      let from = i + 1;
      for (const at of [...splits, end]) {
        cells.push(lines.slice(from, at).join("\n").trim());
        from = at + 1;
      }
      i = end + 1; // closing :::
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

    // 見出し（## / ###）。# はセクション分割記号のため本文では段落扱い
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      blocks.push(level === 2 ? { type: "h1", content: h[2] } : { type: "h2", content: h[2] });
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

/** `::: figure` の内側かどうか（段落・リスト・カードを図版向けの小さい文字にする） */
const InFigureContext = createContext(false);

function RenderBlock({ block, idx }: { block: Block; idx: number }) {
  const k = `b-${idx}`;
  const inFigure = useContext(InFigureContext);
  switch (block.type) {
    // 見出しの階層: 作品名 h1 → セクション見出し h2 → `##`・`###` とも h3（同形の同格。見た目は変えない）
    case "h1":
      return (
        <div className="mb-6 mt-10 flex w-full items-center gap-2">
          <span aria-hidden className="h-px w-4 shrink-0 bg-border-light" />
          <h3 className="flex-1 text-[16px] font-bold leading-[1.5] tracking-[0.05em] text-fg-subtle">
            {renderInline(block.content, k)}
          </h3>
        </div>
      );
    case "h2":
      return (
        <div className="mb-6 mt-10 flex w-full items-center gap-2">
          <span aria-hidden className="h-px w-4 shrink-0 bg-border-light" />
          <h3 className="flex-1 text-[16px] font-bold leading-[1.5] tracking-[0.05em] text-fg-subtle">
            {renderInline(block.content, k)}
          </h3>
        </div>
      );
    case "paragraph":
      return (
        <p
          className={`mb-6 text-fg ${inFigure ? "text-body-02-jp" : "text-[15px] leading-[24px] tracking-[0.45px]"}`}
        >
          {renderInline(block.content, k)}
        </p>
      );
    case "quote":
      return (
        <div className="mb-3 border-l-2 border-border-light pl-3">
          {block.content.split("\n").map((l, i) => (
            <p key={i} className="text-[13px] leading-[21px] tracking-[0.39px] text-fg-muted">
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
        <ul
          className={`mb-4 list-disc pl-6 marker:text-fg-muted ${
            inFigure ? "text-body-02-jp space-y-0.5 text-fg-muted" : "space-y-1 text-[15px] leading-[24px] tracking-[0.45px] text-fg"
          }`}
        >
          {block.items.map((it, i) => (
            <li key={i}>{renderInlineLine(it, `${k}-li${i}`)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol
          className={`mb-4 list-decimal pl-6 marker:text-fg-muted ${
            inFigure ? "text-body-02-jp space-y-0.5 text-fg-muted" : "space-y-1 text-[15px] leading-[24px] tracking-[0.45px] text-fg"
          }`}
        >
          {block.items.map((it, i) => (
            <li key={i}>{renderInlineLine(it, `${k}-li${i}`)}</li>
          ))}
        </ol>
      );
    case "hr":
      return <hr className="my-6 border-border-light" />;
    case "code":
      return (
        <pre className="mb-4 mt-10 overflow-x-auto rounded-[12px] border border-border bg-thumbnail p-4 font-mono text-[13px] leading-[1.6] text-fg">
          <code>{block.content}</code>
        </pre>
      );
    case "caption":
      return <p className="text-[12px] leading-[18px] tracking-[0.03em] mb-4 mt-2 text-fg-caption">{renderInline(block.content, k)}</p>;
    case "workcard":
      return <WorkCardEmbed id={block.id} />;
    case "mockup": {
      const mock = <MockupEmbed device={block.device} srcs={block.srcs} browser={block.browser} url={block.url} />;
      if (!block.caption) return mock;
      // 補足文はモックと同じ塊に入れ、12px 下に中央揃えで置く（MockupEmbed 自身の上下余白は打ち消す）
      return (
        <div className="mb-4 mt-10 [&>div]:my-0">
          {mock}
          <p className="text-[12px] leading-[18px] tracking-[0.03em] mt-3 text-center text-fg-caption">{renderInline(block.caption, `${k}-mc`)}</p>
        </div>
      );
    }
    case "html":
      if (block.content.trim() === "") return null;
      return (
        <div
          className="work-html mb-4 mt-10 max-w-full overflow-x-auto text-fg [&_svg[viewBox]]:h-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }}
        />
      );
    case "card":
      return (
        <div className="mb-4 mt-10">
          <InfoCard title={block.title ? renderInline(block.title, `${k}-ct`) : undefined} tone={block.tone} inFigure={inFigure}>
            <MarkdownBody md={block.body} />
          </InfoCard>
        </div>
      );
    case "figure":
      return (
        <div className="mb-4 mt-10">
          <FigureFrame
            title={block.title ? renderInline(block.title, `${k}-ft`) : undefined}
            lead={block.lead ? renderInline(block.lead, `${k}-fl`) : undefined}
          >
            {block.body ? <MarkdownBody md={block.body} compact /> : null}
          </FigureFrame>
        </div>
      );
    case "beforeAfter":
      return (
        <div className="mb-4 mt-10">
          <BeforeAfter
            tag={block.tag ? renderInline(block.tag, `${k}-bt`) : undefined}
            title={block.title ? renderInline(block.title, `${k}-bn`) : undefined}
            rows={block.rows.map((r, ri) => ({
              kind: r.kind,
              steps: r.steps.map((s, si) => ({ content: renderInline(s.text, `${k}-bs${ri}-${si}`), tone: s.tone })),
              note: r.note ? renderInline(r.note, `${k}-bo${ri}`) : undefined,
            }))}
          />
        </div>
      );
    case "flow":
      if (block.steps.length === 0) return null;
      return (
        <div className="mb-4 mt-10">
          <FlowSteps
            label={block.label ? renderInline(block.label, `${k}-fx`) : undefined}
            steps={block.steps.map((s, si) => ({
              content: renderInline(s, `${k}-fs${si}`),
              tone: si === block.highlight ? "good" : "default",
            }))}
          />
        </div>
      );
    case "bars":
      if (block.rows.length === 0) return null;
      return (
        <div className="mb-4 mt-10">
          <BarChart
            rows={block.rows.map((r, ri) => ({
              label: renderInline(r.label, `${k}-ba${ri}`),
              sub: r.sub ? renderInline(r.sub, `${k}-bb${ri}`) : undefined,
              width: r.width,
              display: renderInline(r.display, `${k}-bd${ri}`),
              tone: r.tone,
            }))}
            base={block.base}
            legend={block.legend ? renderInline(block.legend, `${k}-bl`) : undefined}
          />
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
      // 560px 未満は 1 カラム。幅の判定は親 MarkdownBody（@container）の幅で行う
      return (
        <div
          className="mb-4 mt-10 grid grid-cols-1 @min-[560px]:grid-cols-[repeat(var(--grid-cols),minmax(0,1fr))]"
          style={{ "--grid-cols": block.cols, gap: `${block.gap * 4}px` } as CSSProperties}
        >
          {block.cells.map((cell, i) => (
            // セルが 1 ブロック（カードなど）だけのときは行の高さいっぱいに伸ばし、横並びのカードの高さを揃える（ユーザー指示 2026-11-02）。
            // 画像（figure）の中身は伸ばさない。伸ばすと説明（figcaption）が枠の外へ押し出され、次の段に重なる
            <div key={i} className="min-w-0 [&>div]:h-full [&>div>:only-child]:h-full [&>div>:only-child:not(figure)>*]:h-full">
              <MarkdownBody md={cell} />
            </div>
          ))}
        </div>
      );
  }
}

/** 本文 markdown を描画する（flow-root で float 画像を内包し回り込みを成立させる） */
export const MarkdownBody: FC<{ md: string; compact?: boolean }> = ({ md, compact }) => {
  const inFigure = useContext(InFigureContext);
  const blocks = groupImageText(parseBlocks(md));
  // flow-root の先頭ブロックの mt（ブロック区切り 40）はセクション gap が担うため打ち消す。
  // 末尾ブロックの mb はセクション間 gap / カラム下端 padding が担うため打ち消す
  return (
    <div
      style={{ display: "flow-root" }}
      // compact（図版の枠の中）はブロック間を一律 20px にして、各ブロック固有の上下余白（mt-10 など）を打ち消す
      className={`@container [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${
        compact ? "[&>*]:mt-0! [&>*]:mb-5! [&>*:last-child]:mb-0!" : ""
      }`}
    >
      <InFigureContext.Provider value={compact || inFigure}>
        {blocks.map((b, i) => (
          <RenderBlock key={i} block={b} idx={i} />
        ))}
      </InFigureContext.Provider>
    </div>
  );
};

/** セクション（見出し＋本文 markdown）。公開ページ / admin プレビューで共有 */
export type WorkSection = { heading: string; md: string };

/**
 * admin プレビュー上の編集ボタン（鉛筆）。公開ページでは使わない。
 * className 未指定なら領域の右上角に重ねる（領域側に `relative` が要る）
 */
export const EditButton: FC<{ label: string; onClick: () => void; className?: string }> = ({
  label,
  onClick,
  className = "absolute -right-2 -top-2 z-[1]",
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`${label}を編集`}
    className={`flex size-7 items-center justify-center rounded-full border border-border-light bg-surface/90 text-fg-muted shadow-base transition-colors hover:border-primary hover:text-primary ${className}`}
  >
    <Icon set="Edit" name="edit" tintColor="currentColor" className="size-3.5" aria-hidden />
  </button>
);

/**
 * 見出し＋本文セクションの並びを描画する共有レンダラ。
 * 公開ページ（WorkDetailContent）と admin プレビュー（WorkMarkdownDocument）が
 * 同じ「Headline + MarkdownBody」ループを共有し、片方だけ崩れる乖離を防ぐ。
 */
export const WorkSections: FC<{
  sections: WorkSection[];
  /** admin プレビュー専用。見出しの編集ボタンを出す（引数 = sections 内の何番目か）。渡さなければ見た目は変わらない */
  onEditSection?: (index: number) => void;
}> = ({ sections, onEditSection }) => {
  // 1カラム。見出し（Headline section-aside = Library Headline type=01 + 右罫線）→ 32px → 本文。セクション間 80px。
  // 区切り線は見出しの罫線が兼ねる（Claude Design「Works 詳細 1カラム 提案」B案）
  return (
    <div className="flex flex-col gap-20">
      {sections.map((sec, i) => (
        <section key={i} className="flex w-full flex-col gap-8">
          {onEditSection ? (
            <div className="relative">
              {sec.heading ? (
                <Headline title={sec.heading} variant="section-aside" />
              ) : (
                <p className="text-[12px] text-fg-muted">見出しなし</p>
              )}
              <EditButton label={sec.heading || "見出しなしのセクション"} onClick={() => onEditSection(i)} />
            </div>
          ) : (
            sec.heading && <Headline title={sec.heading} variant="section-aside" />
          )}
          {/* 本文は左右 16px 内側（Figma 888:3167） */}
          <div className="min-w-0 w-full px-4">
            <MarkdownBody md={sec.md} />
          </div>
        </section>
      ))}
    </div>
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
  let inFence = false;
  let inHtml = false;
  const allLines = md.split("\n");
  for (let li = 0; li < allLines.length; li++) {
    const line = allLines[li];
    // ::: html の中身はフェンス・見出しとして扱わず、そのまま本文行にする
    if (inHtml || (!inFence && HTML_BLOCK_OPEN.test(line))) {
      inHtml = !(inHtml && BLOCK_CLOSE.test(line));
      if (!current) current = { heading: "", body: [] };
      current.body.push(line);
      continue;
    }
    // 閉じのある card / grid / figure は、中の `# ` を見出しにせず丸ごと本文行にする（lib の splitSections と同じ）
    const blockEnd = inFence ? -1 : closedBlockEnd(allLines, li);
    if (blockEnd !== -1) {
      if (!current) current = { heading: "", body: [] };
      current.body.push(...allLines.slice(li, blockEnd + 1));
      li = blockEnd;
      continue;
    }
    // コードブロック内の `# コメント` でセクションを割らない
    if (inFence ? FENCE_CLOSE.test(line) : FENCE_OPEN.test(line)) inFence = !inFence;
    if (!inFence && line.startsWith("# ")) {
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
