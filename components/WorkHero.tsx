"use client";

import { type FC, type ReactNode, useMemo, useState } from "react";
import Tag from "./Tag";
import { ScreenshotLightbox } from "./DeviceMock";
import { EditButton } from "./WorkMarkdown";
import { HeroLayoutShots, HeroShots, splitFragment, type WorkDetailEditRegion } from "./WorkDetailHeader";
import { parseHeroLayout, parseHeroSlots } from "@/lib/work-content";
import type { Tables } from "@/src/types/supabase";

type Work = Tables<"works">;

type WorkHeroProps = {
  work: Work;
  contents: string[];
  screenshots: string[];
  /** カテゴリタグの色相（0〜359）。未指定は既定色 */
  categoryHue?: number | null;
  /** admin プレビュー専用。渡すとヒーロー・タイトル・制作内容に編集ボタンを重ねる */
  onEdit?: (region: WorkDetailEditRegion) => void;
  /** タイトルの下に出す 1〜2 文のリード（本文の `::: summary` の lead: を v2 で移したもの）。無ければ出さない */
  lead?: ReactNode;
};

/**
 * 事実（期間・役割）の列の並べ方。幅 440px 以上は項目を左に寄せて横に並べ（期間は折り返さない内容幅、役割は列の幅に収まらないときだけ折り返す）、
 * 未満はラベル左・値右の縦積み。見える項目で列の形が変わるので、静的なクラスの表にする
 */
const FACTS_COLS: Record<string, string> = {
  p2: "@min-[440px]:grid-cols-[auto_minmax(0,max-content)]",
  p1: "@min-[440px]:grid-cols-[auto]",
  r1: "@min-[440px]:grid-cols-[minmax(0,max-content)]",
};

/**
 * 作品詳細 v2 の最上部。常に 1 列: ヒーロー画像（中央。無ければ出さない）→ カテゴリ・題名・リード → 期間・役割 → 制作内容。
 * DOM の順は文字が先・画像が後（読み上げは見出しから）。画像は order-first で見た目だけ先頭にする。
 * ヒーローの選び方・端末枠・拡大表示は WorkDetailHeader と同じ部品を使う
 */
const WorkHero: FC<WorkHeroProps> = ({ work, contents, screenshots, categoryHue, onEdit, lead }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const heroLayout = parseHeroLayout(work.hero_layout);
  const heroSlots = useMemo(
    () => (heroLayout ? parseHeroSlots(work.hero_screenshots, heroLayout) : []),
    [heroLayout, work.hero_screenshots],
  );
  const shots = heroLayout ? heroSlots.filter(Boolean) : screenshots;
  // images は枠なしで出すので、拡大表示も枠なし（#plain）にそろえる
  const lightboxShots = heroLayout === "images" ? shots.map((s) => `${splitFragment(s).src}#plain`) : shots;
  // 期間・役割。値の無い項目は出さない（編集モードでは「—」で出して編集できる）。体制は本文の `::: team`（人数の合計もその図に出る）
  type Fact = { key: string; label: string; value: string; editLabel: string; region: WorkDetailEditRegion };
  const facts = ([
    { key: "period", label: "期間", value: work.period?.trim() ?? "", editLabel: "期間", region: "period" },
    { key: "role", label: "役割", value: work.role?.trim() ?? "", editLabel: "役割", region: "roles" },
  ] satisfies Fact[]).filter((f) => f.value || onEdit);
  const factsCols = FACTS_COLS[`${facts[0]?.key === "period" ? "p" : "r"}${facts.length}`];
  const hasMeta = contents.length > 0 || !!onEdit;
  const rel = onEdit ? "relative " : "";
  const relPad = onEdit ? "relative pr-10 " : "";

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="@container flex w-full min-w-0 flex-col gap-6 [word-break:break-word]">
        {/* 1. 見出し: カテゴリ → 題名 → リード */}
        <div className="flex flex-col gap-4">
          <div className={`${relPad}flex flex-col gap-4`}>
            {work.category && (
              <div className="flex flex-wrap items-center gap-3">
                <Tag variant="category" label={work.category} hue={categoryHue} />
              </div>
            )}
            <h1 className="text-title-pj text-fg-title text-[32px] leading-[1.35] @min-[440px]:text-[36px] [text-wrap:balance]">{work.title}</h1>
            {onEdit && <EditButton label="カテゴリ・タイトル" onClick={() => onEdit("title")} />}
          </div>
          {lead ? <p className="text-body-01-jp text-fg">{lead}</p> : null}
        </div>
        {/* 2. 事実: 上下に細い線。広い幅は項目を横に（ラベルが上・値が下）、狭い幅はラベル左・値右の縦積み */}
        {facts.length > 0 && (
          <dl className={`m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 border-y border-border py-4 @min-[440px]:justify-start @min-[440px]:gap-x-12 @min-[440px]:gap-y-0 ${factsCols}`}>
            {facts.map((f) => (
              <div key={f.key} className="contents @min-[440px]:flex @min-[440px]:min-w-0 @min-[440px]:flex-col @min-[440px]:gap-1">
                <dt className="text-body-03-jp leading-6 text-fg-muted">{f.label}</dt>
                <dd className={`m-0 flex min-w-0 items-center gap-2 text-body-02-jp text-fg [word-break:break-word] ${f.key === "role" ? "" : "@min-[440px]:whitespace-nowrap"}`}>
                  <span className="min-w-0">{f.value || "—"}</span>
                  {onEdit && <EditButton label={f.editLabel} onClick={() => onEdit(f.region)} className="shrink-0" />}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {/* 3. 付随情報: 制作内容タグ */}
        {hasMeta && (
          <div className={`${relPad}flex flex-wrap gap-2`}>
            {contents.map((s) => (
              <Tag key={s} label={s} variant="content" />
            ))}
            {onEdit && <EditButton label="制作内容" onClick={() => onEdit("tags")} />}
          </div>
        )}
      </div>

      {shots.length > 0 && (
        <div className={`${rel}order-first flex w-full min-w-0 flex-wrap items-end justify-center gap-6`}>
          {heroLayout ? (
            <HeroLayoutShots layout={heroLayout} slots={heroSlots} onClick={() => setLightboxOpen(true)} />
          ) : (
            <HeroShots shots={shots.slice(0, 2)} onClick={() => setLightboxOpen(true)} />
          )}
          {onEdit && <EditButton label="ヒーロー" onClick={() => onEdit("screenshots")} />}
        </div>
      )}
      {shots.length === 0 && onEdit && (
        <div className="relative order-first flex min-h-10 w-full min-w-0 items-center justify-center text-[12px] text-fg-muted">
          ヒーロー未設定
          <EditButton label="ヒーロー" onClick={() => onEdit("screenshots")} />
        </div>
      )}

      {lightboxOpen && <ScreenshotLightbox shots={lightboxShots} onClose={() => setLightboxOpen(false)} />}
    </div>
  );
};

export default WorkHero;
