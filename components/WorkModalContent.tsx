import type { FC } from "react";
import Headline from "./Headline";
import Icon from "./Icon";
import Tag from "./Tag";
import { MarkdownBody } from "./WorkMarkdown";
import { buildImageMarkdown } from "@/lib/image-layout";
import type { Tables } from "@/src/types/supabase";

type Work = Tables<"works">;

/* ------------------------------------------------------------------ *
 * データモデル
 * ------------------------------------------------------------------ */

/** Overview 内のアイコン付き見出しカード（Problem / Goal など。増減・非表示可） */
type OverviewCard = { icon: string; heading: string; body: string };

/** セクション＝見出し＋本文 markdown。旧ブロック形式 {blocks} は markdown へ変換して互換維持 */
type ContentSection = { heading: string; md: string };

function normalizeSections(raw: unknown): ContentSection[] {
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
            <MarkdownBody md={section.md} />
          </section>
        ))}
      </div>
    </div>
  );
};

export default WorkModalContent;
