"use client";

import { type FC, useMemo, useState } from "react";
import Icon from "./Icon";
import Tag from "./Tag";
import Tooltip from "./Tooltip";
import { resolveLogoSlug } from "@/src/components/SkillsCardGrid";
import WorkVizModal from "./WorkVizModal";
import ProtectedImage from "./ProtectedImage";
import { PhoneMock, ScreenshotLightbox } from "./DeviceMock";
import { parseTimeline, parseStakeholders } from "./WorkViz";
import { periodFromRow } from "@/lib/timeline-scale";
import type { Tables } from "@/src/types/supabase";

type Work = Tables<"works">;

export type WorkToolItem = { name: string; icon_url: string | null; slug?: string | null };

/**
 * ツールのアイコン URL を決める。icon_url → スキル欄と同じ判定の public/logos のロゴ の順に、
 * 読み込みに失敗していない最初のものを返す。どちらも無い / 失敗済みなら null（文字 Tag にする）
 */
const resolveToolIconSrc = (t: WorkToolItem, broken: Record<string, boolean>): string | null => {
  const slug = resolveLogoSlug(t);
  const candidates = [t.icon_url, slug ? `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logos/${slug}.svg` : null];
  return candidates.find((src): src is string => Boolean(src) && !broken[src as string]) ?? null;
};

/**
 * 「事業責任者1・エンジニア3」「インターン5名」形式の関係者内訳を { name, count }[] に分解する。
 * 区切りは役割と同じ「・」「、」「,」。名前に数字を含む区切り（「エンジニア1〜2」等）も含め、
 * 1 つでも形式に合わなければ null（呼び出し側は元の文字列をそのまま出す）。
 */
export const parseStakeholderBreakdown = (
  raw: string | null | undefined
): { name: string; count: number }[] | null => {
  if (!raw) return null;
  const items: { name: string; count: number }[] = [];
  for (const seg of raw.split(/[・、,]/)) {
    const m = seg.trim().match(/^(\D+?)\s*(\d+)名?$/);
    if (!m) return null;
    items.push({ name: m[1].trim(), count: Number(m[2]) });
  }
  return items;
};

/** admin プレビューで「編集」ボタンを出せる領域（クリックで左カラムの該当入力欄へ移動する） */
export type WorkDetailEditRegion = "screenshots" | "title" | "tags" | "period" | "roles" | "stakeholders";

type WorkDetailHeaderProps = {
  work: Work;
  contents: string[];
  tools: WorkToolItem[];
  screenshots: string[];
  /** admin プレビュー専用。渡すと各領域に編集ボタンを重ねる（公開ページでは渡さない＝見た目は変わらない） */
  onEdit?: (region: WorkDetailEditRegion) => void;
};

/** プレビュー上の編集ボタン（admin 専用）。className 未指定なら領域の右上角に重ねる */
export const EditButton: FC<{ label: string; onClick: () => void; className?: string }> = ({
  label,
  onClick,
  className = "absolute -right-2 -top-2 z-[1]",
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`${label}を編集`}
    className={`flex size-7 items-center justify-center rounded-full border border-border-light bg-surface/90 text-system-500 shadow-base transition-colors hover:border-primary hover:text-primary ${className}`}
  >
    <Icon set="Edit" name="edit" tintColor="currentColor" className="size-3.5" aria-hidden />
  </button>
);

/* ------------------------------------------------------------------ *
 * 上部ブロック本体（Figma 787:9916 / _ProjectContents のブロック①②）
 * ------------------------------------------------------------------ */

const WorkDetailHeader: FC<WorkDetailHeaderProps> = ({ work, contents, tools, screenshots, onEdit }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [vizModal, setVizModal] = useState<"timeline" | "stakeholders" | null>(null);
  // 読み込みに失敗したアイコン URL。失敗したら次の候補（手元のロゴ → 文字 Tag）へ進む
  const [brokenIcons, setBrokenIcons] = useState<Record<string, boolean>>({});
  const shots = screenshots.length > 0 ? screenshots : work.thumbnail_url ? [work.thumbnail_url] : [];
  // 「全画面」ボタンで開く構造化ビジュアル（データが無ければボタン自体を非表示）。
  // jsonb のパースは該当カラムが変わったときだけ（WorkEditor と同じ useMemo 規約）
  const timeline = useMemo(() => parseTimeline(work.timeline), [work.timeline]);
  const { start_date, end_date, is_current } = work;
  const timelinePeriod = useMemo(
    () => periodFromRow({ start_date, end_date, is_current }),
    [start_date, end_date, is_current],
  );
  const stakeholders = useMemo(() => parseStakeholders(work.stakeholders), [work.stakeholders]);
  const roles = (work.role ?? "").split(/[・、,]/).map((r) => r.trim()).filter(Boolean);
  const stakeholderTags = useMemo(() => parseStakeholderBreakdown(work.stakeholder_breakdown), [work.stakeholder_breakdown]);

  // 編集ボタンを重ねる領域の基準位置（onEdit が無いときは何も足さず、公開ページの見た目を変えない）
  const rel = onEdit ? "relative " : "";

  return (
    <div className="flex w-full flex-col gap-12">
      {/* デバイスモック（最大2枚） */}
      {shots.length > 0 && (
        <div className={`${rel}flex w-full items-start justify-center gap-6`}>
          {shots.slice(0, 2).map((src, i) => (
            <PhoneMock key={i} src={src} onClick={() => setLightboxOpen(true)} />
          ))}
          {onEdit && <EditButton label="スクリーンショット" onClick={() => onEdit("screenshots")} />}
        </div>
      )}
      {shots.length === 0 && onEdit && (
        <div className="relative flex min-h-10 items-center justify-center text-[12px] text-fg-muted">
          スクリーンショット未設定
          <EditButton label="スクリーンショット" onClick={() => onEdit("screenshots")} />
        </div>
      )}

      {/* カテゴリ + タイトル + 制作内容/Tools（gap-6）→ メタ表（48px 空け） */}
      <div className="flex w-full flex-col gap-12">
        <div className="flex w-full flex-col gap-6">
          <div className={`${rel}flex w-full flex-col gap-4 [word-break:break-word]`}>
            {work.category && <p className="text-body-01-jp text-primary">{work.category}</p>}
            <p className="text-title-pj text-fg">{work.title}</p>
            {onEdit && <EditButton label="カテゴリ・タイトル" onClick={() => onEdit("title")} />}
          </div>

          {/* 制作内容 → Tools を 1 行で並べる（Tools は icon_url があればアイコン、無ければ文字 Tag） */}
          {(contents.length > 0 || tools.length > 0) && (
            <div className={`${rel}flex w-full flex-wrap items-center gap-2`}>
              {contents.map((s) => (
                <Tag key={s} label={s} variant="content" />
              ))}
              {tools.map((t) => {
                const iconSrc = resolveToolIconSrc(t, brokenIcons);
                return iconSrc ? (
                  <Tooltip key={t.name} label={t.name}>
                    <ProtectedImage
                      src={iconSrc}
                      alt={t.name}
                      className="h-4 w-4 shrink-0 object-contain"
                      onError={() => setBrokenIcons((prev) => ({ ...prev, [iconSrc]: true }))}
                    />
                  </Tooltip>
                ) : (
                  <Tag key={t.name} label={t.name} variant="small" />
                );
              })}
              {onEdit && <EditButton label="制作内容・ツール" onClick={() => onEdit("tags")} />}
            </div>
          )}
          {contents.length === 0 && tools.length === 0 && onEdit && (
            <div className="relative flex min-h-10 items-center justify-center text-[12px] text-fg-muted">
              制作内容・ツール未設定
              <EditButton label="制作内容・ツール" onClick={() => onEdit("tags")} />
            </div>
          )}
        </div>

        {/* メタ表（Figma 787:9916）。列比は 1fr : 4fr（Figma 0.25fr : 1fr）。
            ラベル列の下限は max-content にして、ブラウザの既定フォントサイズを上げても
            ラベル文字（12px 固定）が仕切り線を越えないようにする（root 24px で「関係者」が越えた実績）。 */}
        <div className="grid w-full grid-cols-[minmax(max-content,1fr)_minmax(0,4fr)] overflow-hidden rounded-r8 border border-border">
          {/* 期間 */}
          <div className="flex min-h-10 items-center border-b border-border px-4">
            <span className="text-[12px] font-normal leading-[1.5] tracking-[0.36px] whitespace-nowrap text-fg-muted">
              期間
            </span>
          </div>
          <div className="relative flex min-h-10 items-center gap-2 border-b border-border px-4 after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:border-l after:border-border after:content-['']">
            {/* 値が無い行も表として残す。フォールバックは "—" に統一する
                （旧実装は "タイムライン（RACI）" と出していたが、期間データのように読めてしまう。
                  ボタンが何を開くかは aria-label が担う） */}
            <span className="min-w-0 truncate text-body-03-jp text-fg-muted" title={work.period ?? undefined}>
              {work.period || "—"}
            </span>
            {timeline && (
              <button
                type="button"
                onClick={() => setVizModal("timeline")}
                aria-label="タイムライン（RACI）を表示"
                className="relative flex size-6 shrink-0 items-center justify-center rounded-r8 bg-surface p-[6px] transition-colors before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-border after:transition-colors after:content-[''] hover:after:border-system-500"
              >
                <Icon
                  set="Arrows"
                  name="full-screen-two"
                  tintColor="var(--color-system-500)"
                  className="h-full w-full"
                  aria-hidden
                />
              </button>
            )}
            {onEdit && <EditButton label="期間" onClick={() => onEdit("period")} className="ml-auto shrink-0" />}
          </div>

          {/* 役割 */}
          <div className="flex min-h-10 items-center border-b border-border px-4">
            <span className="text-[12px] font-normal leading-[1.5] tracking-[0.36px] whitespace-nowrap text-fg-muted">
              役割
            </span>
          </div>
          <div className="relative flex min-h-10 flex-wrap items-center gap-2 border-b border-border px-4 py-[6px] after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:border-l after:border-border after:content-['']">
            {roles.length > 0 ? (
              roles.map((r, i) => <Tag key={`${i}-${r}`} variant="tool" filled label={r} />)
            ) : (
              <span className="min-w-0 truncate text-body-03-jp text-fg-muted">—</span>
            )}
            {onEdit && <EditButton label="役割" onClick={() => onEdit("roles")} className="ml-auto shrink-0" />}
          </div>

          {/* 関係者 */}
          <div className="flex min-h-10 items-center px-4">
            <span className="text-[12px] font-normal leading-[1.5] tracking-[0.36px] whitespace-nowrap text-fg-muted">
              関係者
            </span>
          </div>
          <div className="relative flex min-h-10 flex-wrap items-center gap-2 px-4 py-[6px] after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:border-l after:border-border after:content-['']">
            {stakeholderTags ? (
              stakeholderTags.map((s, i) => <Tag key={`${i}-${s.name}`} variant="tool" filled label={s.name} count={s.count} />)
            ) : (
              <span className="min-w-0 truncate text-body-03-jp text-fg-muted" title={work.stakeholder_breakdown ?? undefined}>
                {work.stakeholder_breakdown || "—"}
              </span>
            )}
            {stakeholders && (
              <button
                type="button"
                onClick={() => setVizModal("stakeholders")}
                aria-label="ステークホルダー体制を表示"
                className="relative flex size-6 shrink-0 items-center justify-center rounded-r8 bg-surface p-[6px] transition-colors before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-border after:transition-colors after:content-[''] hover:after:border-system-500"
              >
                <Icon
                  set="Arrows"
                  name="full-screen-two"
                  tintColor="var(--color-system-500)"
                  className="h-full w-full"
                  aria-hidden
                />
              </button>
            )}
            {onEdit && <EditButton label="関係者" onClick={() => onEdit("stakeholders")} className="ml-auto shrink-0" />}
          </div>
        </div>
      </div>

      {lightboxOpen && <ScreenshotLightbox shots={shots} onClose={() => setLightboxOpen(false)} />}

      {vizModal && (
        <WorkVizModal
          kind={vizModal}
          timeline={timeline}
          period={timelinePeriod}
          stakeholders={stakeholders}
          onClose={() => setVizModal(null)}
        />
      )}
    </div>
  );
};

export default WorkDetailHeader;
