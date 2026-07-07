"use client";

import { type FC, useEffect, useMemo, useState } from "react";
import Icon from "./Icon";
import Tag from "./Tag";
import WorkVizModal from "./WorkVizModal";
import { parseTimeline, parseStakeholders } from "./WorkViz";
import type { Tables } from "@/src/types/supabase";

type Work = Tables<"works">;

export type WorkToolItem = { name: string; icon_url: string | null };

type WorkDetailLeftPanelProps = {
  work: Work;
  skills: string[];
  tools: WorkToolItem[];
  screenshots: string[];
  /** 「‹ Works」戻りリンク押下 */
  onBack: () => void;
};

const META_TEXT =
  "text-[11px] leading-[1.5] tracking-[0.33px] text-system-500 [word-break:break-word]";

/* ------------------------------------------------------------------ *
 * デバイスモック（iPhone 風 CSS フレーム・最大2枚を横並び）
 * ------------------------------------------------------------------ */

const DeviceMock: FC<{ src: string; onClick?: () => void }> = ({ src, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="スクリーンショットを拡大表示"
    className="aspect-[159/323] w-[159px] max-w-full shrink cursor-zoom-in overflow-hidden rounded-[24px] border-[3px] border-[#0a0a0a] bg-[#0a0a0a] shadow-xl"
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
 * 左パネル本体
 * ------------------------------------------------------------------ */

const WorkDetailLeftPanel: FC<WorkDetailLeftPanelProps> = ({
  work,
  skills,
  tools,
  screenshots,
  onBack,
}) => {
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
    <div className="flex w-full shrink-0 flex-col items-start gap-10 py-10 lg:w-[416px]">
      {/* 戻りリンク */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-system-500 transition-colors hover:text-white"
        aria-label="Works一覧へ戻る"
      >
        <Icon set="Arrows" name="left" tintColor="currentColor" className="h-2 w-2 shrink-0" aria-hidden />
        <span className="font-guide text-[12px] leading-[1.3] tracking-[0.6px]">Works</span>
      </button>

      {/* デバイスモック（最大2枚） */}
      {shots.length > 0 && (
        <div className="flex w-full items-start justify-center gap-6">
          {shots.slice(0, 2).map((src, i) => (
            <DeviceMock key={i} src={src} onClick={() => setLightboxOpen(true)} />
          ))}
        </div>
      )}

      {/* カテゴリ + タイトル + サマリー + メタ */}
      <div className="flex w-full flex-col gap-8">
        <div className="flex w-full flex-col gap-2 [word-break:break-word]">
          {work.category && (
            <p className="text-[11px] font-normal leading-[1.5] tracking-[0.33px] text-main-100">
              {work.category}
            </p>
          )}
          <p className="font-body text-[40px] font-bold leading-[1.1] tracking-[1.2px] text-white">
            {work.title}
          </p>
        </div>

        {work.summary && (
          <p className="w-full text-[13px] leading-[1.5] tracking-[0.39px] text-system-500 [word-break:break-word]">
            {work.summary}
          </p>
        )}

        {/* メタ群 */}
        <div className="flex w-full flex-col gap-4">
          {/* 期間 + Timeline モーダルを開く全画面ボタン（期間が空でも timeline があれば表示） */}
          {(work.period || timeline) && (
            <div className="flex w-full items-center gap-2">
              <Icon set="Time" name="calendar-three" tintColor="#9e9e9e" className="h-5 w-5 shrink-0" aria-hidden />
              {work.period && <span className={META_TEXT}>{work.period}</span>}
              {timeline && (
                <button
                  type="button"
                  onClick={() => setVizModal("timeline")}
                  aria-label="タイムライン（RACI）を表示"
                  className="flex size-6 shrink-0 items-center justify-center rounded-[8px] border border-system-800 bg-system-900 p-[6px] transition-colors hover:border-system-500"
                >
                  <Icon set="Arrows" name="full-screen-two" tintColor="#9e9e9e" className="h-full w-full" aria-hidden />
                </button>
              )}
            </div>
          )}

          {/* 役割 */}
          {work.role && (
            <div className="flex w-full items-start gap-2">
              <Icon set="Peoples" name="people" tintColor="#9e9e9e" className="h-5 w-5 shrink-0" aria-hidden />
              <span className={META_TEXT}>{work.role}</span>
            </div>
          )}

          {/* 体制内訳 + Stakeholder モーダルを開く全画面ボタン（右端。内訳が空でも stakeholders があれば表示） */}
          {(work.stakeholder_breakdown || stakeholders) && (
            <div className="flex w-full items-start gap-2">
              <Icon set="Peoples" name="every-user" tintColor="#9e9e9e" className="h-[22px] w-[22px] shrink-0" aria-hidden />
              {work.stakeholder_breakdown && (
                <span className={`flex-1 ${META_TEXT}`}>{work.stakeholder_breakdown}</span>
              )}
              {stakeholders && (
                <button
                  type="button"
                  onClick={() => setVizModal("stakeholders")}
                  aria-label="ステークホルダー体制を表示"
                  className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-[8px] border border-system-800 bg-system-900 p-[6px] transition-colors hover:border-system-500"
                >
                  <Icon set="Arrows" name="full-screen-two" tintColor="#9e9e9e" className="h-full w-full" aria-hidden />
                </button>
              )}
            </div>
          )}

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

      {/* サイトリンクカード */}
      {work.site_url && (
        <a
          href={work.site_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center rounded-[16px] border border-system-800 transition-colors hover:border-system-500"
        >
          {work.site_thumbnail_url && (
            <div className="h-16 w-20 shrink-0 overflow-hidden rounded-l-[16px]">
              <img src={work.site_thumbnail_url} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="flex flex-1 items-center justify-between gap-2 px-4 py-2 [word-break:break-word]">
            <div className="flex min-w-0 flex-col">
              <p className="truncate text-[13px] leading-[1.5] tracking-[0.39px] text-system-500">
                {work.site_title || work.site_url}
              </p>
              <p className="truncate text-[10px] leading-[normal] tracking-[0.3px] text-[#757575]">
                {work.site_url}
              </p>
            </div>
            <Icon set="Arrows" name="efferent-four" tintColor="#9e9e9e" className="h-4 w-4 shrink-0" aria-hidden />
          </div>
        </a>
      )}

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

export default WorkDetailLeftPanel;
