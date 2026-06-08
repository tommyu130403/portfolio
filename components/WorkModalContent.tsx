import type { FC, ReactNode } from "react";
import React from "react";
import Headline from "./Headline";
import Icon from "./Icon";
import Tag from "./Tag";
import { parseImageSrc, widthToCss } from "@/lib/image-layout";
import type { Tables } from "@/src/types/supabase";

type Work = Tables<"works">;

/* ------------------------------------------------------------------ *
 * データモデル
 * ------------------------------------------------------------------ */

/** Overview 内のアイコン付き見出しカード（Problem / Goal など。増減・非表示可） */
type OverviewCard = { icon: string; heading: string; body: string };

/** 柔軟な Headline セクションのコンテンツブロック（R4） */
type TextBlock = { type: "text"; md: string };
type ImageBlock = {
  type: "image";
  url: string;
  /** 表示幅。number は px、string はそのまま（例: "60%"）。未指定で 100% */
  width?: number | string;
  /** 回り込み（折り返し）配置。full=単独行 / left・right=テキスト回り込み */
  align?: "full" | "left" | "right";
  /** 表示倍率（画像内容のズーム）。1 = 等倍 */
  scale?: number;
  /** 補足キャプション（10px） */
  caption?: string;
};
type Block = TextBlock | ImageBlock;
type ContentSection = { heading: string; blocks: Block[] };

/** sections(jsonb) を新旧両対応で ContentSection[] に正規化（後方互換アダプタ） */
function normalizeSections(raw: unknown): ContentSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item): ContentSection => {
    const obj = (item ?? {}) as Record<string, unknown>;
    const heading = typeof obj.heading === "string" ? obj.heading : "";
    if (Array.isArray(obj.blocks)) {
      const blocks = (obj.blocks as unknown[])
        .map((b): Block | null => {
          const blk = (b ?? {}) as Record<string, unknown>;
          if (blk.type === "image" && typeof blk.url === "string") {
            return {
              type: "image",
              url: blk.url,
              width: (blk.width as number | string | undefined) ?? undefined,
              align: (blk.align as ImageBlock["align"]) ?? "full",
              scale: typeof blk.scale === "number" ? blk.scale : 1,
              caption: typeof blk.caption === "string" ? blk.caption : undefined,
            };
          }
          if (typeof blk.md === "string") return { type: "text", md: blk.md };
          if (typeof blk.body === "string") return { type: "text", md: blk.body };
          return null;
        })
        .filter((b): b is Block => b !== null);
      return { heading, blocks };
    }
    // 旧形式 { heading, body } → text ブロック1つ
    const body = typeof obj.body === "string" ? obj.body : "";
    return { heading, blocks: [{ type: "text", md: body }] };
  });
}

function parseOverviewCards(raw: unknown): OverviewCard[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): OverviewCard | null => {
      const obj = (item ?? {}) as Record<string, unknown>;
      if (typeof obj.heading !== "string") return null;
      return {
        icon: typeof obj.icon === "string" ? obj.icon : "",
        heading: obj.heading,
        body: typeof obj.body === "string" ? obj.body : "",
      };
    })
    .filter((c): c is OverviewCard => c !== null);
}

function parseScreenshots(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((u): u is string => typeof u === "string" && u.length > 0);
}

/** "Set/name" 形式のアイコン指定を Icon の set/name へ分解 */
function splitIcon(icon: string): { set: string; name: string } | null {
  const idx = icon.indexOf("/");
  if (idx < 0) return null;
  return { set: icon.slice(0, idx), name: icon.slice(idx + 1) };
}

const CardIcon: FC<{ icon: string; className?: string; tint?: string }> = ({ icon, className, tint }) => {
  const parsed = splitIcon(icon);
  if (!parsed) return null;
  // Icon の set は型上 IconSet だが、DB 由来の文字列を許容するため any 経由で渡す
  return <Icon set={parsed.set as never} name={parsed.name} className={className} tintColor={tint} />;
};

/* ------------------------------------------------------------------ *
 * テキスト（markdown）レンダリング
 *  - SectionBodyRenderer: 既存スタック表示（## 見出し・画像・段落）
 *  - FlowText: float 画像に回り込ませるためのブロックフロー版
 * ------------------------------------------------------------------ */

const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

function renderInline(text: string, key: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  IMG_RE.lastIndex = 0;
  while ((m = IMG_RE.exec(text)) !== null) {
    const before = text.slice(last, m.index);
    if (before) {
      parts.push(
        <React.Fragment key={`${key}-t-${last}`}>
          {before.split("\n").map((line, li, arr) => (
            <React.Fragment key={li}>
              {line}
              {li < arr.length - 1 && <br />}
            </React.Fragment>
          ))}
        </React.Fragment>
      );
    }
    parts.push(
      <img
        key={`${key}-img-${m.index}`}
        src={m[2]}
        alt={m[1]}
        className="my-4 max-w-full rounded-[12px] block"
      />
    );
    last = m.index + m[0].length;
  }
  const tail = text.slice(last);
  if (tail) {
    parts.push(
      <React.Fragment key={`${key}-tail`}>
        {tail.split("\n").map((line, li, arr) => (
          <React.Fragment key={li}>
            {line}
            {li < arr.length - 1 && <br />}
          </React.Fragment>
        ))}
      </React.Fragment>
    );
  }
  return parts;
}

/**
 * Markdown 本文を全タイポレベルで描画（ブロックフロー＝float 画像に回り込み可）。
 * Figma 457:2366 のタイポ体系に準拠：
 *  - `## `   → 見出し01（Noto Bold 24px white / tracking 1.2px）
 *  - `### `  → 見出し02（Noto Bold 20px mint #b3ffe7 / tracking 1px）
 *  - `#### ` → 見出し03（Avenir Heavy 17px gray #9e9e9e / tracking 0.85px）
 *  - `> `    → Body02（Noto Regular 13px white / tracking 0.39px、blockquote 由来）
 *  - 通常段落 → Body01（Noto Regular 15px white / tracking 0.45px）
 *  - `![alt](url)` → インライン画像
 * （`# ` はセクション分割記号のため本文には来ない想定。来た場合は本文として扱う）
 */
const MarkdownBody: FC<{ md: string }> = ({ md }) => {
  const out: ReactNode[] = [];
  let para: string[] = [];
  const flush = () => {
    const text = para.join("\n").trim();
    if (text) {
      out.push(
        <p key={`p-${out.length}`} className="mb-4 text-[15px] leading-[1.5] tracking-[0.45px] text-white">
          {renderInline(text, `p-${out.length}`)}
        </p>
      );
    }
    para = [];
  };
  for (const rawLine of md.split("\n")) {
    const line = rawLine.trimEnd();
    const imgOnly = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgOnly) {
      // 画像単独行 → 回り込みブロック（URL フラグメントで配置/幅/倍率を指定）
      flush();
      const layout = parseImageSrc(imgOnly[2]);
      out.push(
        <ImageFigure
          key={`img-${out.length}`}
          block={{
            type: "image",
            url: layout.base,
            align: layout.align,
            width: layout.width || undefined,
            scale: layout.scale,
            caption: imgOnly[1] || undefined,
          }}
        />
      );
    } else if (line.startsWith("##### ")) {
      // Body02（13px 白）。markdown では heading level 5 として表現（admin は「小本文」UIで指定）
      flush();
      out.push(
        <p key={`b2-${out.length}`} className="mb-3 text-[13px] leading-[1.5] tracking-[0.39px] text-white">
          {renderInline(line.slice(6).trim(), `b2-${out.length}`)}
        </p>
      );
    } else if (line.startsWith("#### ")) {
      flush();
      out.push(
        <p key={`h-${out.length}`} className="mb-3 text-[17px] font-extrabold leading-normal tracking-[0.85px] text-[#9e9e9e]">
          {line.slice(5).trim()}
        </p>
      );
    } else if (line.startsWith("### ")) {
      flush();
      out.push(
        <p key={`h-${out.length}`} className="mb-3 font-body text-[20px] font-bold leading-[1.5] tracking-[1px] text-main-050">
          {line.slice(4).trim()}
        </p>
      );
    } else if (line.startsWith("## ")) {
      flush();
      out.push(
        <p key={`h-${out.length}`} className="mb-4 font-body text-[24px] font-bold leading-[1.5] tracking-[1.2px] text-white">
          {line.slice(3).trim()}
        </p>
      );
    } else if (line.startsWith("> ")) {
      // blockquote（引用）: テキスト色 system-400(#BDBDBD) ＋ 左ボーダー
      flush();
      out.push(
        <p key={`q-${out.length}`} className="mb-3 border-l-2 border-[#424242] pl-3 text-[13px] leading-[1.5] tracking-[0.39px] text-system-400">
          {renderInline(line.slice(2).trim(), `q-${out.length}`)}
        </p>
      );
    } else if (line.trim() === "") {
      flush();
    } else if (line.startsWith("# ")) {
      para.push(line.slice(2).trim());
    } else {
      para.push(line);
    }
  }
  flush();
  // flow-root で float 画像を内包し、後続テキストを回り込ませる
  return <div style={{ display: "flow-root" }}>{out}</div>;
};

/* ------------------------------------------------------------------ *
 * 画像ブロック
 * ------------------------------------------------------------------ */

const ImageFigure: FC<{ block: ImageBlock }> = ({ block }) => {
  const align = block.align ?? "full";
  const cssW =
    block.width == null || block.width === ""
      ? undefined
      : typeof block.width === "number"
        ? `${block.width}px`
        : widthToCss(block.width);
  const width = align === "full" ? "100%" : cssW ?? "50%";
  const scale = block.scale && block.scale !== 1 ? block.scale : undefined;

  const floatClass =
    align === "left"
      ? "float-left mr-6 mb-2"
      : align === "right"
        ? "float-right ml-6 mb-2"
        : "clear-both my-2";

  return (
    <figure className={`${floatClass}`} style={{ width: align === "full" ? "100%" : width, maxWidth: "100%" }}>
      <div className="overflow-hidden rounded-[12px]">
        <img
          src={block.url}
          alt={block.caption ?? ""}
          className="block w-full h-auto"
          style={scale ? { transform: `scale(${scale})`, transformOrigin: "center" } : undefined}
        />
      </div>
      {block.caption && (
        <figcaption className="mt-2 text-[10px] leading-[1.5] tracking-[0.3px] text-[#9e9e9e]">
          {block.caption}
        </figcaption>
      )}
    </figure>
  );
};

/** Headline セクション本体。常にブロックフローで描画し、float 画像の回り込みに対応 */
const ContentSectionBody: FC<{ blocks: Block[] }> = ({ blocks }) => {
  const hasFloat = blocks.some((b) => b.type === "image" && (b.align === "left" || b.align === "right"));
  return (
    <div className={hasFloat ? "overflow-hidden" : undefined}>
      {blocks.map((b, i) =>
        b.type === "text" ? <MarkdownBody key={i} md={b.md} /> : <ImageFigure key={i} block={b} />
      )}
      {hasFloat && <div className="clear-both" />}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Hero
 * ------------------------------------------------------------------ */

const DEFAULT_HERO_BG = "#48f4be";

const Hero: FC<{
  work: Work;
  skills: string[];
  tools: string[];
  screenshots: string[];
}> = ({ work, skills, tools, screenshots }) => {
  const bg = work.hero_bg_color || DEFAULT_HERO_BG;
  const shots = screenshots.length > 0 ? screenshots : work.thumbnail_url ? [work.thumbnail_url] : [];

  return (
    <div
      className="relative flex min-h-[380px] flex-col overflow-hidden rounded-t-[14px] px-10 py-9"
      style={{ backgroundColor: bg }}
    >
      {/* 右：デバイスモックアップのコラージュ（傾け・重ね・右へはみ出す） */}
      {shots.length > 0 && (
        <div className="pointer-events-none absolute right-[-72px] top-1/2 flex -translate-y-1/2 items-center">
          {shots.slice(0, 5).map((src, i) => {
            const rot = [-8, 5, -5, 7, -4][i] ?? 0;
            const dy = [12, -14, 6, -10, 14][i] ?? 0;
            return (
              <div
                key={i}
                className="w-[112px] shrink-0 overflow-hidden rounded-[20px] border-[3px] border-[#0a0a0a]/75 bg-[#0a0a0a] shadow-xl"
                style={{
                  aspectRatio: "9 / 19.5",
                  marginLeft: i === 0 ? 0 : -38,
                  transform: `rotate(${rot}deg) translateY(${dy}px)`,
                  zIndex: i,
                }}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </div>
            );
          })}
        </div>
      )}

      {/* 上：ブランド名 + 制作カテゴリ */}
      {(work.hero_brand || work.category) && (
        <div className="relative z-10 flex items-baseline gap-3">
          {work.hero_brand && (
            <p className="text-[20px] font-extrabold leading-none tracking-[0.6px] text-[#0a0a0a]">{work.hero_brand}</p>
          )}
          {work.category && (
            <p className="text-[12px] font-bold tracking-[0.6px] text-[#0a0a0a]/55">{work.category}</p>
          )}
        </div>
      )}

      {/* 下：タイトル + Skills/Tools（デバイスコラージュと重ならない幅に制限） */}
      <div className="relative z-10 mt-auto flex max-w-[50%] flex-col gap-4 pt-10">
        <p className="text-[32px] font-bold leading-[1.3] tracking-[0.96px] text-[#0a0a0a]">{work.title}</p>
        {(skills.length > 0 || tools.length > 0) && (
          <div className="flex flex-col gap-2">
            {skills.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {skills.map((s) => (
                  <Tag key={s} label={s} variant="small" />
                ))}
              </div>
            )}
            {tools.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {tools.map((t) => (
                  <Tag key={t} label={t} variant="small" />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Overview 大セクション（R1: Timeline・Stakeholder までを内包）
 * ------------------------------------------------------------------ */

// アイコン付き見出し（Problem / Goal / Timeline / Stakeholders）。
// Figma: テキスト・アイコンともに main-050(#b3ffe7)。サイズは 02（20px）。
const IconHeading: FC<{ icon?: string; title: string }> = ({ icon, title }) => (
  <div className="flex items-center gap-2">
    {icon && <CardIcon icon={icon} tint="var(--color-main-050)" className="h-[22px] w-[22px] shrink-0" />}
    <Headline title={title} variant="markdown-h2" />
  </div>
);

const OverviewSection: FC<{ work: Work; cards: OverviewCard[] }> = ({ work, cards }) => {
  const hasMeta = Boolean(work.role || work.period);
  return (
    <section className="flex flex-col gap-8">
      {/* リード */}
      <div className="flex flex-col gap-4">
        <Headline title="Overview" variant="section" />
        {work.overview && (
          <p className="text-[15px] leading-[1.5] tracking-[0.45px] text-white whitespace-pre-line">
            {work.overview}
          </p>
        )}
        {hasMeta && (
          <div className="flex flex-col gap-2">
            {work.role && (
              <span className="flex items-center gap-2 text-[15px] leading-[1.5] tracking-[0.45px] text-[#9e9e9e]">
                <Icon set="Peoples" name="people" tintColor="#9e9e9e" className="h-5 w-5 shrink-0" />
                {work.role}
              </span>
            )}
            {work.period && (
              <span className="flex items-center gap-2 text-[15px] leading-[1.5] tracking-[0.45px] text-[#9e9e9e]">
                <Icon set="Time" name="calendar-three" tintColor="#9e9e9e" className="h-5 w-5 shrink-0" />
                {work.period}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 情報カードグリッド（R2: 2カラム・増減/非表示可） */}
      {cards.length > 0 && (
        <div className="grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-2">
          {cards.map((card, i) => (
            <div key={i} className="flex flex-col gap-2">
              <IconHeading icon={card.icon} title={card.heading} />
              {card.body && (
                <p className="text-[13px] leading-[1.5] tracking-[0.39px] text-white whitespace-pre-line">
                  {card.body}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Phase 2: Timeline (_Process) / Stakeholders (_Stakeholder) をここに描画予定。
          現状はデータ列が無いため非表示。 */}
    </section>
  );
};

/* ------------------------------------------------------------------ *
 * 本体
 * ------------------------------------------------------------------ */

type WorkModalContentProps = {
  work: Work;
  skills?: string[];
  tools?: string[];
};

const WorkModalContent: FC<WorkModalContentProps> = ({ work, skills = [], tools = [] }) => {
  const cards = parseOverviewCards(work.overview_cards);
  const screenshots = parseScreenshots(work.hero_screenshots);
  const sections = normalizeSections(work.sections);

  return (
    <div className="flex flex-col">
      <Hero work={work} skills={skills} tools={tools} screenshots={screenshots} />

      <div className="flex flex-col gap-16 px-10 py-10">
        <OverviewSection work={work} cards={cards} />

        {/* 柔軟な Headline セクション群（R4: ブロック型・画像回り込み/倍率対応） */}
        {sections.map((section, i) => (
          <section key={i} className="flex flex-col gap-6">
            <Headline title={section.heading} variant="section" />
            <ContentSectionBody blocks={section.blocks} />
          </section>
        ))}
      </div>
    </div>
  );
};

export default WorkModalContent;
