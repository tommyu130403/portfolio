import type { FC } from "react";
import Headline from "./Headline";
import Icon from "./Icon";
import Tag from "./Tag";
import { MarkdownBody } from "./WorkMarkdown";
import { parseTimeline, parseStakeholders } from "./WorkViz";
import { buildImageMarkdown } from "@/lib/image-layout";
import type { Tables } from "@/src/types/supabase";

type Work = Tables<"works">;

/* ------------------------------------------------------------------ *
 * データモデル
 * ------------------------------------------------------------------ */

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

function parseScreenshots(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((u): u is string => typeof u === "string" && u.length > 0);
}

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
 * メタ行（役割 / 期間）
 * ------------------------------------------------------------------ */

const MetaRow: FC<{ work: Work }> = ({ work }) => {
  if (!work.role && !work.period) return null;
  return (
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
  const screenshots = parseScreenshots(work.hero_screenshots);
  const sections = normalizeSections(work.sections);
  // ::: timeline / ::: stakeholders ディレクティブが参照する構造化データ
  const viz = { timeline: parseTimeline(work.timeline), stakeholders: parseStakeholders(work.stakeholders) };

  return (
    <div className="flex flex-col">
      <Hero work={work} skills={skills} tools={tools} screenshots={screenshots} />

      <div className="flex flex-col gap-16 px-10 py-10">
        <MetaRow work={work} />

        {/* 本文セクション群（markdown: 見出し/グリッド/画像回り込み等） */}
        {sections.map((section, i) => (
          <section key={i} className="flex flex-col gap-6">
            <Headline title={section.heading} variant="section" />
            <MarkdownBody md={section.md} viz={viz} />
          </section>
        ))}
      </div>
    </div>
  );
};

export default WorkModalContent;
