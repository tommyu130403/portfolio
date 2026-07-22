import type { CSSProperties, FC, ReactNode } from "react";
import React from "react";
import Headline from "./Headline";
import {
  parseImageAttrs,
  widthToCss,
  type ImageAlign,
} from "@/lib/image-layout";

/**
 * Work 詳細・本文 markdown の共有レンダラ（公開モーダル / admin プレビュー共用）。
 *
 * タイポ体系（Figma 457:2366）:
 *  - `## `   → 見出し01（Noto Bold 24px white）
 *  - `### `  → 見出し02（Noto Bold 20px mint #b3ffe7）
 *  - `#### ` → 見出し03（Avenir Heavy 17px gray #9e9e9e）
 *  - `##### `→ 小本文 Body02（13px white）
 *  - `> `    → 引用（13px system-400 #BDBDBD・左ボーダー、連続行対応）
 *  - 段落・リスト → 直前の見出しに応じて本文サイズを切替
 *      ・セクションタイトル / 見出し01（`## `）の配下 → Body01（15px / 0.45px）
 *      ・見出し02（`### `）/ 見出し03（`#### `）の配下 → Body02（13px / 0.39px）
 * 拡張記法:
 *  - **太字** / *斜体* / ~~取消線~~ / `インラインコード` / [リンク](url)（外部はアイコン付き）
 *  - `- ` 箇条書き / `1. ` 番号リスト / `---` 区切り線 / ``` コードブロック
 *  - `::: grid cols=N gap=M` 〜 `---` 区切り 〜 `:::` の複数カラムグリッド
 *  - 画像 `![caption](url){width=260 align=left scale=1.2}`（単独行は回り込みブロック）
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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={layout.base}
          alt={img[1]}
          style={{ width: widthToCss(layout.width), maxWidth: "100%" }}
          className="my-2 inline-block rounded-[12px] align-top"
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
  const isFloat = align === "left" || align === "right";
  const figStyle: CSSProperties = {
    width: align === "full" ? "100%" : cssW ?? "50%",
    maxWidth: "100%",
    ...(align === "center" ? { marginLeft: "auto", marginRight: "auto" } : {}),
  };
  const floatClass =
    align === "left" ? "float-left mr-10 mb-2" : align === "right" ? "float-right ml-10 mb-2" : "clear-both my-2";

  return (
    <figure className={floatClass} style={figStyle}>
      <div className="overflow-hidden rounded-[12px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={caption ?? ""}
          className="block h-auto w-full"
          style={scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: "center" } : undefined}
        />
      </div>
      {caption && (
        <figcaption
          className={`mt-2 text-[10px] leading-[1.5] tracking-[0.3px] text-[#9e9e9e] ${align === "center" ? "text-center" : ""}`}
        >
          {caption}
        </figcaption>
      )}
      {isFloat ? null : null}
    </figure>
  );
};

/* ------------------------------------------------------------------ *
 * ブロックパース
 * ------------------------------------------------------------------ */

type Block =
  | { type: "h1"; content: string }
  | { type: "h2"; content: string }
  | { type: "h3"; content: string }
  | { type: "small"; content: string }
  | { type: "paragraph"; content: string }
  | { type: "quote"; content: string }
  | { type: "image"; caption: string; url: string; align: ImageAlign; width: string; scale: number }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "hr" }
  | { type: "code"; lang: string; content: string }
  | { type: "grid"; cols: number; gap: number; cells: string[] };

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
    /^:::\s*(grid|timeline|stakeholders)\b/.test(line) ||
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

    // グリッド: ::: grid cols=N gap=M
    const gridOpen = line.match(/^:::\s*grid\s*(.*)$/);
    if (gridOpen) {
      let cols = 2;
      let gap = 4;
      const re = /(\w+)\s*=\s*(\d+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(gridOpen[1])) !== null) {
        if (m[1] === "cols") cols = Math.max(1, parseInt(m[2], 10) || 2);
        if (m[1] === "gap") gap = parseInt(m[2], 10) || 4;
      }
      const cells: string[] = [];
      let buf: string[] = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) {
        if (/^---\s*$/.test(lines[i])) {
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

/* ------------------------------------------------------------------ *
 * ブロック描画
 * ------------------------------------------------------------------ */

/** 本文サイズ（直前の見出しレベルで決まる）。01=15px / 02=13px */
type BodyLevel = "01" | "02";

/** 本文（段落・リスト）の Body01 / Body02 タイポクラス */
const bodyTypo = (level: BodyLevel) =>
  level === "02" ? "text-[13px] leading-[1.5] tracking-[0.39px]" : "text-[15px] leading-[1.5] tracking-[0.45px]";

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
        <p className="mb-4 mt-10 font-body text-[24px] font-bold leading-[1.5] tracking-[1.2px] text-white">
          {renderInline(block.content, k)}
        </p>
      );
    case "h2":
      return (
        <p className="mb-4 mt-10 font-body text-[20px] font-bold leading-[1.5] tracking-[1px] text-main-050">
          {renderInline(block.content, k)}
        </p>
      );
    case "h3":
      return (
        <p className="mb-4 mt-10 text-[17px] font-extrabold leading-normal tracking-[0.85px] text-[#9e9e9e]">
          {renderInline(block.content, k)}
        </p>
      );
    case "small":
      return (
        <p className="mb-3 text-[13px] leading-[1.5] tracking-[0.39px] text-white">
          {renderInline(block.content, k)}
        </p>
      );
    case "paragraph":
      return (
        <p className={`mb-4 ${bodyTypo(bodyLevel)} text-white`}>
          {renderInline(block.content, k)}
        </p>
      );
    case "quote":
      return (
        <div className="mb-3 border-l-2 border-[#424242] pl-3">
          {block.content.split("\n").map((l, i) => (
            <p key={i} className="text-[13px] leading-[1.5] tracking-[0.39px] text-system-400">
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
    case "ul":
      return (
        <ul className={`mb-4 list-disc space-y-1 pl-6 ${bodyTypo(bodyLevel)} text-white marker:text-[#9e9e9e]`}>
          {block.items.map((it, i) => (
            <li key={i}>{renderInlineLine(it, `${k}-li${i}`)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className={`mb-4 list-decimal space-y-1 pl-6 ${bodyTypo(bodyLevel)} text-white marker:text-[#9e9e9e]`}>
          {block.items.map((it, i) => (
            <li key={i}>{renderInlineLine(it, `${k}-li${i}`)}</li>
          ))}
        </ol>
      );
    case "hr":
      return <hr className="my-6 border-[#424242]" />;
    case "code":
      return (
        <pre className="mb-4 mt-10 overflow-x-auto rounded-[12px] border border-[#2a2a2a] bg-[#0a0a0a] p-4 font-mono text-[13px] leading-[1.6] text-[#e0e0e0]">
          <code>{block.content}</code>
        </pre>
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
  const blocks = parseBlocks(md);
  // 各ブロックの本文サイズを直前の見出しから事前算出（セクションタイトル / 見出し01 配下=Body01、見出し02・03 配下=Body02）
  const bodyLevels: BodyLevel[] = [];
  let level: BodyLevel = "01";
  for (const b of blocks) {
    if (b.type === "h1") level = "01";
    else if (b.type === "h2" || b.type === "h3") level = "02";
    bodyLevels.push(level);
  }
  // flow-root の先頭ブロックの mt（ブロック区切り 40）はセクション gap が担うため打ち消す
  return (
    <div style={{ display: "flow-root" }} className="[&>*:first-child]:mt-0">
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
  /** 見出しの体裁: section=34px / markdown-h1=24px */
  headingVariant?: "section" | "markdown-h1";
  /** セクション間の余白クラス */
  gapClass?: string;
  /** セクション間に横罫線を挿入する */
  withDividers?: boolean;
}> = ({ sections, headingVariant = "section", gapClass = "gap-[120px]", withDividers = false }) => (
  <div className={`flex flex-col ${gapClass}`}>
    {sections.map((sec, i) => (
      <React.Fragment key={i}>
        {withDividers && i > 0 && <div className="h-px w-full bg-[#424242]" aria-hidden />}
        <section className="flex w-full flex-col gap-10">
          {sec.heading && <Headline title={sec.heading} variant={headingVariant} />}
          <MarkdownBody md={sec.md} />
        </section>
      </React.Fragment>
    ))}
  </div>
);

/**
 * `# 見出し` でセクション分割された markdown ドキュメント全体を描画する
 * （admin の本文プレビュー用。公開側と同じ Section 見出し 34px + 本文の見た目）。
 */
export const WorkMarkdownDocument: FC<{ md: string }> = ({ md }) => {
  const sections: WorkSection[] = [];
  let current: { heading: string; body: string[] } | null = null;
  const flush = () => {
    if (current) sections.push({ heading: current.heading, md: current.body.join("\n").trim() });
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
  return <WorkSections sections={sections} headingVariant="section" />;
};
