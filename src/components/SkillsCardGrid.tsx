"use client";

import { useState, useRef, useEffect, type CSSProperties } from "react";
import Icon from "@/components/Icon";
import type { IconProps } from "@/components/Icon";

// ──────────────────────────────────────────────
// Data types
// ──────────────────────────────────────────────
type SkillBarConfig = {
  label: string;
  segments: number;     // 1–10 の塗りつぶしセグメント数
  level: string;        // 例: "Lv.3 Senior"
  description?: string; // 展開時に表示する説明
};

type ToolTagConfig = {
  name: string;
  years: string; // 例: "5年", "10年~"
};

type SkillCardConfig = {
  icon: { set: NonNullable<IconProps["set"]>; name: string };
  title: string;
  titleJP: string;
  skills: SkillBarConfig[];
  tools: ToolTagConfig[];
};

// ──────────────────────────────────────────────
// Static card data (portfolio content)
// ──────────────────────────────────────────────
const SKILL_CARDS: SkillCardConfig[] = [
  {
    icon: { set: "Edit", name: "writing-fluently" },
    title: "Execution",
    titleJP: "制作・実行",
    skills: [
      { label: "UIデザイン (SaaS・Application) デザイン", segments: 8, level: "Lv.4 Lead" },
      { label: "WEB (オウンドメディア・サービスサイト) デザイン", segments: 6, level: "Lv.3 Senior" },
      { label: "LP デザイン", segments: 4, level: "Lv.2 Mid" },
    ],
    tools: [
      { name: "Figma", years: "5年" },
      { name: "Illustrator", years: "10年~" },
      { name: "Photoshop", years: "10年~" },
      { name: "STUDIO", years: "3年" },
    ],
  },
  {
    icon: { set: "Edit", name: "writing-fluently" },
    title: "Technology",
    titleJP: "開発・AI共創",
    skills: [
      {
        label: "プロジェクトマネジメント (アジャイル開発・スクラム開発)",
        segments: 7,
        level: "Lv.4 Lead",
      },
      {
        label: "フロントエンド開発",
        segments: 5,
        level: "Lv.3 Senior",
        description:
          "Next.jsの環境にてReact・Typescriptなどを用いたプロダクトの実装、デザインシステム構築過程におけるコンポーネント実装など。",
      },
    ],
    tools: [{ name: "Github", years: "10年以上" }],
  },
  {
    icon: { set: "Abstract", name: "coordinate-system" },
    title: "Business",
    titleJP: "事業貢献",
    skills: [{ label: "プロダクトマネジメント", segments: 5, level: "Lv.3 Senior" }],
    tools: [],
  },
  {
    icon: { set: "Peoples", name: "every-user" },
    title: "People",
    titleJP: "育成・採用・コミュニケーション",
    skills: [],
    tools: [],
  },
  {
    icon: { set: "Peoples", name: "every-user" },
    title: "Organization",
    titleJP: "組織開発",
    skills: [],
    tools: [],
  },
  {
    icon: { set: "Abstract", name: "coordinate-system" },
    title: "Strategy",
    titleJP: "課題定義・リサーチ",
    skills: [
      { label: "UXリサーチ", segments: 5, level: "Lv.3 Senior" },
      { label: "UX設計 (UXメトリクス定義)", segments: 5, level: "Lv.3 Senior" },
      { label: "CVR改善・施策立案 (CRO・EFO・ASO)", segments: 7, level: "Lv.4 Lead" },
    ],
    tools: [
      { name: "Google Analytics", years: "7年" },
      { name: "Google Optimize", years: "7年" },
      { name: "Looker Studio", years: "3年" },
      { name: "Gemini", years: "1年未満" },
    ],
  },
];

const N        = SKILL_CARDS.length; // 6
const GAP      = 24;                 // px (gap-6)
const DURATION = 350;                // ms
const CARD_H   = 520;                // px — 固定カード高さ

// ──────────────────────────────────────────────
// _SkillExperienceBar
// ──────────────────────────────────────────────
const SkillExperienceBar = ({ label, segments, level, description }: SkillBarConfig) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col w-full">
      {/* メイン行: ラベル + バー + トグル */}
      <div className="flex items-center justify-between w-full gap-3">
        {/* 左: ラベル・バー・レベルバッジ */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <p className="text-[10px] leading-none text-white">{label}</p>
          <div className="flex gap-2 items-center">
            {/* セグメントバー */}
            <div className="flex gap-px items-center shrink-0">
              {Array.from({ length: segments }).map((_, i) => {
                const isLast = i === segments - 1;
                return (
                  <div
                    key={i}
                    className={[
                      "bg-[#b3ffe7] h-[8px] w-[24px] shrink-0",
                      isLast
                        ? "rounded-tl-[1px] rounded-bl-[1px] rounded-tr-[8px] rounded-br-[8px]"
                        : "rounded-[1px]",
                    ].join(" ")}
                  />
                );
              })}
            </div>
            {/* レベルバッジ */}
            <div className="bg-[rgba(0,0,0,0.25)] flex items-center justify-center px-2 py-1 rounded-full shrink-0">
              <span className="text-[10px] leading-4 text-[#9e9e9e] whitespace-nowrap">{level}</span>
            </div>
          </div>
        </div>
        {/* トグルボタン (説明がある場合のみ) */}
        {description && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className={[
              "flex items-center justify-center shrink-0 size-[24px] rounded-[8px] transition-colors",
              expanded ? "bg-[rgba(255,255,255,0.05)]" : "",
            ].join(" ")}
          >
            <Icon
              set="Arrows"
              name="down-small"
              className={[
                "h-[16px] w-[16px] transition-transform duration-200",
                expanded ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>
        )}
      </div>
      {/* 展開時の説明 */}
      {expanded && description && (
        <div className="mt-3 bg-[#212121] border border-[#424242] rounded-[14px] overflow-hidden">
          <div className="p-4">
            <p className="text-[12px] leading-[1.5] tracking-[0.36px] text-[#9e9e9e]">{description}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────
// _SkillTag
// ──────────────────────────────────────────────
const SkillTag = ({ name, years }: ToolTagConfig) => (
  <div className="bg-[rgba(0,0,0,0.25)] flex gap-2 items-center px-2 py-1 rounded-[8px] shrink-0">
    <div className="flex gap-1 items-center">
      <Icon set="Edit" name="more-four" className="h-3 w-3 shrink-0" />
      <span className="text-[10px] leading-none text-white whitespace-nowrap">{name}</span>
    </div>
    <div className="h-[18px] w-px bg-[#424242]" />
    <span className="text-[10px] leading-none text-[#9e9e9e] whitespace-nowrap">{years}</span>
  </div>
);

// ──────────────────────────────────────────────
// _SkillCard
// ──────────────────────────────────────────────
const SkillCard = ({ icon, title, titleJP, skills, tools }: SkillCardConfig) => (
  <div className="bg-[rgba(0,0,0,0.25)] rounded-[14px] overflow-hidden w-full h-full">
    <div className="flex flex-col gap-10 px-6 py-10 h-full">
      {/* ヘッダー: アイコン + EN タイトル + JP サブタイトル */}
      <div className="flex gap-2 items-center shrink-0">
        <Icon set={icon.set} name={icon.name} className="h-8 w-8 shrink-0" />
        <div className="flex gap-2 items-end">
          <span className="font-bold text-[24px] leading-normal text-[#48f4be] whitespace-nowrap">
            {title}
          </span>
          <span className="text-[11px] leading-normal tracking-[0.33px] text-[#48f4be] whitespace-nowrap pb-[2px]">
            {titleJP}
          </span>
        </div>
      </div>

      {/* スキルバー一覧 */}
      {skills.length > 0 && (
        <div className="flex flex-col gap-6">
          {skills.map((skill, i) => (
            <SkillExperienceBar key={i} {...skill} />
          ))}
        </div>
      )}

      {/* ツールタグ */}
      {tools.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-auto">
          {tools.map((tool) => (
            <SkillTag key={tool.name} {...tool} />
          ))}
        </div>
      )}
    </div>
  </div>
);

// ──────────────────────────────────────────────
// SkillsCardGrid — スライド＋フェードイン カルーセル（ループ対応）
// ──────────────────────────────────────────────
export default function SkillsCardGrid() {
  // leftIdx: 左カードの SKILL_CARDS インデックス（0 〜 N-1、ループ）
  const [leftIdx, setLeftIdx]   = useState(0);
  const [phase, setPhase]       = useState<"idle" | "next" | "prev">("idle");
  const [newIdx, setNewIdx]     = useState<number | null>(null);

  const containerRef  = useRef<HTMLDivElement>(null);
  const trackRef      = useRef<HTMLDivElement>(null);
  const animatingRef  = useRef(false);
  const pendingIdxRef = useRef(0); // アニメーション後に設定する leftIdx

  // カード幅をコンテナ幅から算出（ResizeObserver で追跡）
  const [cardWidth, setCardWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setCardWidth((el.offsetWidth - GAP) / 2);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // phase が変わったらトラックのスライドアニメーションを開始
  useEffect(() => {
    if (phase === "idle") return;
    const track = trackRef.current;
    if (!track || cardWidth === 0) return;

    const amt = cardWidth + GAP;

    if (phase === "next") {
      // Track: [curLeft, curRight, newRight] → translateX: 0 → -amt
      track.style.transition = "none";
      track.style.transform  = "translateX(0)";
      void track.offsetWidth; // force reflow
      track.style.transition = `transform ${DURATION}ms ease-in-out`;
      track.style.transform  = `translateX(-${amt}px)`;
    } else {
      // Track: [newLeft, curLeft, curRight] → translateX: -amt → 0
      track.style.transition = "none";
      track.style.transform  = `translateX(-${amt}px)`;
      void track.offsetWidth;
      track.style.transition = `transform ${DURATION}ms ease-in-out`;
      track.style.transform  = "translateX(0)";
    }

    const timer = setTimeout(() => {
      setLeftIdx(pendingIdxRef.current);
      setNewIdx(null);
      setPhase("idle");
      if (track) {
        track.style.transition = "none";
        track.style.transform  = "translateX(0)";
      }
      animatingRef.current = false;
    }, DURATION);

    return () => clearTimeout(timer);
  }, [phase, cardWidth]);

  const navigate = (newLeftIdx: number, dir: "next" | "prev") => {
    if (animatingRef.current || cardWidth === 0) return;
    animatingRef.current    = true;
    pendingIdxRef.current   = newLeftIdx;
    setNewIdx(dir === "next" ? (newLeftIdx + 1) % N : newLeftIdx);
    setPhase(dir);
  };

  const goNext = () => navigate((leftIdx + 1) % N, "next");
  const goPrev = () => navigate((leftIdx - 1 + N) % N, "prev");
  const goTo   = (i: number) => {
    if (i === leftIdx) return;
    navigate(i, i > leftIdx ? "next" : "prev");
  };

  const leftCard = SKILL_CARDS[leftIdx];
  const rightCard = SKILL_CARDS[(leftIdx + 1) % N];
  const newCard   = newIdx !== null ? SKILL_CARDS[newIdx] : null;

  const cardStyle: CSSProperties = {
    width:     cardWidth > 0 ? `${cardWidth}px` : "calc(50% - 12px)",
    flexShrink: 0,
    height:    `${CARD_H}px`,
  };

  return (
    <div className="w-full flex flex-col">
      {/* カルーセルエリア — 全幅、navボタン用に px-[52px] を確保 */}
      <div className="relative w-full px-[52px]">
        {/* 前へボタン（ループのため常に表示） */}
        <button
          type="button"
          onClick={goPrev}
          className="absolute left-[8px] top-1/2 -translate-y-1/2 z-10 flex items-center justify-center size-[36px] rounded-[8px] bg-[#212121] border border-[#424242] p-[6px]"
        >
          <Icon set="Arrows" name="left" className="h-6 w-6" />
        </button>

        {/* カルーセルトラック（overflow-hidden でクリッピング） */}
        <div
          ref={containerRef}
          className="overflow-hidden w-full"
          style={{ height: `${CARD_H}px` }}
        >
          <div ref={trackRef} className="flex gap-6">
            {/* [prev時] 新しく入ってくる左カード */}
            {phase === "prev" && newCard && (
              <div
                style={cardStyle}
                className="animate-[card-fade-in_0.35s_ease-in-out]"
              >
                <SkillCard {...newCard} />
              </div>
            )}

            {/* 現在の左カード */}
            <div style={cardStyle}>
              <SkillCard {...leftCard} />
            </div>

            {/* 現在の右カード */}
            <div style={cardStyle}>
              <SkillCard {...rightCard} />
            </div>

            {/* [next時] 新しく入ってくる右カード */}
            {phase === "next" && newCard && (
              <div
                style={cardStyle}
                className="animate-[card-fade-in_0.35s_ease-in-out]"
              >
                <SkillCard {...newCard} />
              </div>
            )}
          </div>
        </div>

        {/* 次へボタン（ループのため常に表示） */}
        <button
          type="button"
          onClick={goNext}
          className="absolute right-[8px] top-1/2 -translate-y-1/2 z-10 flex items-center justify-center size-[36px] rounded-[8px] bg-[#212121] border border-[#424242] p-[6px]"
        >
          <Icon set="Arrows" name="right" className="h-6 w-6" />
        </button>
      </div>

      {/* ページドット（N=6 ポジション、ループ対応） */}
      <div className="flex gap-2 justify-center mt-6">
        {Array.from({ length: N }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            className={[
              "size-[6px] rounded-full transition-colors",
              i === leftIdx ? "bg-[#48f4be]" : "bg-[#424242]",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}
