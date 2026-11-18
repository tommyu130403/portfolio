"use client";

import { type FC, useMemo, useState } from "react";
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
};

/**
 * 作品詳細 v2 の最上部。左 = カテゴリ・題名・制作内容、右 = ヒーロー画像（無ければ左だけ）。
 * ヒーローの選び方・端末枠・拡大表示は WorkDetailHeader と同じ部品を使う
 */
const WorkHero: FC<WorkHeroProps> = ({ work, contents, screenshots, categoryHue, onEdit }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const heroLayout = parseHeroLayout(work.hero_layout);
  const heroSlots = useMemo(
    () => (heroLayout ? parseHeroSlots(work.hero_screenshots, heroLayout) : []),
    [heroLayout, work.hero_screenshots],
  );
  const shots = heroLayout ? heroSlots.filter(Boolean) : screenshots;
  // images は枠なしで出すので、拡大表示も枠なし（#plain）にそろえる
  const lightboxShots = heroLayout === "images" ? shots.map((s) => `${splitFragment(s).src}#plain`) : shots;
  const rel = onEdit ? "relative " : "";
  const relPad = onEdit ? "relative pr-10 " : "";

  return (
    <div className="flex w-full flex-wrap items-start gap-12">
      <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-4 [word-break:break-word]">
        <div className={`${relPad}flex flex-col gap-4`}>
          {work.category && (
            <div className="flex flex-wrap items-center gap-3">
              <Tag variant="category" label={work.category} hue={categoryHue} />
            </div>
          )}
          <h1 className="text-title-pj text-fg-title">{work.title}</h1>
          {onEdit && <EditButton label="カテゴリ・タイトル" onClick={() => onEdit("title")} />}
        </div>
        {(contents.length > 0 || onEdit) && (
          <div className={`${relPad}flex flex-wrap gap-2`}>
            {contents.map((s) => (
              <Tag key={s} label={s} variant="content" />
            ))}
            {onEdit && <EditButton label="制作内容" onClick={() => onEdit("tags")} />}
          </div>
        )}
      </div>

      {shots.length > 0 && (
        <div className={`${rel}flex min-w-0 flex-[1_1_360px] flex-wrap items-end justify-center gap-6`}>
          {heroLayout ? (
            <HeroLayoutShots layout={heroLayout} slots={heroSlots} onClick={() => setLightboxOpen(true)} />
          ) : (
            <HeroShots shots={shots.slice(0, 2)} onClick={() => setLightboxOpen(true)} />
          )}
          {onEdit && <EditButton label="ヒーロー" onClick={() => onEdit("screenshots")} />}
        </div>
      )}
      {shots.length === 0 && onEdit && (
        <div className="relative flex min-h-10 min-w-0 flex-[1_1_360px] items-center justify-center text-[12px] text-fg-muted">
          ヒーロー未設定
          <EditButton label="ヒーロー" onClick={() => onEdit("screenshots")} />
        </div>
      )}

      {lightboxOpen && <ScreenshotLightbox shots={lightboxShots} onClose={() => setLightboxOpen(false)} />}
    </div>
  );
};

export default WorkHero;
