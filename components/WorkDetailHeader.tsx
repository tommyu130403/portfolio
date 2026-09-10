"use client";

import { type FC, useEffect, useMemo, useState } from "react";
import Icon from "./Icon";
import Tag from "./Tag";
import WorkVizModal from "./WorkVizModal";
import { parseTimeline, parseStakeholders } from "./WorkViz";
import type { Tables } from "@/src/types/supabase";

type Work = Tables<"works">;

export type WorkToolItem = { name: string; icon_url: string | null };

type WorkDetailHeaderProps = {
  work: Work;
  skills: string[];
  tools: WorkToolItem[];
  screenshots: string[];
};

/* ------------------------------------------------------------------ *
 * デバイスモック（iPhone 風 CSS フレーム・最大2枚を横並び）
 * ------------------------------------------------------------------ */

const DeviceMock: FC<{ src: string; onClick?: () => void }> = ({ src, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="スクリーンショットを拡大表示"
    className="w-[126px] shrink-0 aspect-[126/257] cursor-zoom-in overflow-hidden rounded-[24px] border-[3px] border-[#0a0a0a] bg-[#0a0a0a] shadow-xl"
  >
    <img src={src} alt="" className="h-full w-full object-cover" />
  </button>
);

/* ------------------------------------------------------------------ *
 * スクリーンショット拡大ライトボックス（全画面ボタンで開く）
 * ------------------------------------------------------------------ */

const ScreenshotLightbox: FC<{ shots: string[]; onClose: () => void }> = ({ shots, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex cursor-pointer items-center justify-center gap-6 overflow-auto p-10"
      style={{ backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      {shots.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          className="max-h-[90vh] w-auto rounded-[24px] border-[3px] border-[#0a0a0a] object-contain"
        />
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * 上部ブロック本体（Figma 787:9916 / _ProjectContents のブロック①②）
 * ------------------------------------------------------------------ */

const WorkDetailHeader: FC<WorkDetailHeaderProps> = ({ work, skills, tools, screenshots }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [vizModal, setVizModal] = useState<"timeline" | "stakeholders" | null>(null);
  // icon_url が読み込み失敗したツールはテキスト Tag へフォールバックする
  const [brokenIcons, setBrokenIcons] = useState<Record<string, boolean>>({});
  const shots = screenshots.length > 0 ? screenshots : work.thumbnail_url ? [work.thumbnail_url] : [];
  // 「全画面」ボタンで開く構造化ビジュアル（データが無ければボタン自体を非表示）。
  // jsonb のパースは該当カラムが変わったときだけ（WorkEditor と同じ useMemo 規約）
  const timeline = useMemo(() => parseTimeline(work.timeline), [work.timeline]);
  const stakeholders = useMemo(() => parseStakeholders(work.stakeholders), [work.stakeholders]);

  return (
    <div className="flex w-full flex-col gap-12">
      {/* デバイスモック（最大2枚） */}
      {shots.length > 0 && (
        <div className="flex w-full items-start justify-center gap-6">
          {shots.slice(0, 2).map((src, i) => (
            <DeviceMock key={i} src={src} onClick={() => setLightboxOpen(true)} />
          ))}
        </div>
      )}

      {/* カテゴリ + タイトル + メタ表 + Skills/Tools */}
      <div className="flex w-full flex-col gap-6">
        <div className="flex w-full flex-col gap-2 [word-break:break-word]">
          {work.category && <p className="text-body-03-jp text-primary">{work.category}</p>}
          <p className="text-title-pj text-white">{work.title}</p>
        </div>

        {/* メタ表。ラベル列の下限は Figma（902:9343）の 93px。
            93px 固定にすると、ブラウザの既定フォントサイズを上げたとき
            アイコン(h-4)・gap(gap-2)・padding(px-4) だけが rem で拡大して
            ラベル文字(12px 固定)が収まらなくなり、「関係者」が仕切り線を越える
            （root 24px で実測）。minmax にして下限だけ固定する。 */}
        <div className="grid w-full grid-cols-[minmax(93px,auto)_minmax(0,1fr)] overflow-hidden rounded-r8 border border-border">
          {/* 期間 */}
          <div className="flex h-10 items-center gap-2 border-b border-border bg-surface-light px-4">
            <Icon
              set="Time"
              name="calendar-three"
              className="h-4 w-4 shrink-0"
              tintColor="var(--color-system-500)"
              aria-hidden
            />
            <span className="text-[12px] font-bold leading-[1.5] tracking-[0.36px] whitespace-nowrap text-fg-muted">
              期間
            </span>
          </div>
          <div className="flex h-10 items-center gap-2 border-b border-border border-l bg-surface-light px-4">
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
                className="relative ml-auto flex size-6 shrink-0 items-center justify-center rounded-r8 border border-border bg-surface p-[6px] transition-colors hover:border-system-500 before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
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
          </div>

          {/* 役割 */}
          <div className="flex h-10 items-center gap-2 border-b border-border bg-surface-light px-4">
            <Icon
              set="Peoples"
              name="people"
              className="h-4 w-4 shrink-0"
              tintColor="var(--color-system-500)"
              aria-hidden
            />
            <span className="text-[12px] font-bold leading-[1.5] tracking-[0.36px] whitespace-nowrap text-fg-muted">
              役割
            </span>
          </div>
          <div className="flex h-10 items-center gap-2 border-b border-border border-l bg-surface-light px-4">
            <span className="min-w-0 truncate text-body-03-jp text-fg-muted" title={work.role ?? undefined}>
              {work.role || "—"}
            </span>
          </div>

          {/* 関係者 */}
          <div className="flex h-10 items-center gap-2 bg-surface-light px-4">
            <Icon
              set="Peoples"
              name="every-user"
              className="h-4 w-4 shrink-0"
              tintColor="var(--color-system-500)"
              aria-hidden
            />
            <span className="text-[12px] font-bold leading-[1.5] tracking-[0.36px] whitespace-nowrap text-fg-muted">
              関係者
            </span>
          </div>
          <div className="flex h-10 items-center gap-2 border-l border-border bg-surface-light px-4">
            <span className="min-w-0 truncate text-body-03-jp text-fg-muted" title={work.stakeholder_breakdown ?? undefined}>
              {work.stakeholder_breakdown || "—"}
            </span>
            {stakeholders && (
              <button
                type="button"
                onClick={() => setVizModal("stakeholders")}
                aria-label="ステークホルダー体制を表示"
                className="relative ml-auto flex size-6 shrink-0 items-center justify-center rounded-r8 border border-border bg-surface p-[6px] transition-colors hover:border-system-500 before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
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
          </div>
        </div>

        {/* Skills / Tools */}
        <div className="flex w-full flex-col gap-4">
          {/* Skills */}
          {skills.length > 0 && (
            <div className="flex w-full flex-wrap items-start gap-2">
              {skills.map((s) => (
                <Tag key={s} label={s} variant="tool" />
              ))}
            </div>
          )}

          {/* Tools（icon_url があればアイコン、無ければテキスト Tag） */}
          {tools.length > 0 && (
            <div className="flex w-full flex-wrap items-center gap-2">
              {tools.map((t) =>
                t.icon_url && !brokenIcons[t.name] ? (
                  <img
                    key={t.name}
                    src={t.icon_url}
                    alt={t.name}
                    title={t.name}
                    className="h-4 w-4 shrink-0 object-contain"
                    onError={() => setBrokenIcons((prev) => ({ ...prev, [t.name]: true }))}
                  />
                ) : (
                  <Tag key={t.name} label={t.name} variant="small" />
                )
              )}
            </div>
          )}
        </div>
      </div>

      {lightboxOpen && <ScreenshotLightbox shots={shots} onClose={() => setLightboxOpen(false)} />}

      {vizModal && (
        <WorkVizModal
          kind={vizModal}
          timeline={timeline}
          stakeholders={stakeholders}
          onClose={() => setVizModal(null)}
        />
      )}
    </div>
  );
};

export default WorkDetailHeader;
