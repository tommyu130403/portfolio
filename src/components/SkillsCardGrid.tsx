"use client";

import { useState, useRef, useEffect, type CSSProperties } from "react";
import Icon from "@/components/Icon";
import type { IconProps } from "@/components/Icon";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/supabase";

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
  id: string;
  icon: { set: NonNullable<IconProps["set"]>; name: string };
  title: string;
  titleJP: string;
  skills: SkillBarConfig[];
  tools: ToolTagConfig[];
};

// DB rows
type SkillCardRow        = Tables<"skill_cards">;
type SkillExperienceRow  = Tables<"skill_experience">;
type SkillToolRow        = Tables<"skill_tools">;
type SkillLevelTokenRow  = Tables<"skill_level_tokens">;

// ──────────────────────────────────────────────
// Supabase fetch helper
// ──────────────────────────────────────────────
type SkillLevelTokenMap = Record<string, { value: string; description: string }>;

async function fetchLevelTokenMap(): Promise<SkillLevelTokenMap> {
  const { data } = await supabase
    .from("skill_level_tokens")
    .select("key,value,description")
    .like("key", "Level.%");

  const rows = (data as Pick<SkillLevelTokenRow, "key" | "value" | "description">[] | null) ?? [];
  return Object.fromEntries(
    rows.map((r) => [
      r.key,
      { value: r.value, description: r.description },
    ]),
  );
}

async function fetchSkillCards(): Promise<SkillCardConfig[]> {
  const [{ data: cards }, { data: bars }, { data: tools }] = await Promise.all([
    supabase.from("skill_cards").select("*").order("sort_order", { ascending: true }),
    supabase.from("skill_experience").select("*").order("sort_order",  { ascending: true }),
    supabase.from("skill_tools").select("*").order("sort_order", { ascending: true }),
  ]);

  if (!cards) return [];

  // 表示用カードからは「辞書用カード（Skill Vocab / Tool Vocab）」を除外する。
  // これらは admin ページ上でのボキャブラリ追加のためのコンテナであり、
  // ポートフォリオ公開ページの Skills セクションには不要なため。
  const visibleCards = (cards as SkillCardRow[]).filter((card) => {
    const t  = card.title?.trim() ?? "";
    const tj = card.title_jp?.trim() ?? "";
    const isVocab =
      t === "Skill Vocab" ||
      t === "Tool Vocab" ||
      tj === "スキル辞書" ||
      tj === "ツール辞書";
    return !isVocab;
  });

  return visibleCards.map((card) => ({
    id:      card.id,
    icon:    { set: card.icon_set as NonNullable<IconProps["set"]>, name: card.icon_name },
    title:   card.title,
    titleJP: card.title_jp,
    skills: (bars as SkillExperienceRow[] ?? [])
      .filter((b) => b.card_id === card.id)
      .map((b) => ({
        label:       b.label_short ?? b.label,
        segments:    b.segments,
        level:       b.level,
        description: b.description ?? undefined,
      })),
    tools: (tools as SkillToolRow[] ?? [])
      .filter((t) => t.card_id === card.id)
      .map((t) => ({ name: t.name, years: t.years })),
  }));
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────
const GAP      = 24;   // px (gap-6)
const DURATION = 350;  // ms
const CARD_H   = 510;  // px — Strategy(4スキル+4ツール)が最大
const CARD_W   = 400;  // px — Figma 仕様の最大カード幅

// ──────────────────────────────────────────────
// _SkillExperienceBar
// ──────────────────────────────────────────────
const SkillExperienceBar = ({
  label,
  segments,
  level,
  description,
  levelTokenMap,
}: SkillBarConfig & { levelTokenMap?: SkillLevelTokenMap }) => {
  const [expanded, setExpanded] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const levelKeyMatch = String(level ?? "").match(/^Lv\.(\d+)\b/);
  const levelKey = levelKeyMatch ? `Level.${levelKeyMatch[1]}` : undefined;
  const levelToken = levelKey ? levelTokenMap?.[levelKey] : undefined;
  const levelLabel = levelToken?.value ?? level;
  const levelTooltip = levelToken?.description;

  return (
    <div className="flex flex-col w-full relative">
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
            <div
              className="bg-[rgba(0,0,0,0.25)] flex items-center justify-center px-2 py-1 rounded-full shrink-0 relative"
              onMouseEnter={() => setTooltipOpen(true)}
              onMouseLeave={() => setTooltipOpen(false)}
              onFocus={() => setTooltipOpen(true)}
              onBlur={() => setTooltipOpen(false)}
              tabIndex={0}
            >
              <span className="text-[10px] leading-4 text-[#9e9e9e] whitespace-nowrap">{levelLabel}</span>
              {levelTooltip && (
                <div
                  className={[
                    "absolute bottom-full left-1/2 -translate-x-1/2 mb-2",
                    tooltipOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
                    "transition-opacity duration-150",
                    "z-50",
                    "bg-[#212121] border border-[#424242] rounded-[14px] overflow-hidden",
                    "shadow-[1px_1px_16px_2px_rgba(0,0,0,0.25)]",
                    "px-4 py-3",
                    "w-[360px] max-w-[calc(100vw-32px)]",
                  ].join(" ")}
                  role="tooltip"
                  onMouseEnter={() => setTooltipOpen(true)}
                  onMouseLeave={() => setTooltipOpen(false)}
                >
                  <p className="text-[12px] leading-[1.5] tracking-[0.36px] text-[#9e9e9e]">
                    {levelTooltip}
                  </p>
                </div>
              )}
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
        <div
          className={[
            "absolute left-0 right-0 top-full mt-3",
            "bg-[#212121] border border-[#424242] rounded-[14px] overflow-hidden",
            "shadow-[1px_1px_16px_2px_rgba(0,0,0,0.25)]",
            "z-20",
          ].join(" ")}
        >
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
const SkillCard = ({
  icon,
  title,
  titleJP,
  skills,
  tools,
  levelTokenMap,
}: SkillCardConfig & { levelTokenMap?: SkillLevelTokenMap }) => (
  <div className="bg-[#1a1a1a] rounded-[14px] overflow-hidden w-full h-full">
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
            <SkillExperienceBar key={i} {...skill} levelTokenMap={levelTokenMap} />
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
// SkillsCardGrid — 中央寄せ peek カルーセル（ループ対応）
// アクティブカード(446px)を中央表示し、左右に隣接カードをチラ見せ
// ──────────────────────────────────────────────
export default function SkillsCardGrid() {
  const [cards, setCards]         = useState<SkillCardConfig[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [phase, setPhase]         = useState<"idle" | "next" | "prev">("idle");
  const [containerWidth, setContainerWidth] = useState(0);
  const [levelTokenMap, setLevelTokenMap] = useState<SkillLevelTokenMap>({});

  const containerRef  = useRef<HTMLDivElement>(null);
  const trackRef      = useRef<HTMLDivElement>(null);
  const animatingRef  = useRef(false);
  const pendingIdxRef = useRef(0);

  // DB からカードデータを取得
  useEffect(() => {
    Promise.all([fetchSkillCards(), fetchLevelTokenMap()]).then(([data, map]) => {
      setCards(data);
      setLevelTokenMap(map);
      setLoading(false);
    });
  }, []);

  // コンテナ幅を ResizeObserver で計測
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.offsetWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const N = cards.length;

  // カード幅: Figma 最大 446px、コンテナが狭い場合は縮小（最小 peek 80px×2 + gap を確保）
  const cardWidth = Math.min(CARD_W, Math.max(0, containerWidth - 160 - GAP));

  // アクティブカードを中央に配置するためのオフセット
  // card[1] を中央にする: translateX = centerOffset - (cardWidth + GAP)
  const centerOffset   = containerWidth > 0 ? (containerWidth - cardWidth) / 2 : 0;
  const idleTranslateX = centerOffset - (cardWidth + GAP);

  // containerWidth が変わったらトラックを即座に中央位置へスナップ
  useEffect(() => {
    const track = trackRef.current;
    if (!track || containerWidth === 0 || phase !== "idle") return;
    track.style.transition = "none";
    track.style.transform  = `translateX(${idleTranslateX}px)`;
  }, [containerWidth, idleTranslateX, phase]);

  // phase が変わったらスライドアニメーションを開始
  useEffect(() => {
    if (phase === "idle") return;
    const track = trackRef.current;
    if (!track || containerWidth === 0 || cardWidth === 0) return;

    const amt = cardWidth + GAP;

    if (phase === "next") {
      track.style.transition = "none";
      track.style.transform  = `translateX(${centerOffset - amt}px)`;
      void track.offsetWidth;
      track.style.transition = `transform ${DURATION}ms ease-in-out`;
      track.style.transform  = `translateX(${centerOffset - 2 * amt}px)`;
    } else {
      track.style.transition = "none";
      track.style.transform  = `translateX(${centerOffset - 2 * amt}px)`;
      void track.offsetWidth;
      track.style.transition = `transform ${DURATION}ms ease-in-out`;
      track.style.transform  = `translateX(${centerOffset - amt}px)`;
    }

    const timer = setTimeout(() => {
      setActiveIdx(pendingIdxRef.current);
      setPhase("idle");
      if (track) {
        track.style.transition = "none";
        track.style.transform  = `translateX(${centerOffset - amt}px)`;
      }
      animatingRef.current = false;
    }, DURATION);

    return () => clearTimeout(timer);
  }, [phase, containerWidth, centerOffset, cardWidth]);

  const navigate = (newActiveIdx: number, dir: "next" | "prev") => {
    if (animatingRef.current || containerWidth === 0 || N === 0) return;
    animatingRef.current  = true;
    pendingIdxRef.current = newActiveIdx;
    setPhase(dir);
  };

  const goNext = () => navigate((activeIdx + 1) % N, "next");
  const goPrev = () => navigate((activeIdx - 1 + N) % N, "prev");
  const goTo   = (i: number) => {
    if (i === activeIdx) return;
    navigate(i, i > activeIdx ? "next" : "prev");
  };

  // トラックに並べるカードを構築
  const buildTrack = () => {
    if (N === 0) return [];
    const prev   = cards[(activeIdx - 1 + N) % N];
    const active = cards[activeIdx];
    const next   = cards[(activeIdx + 1) % N];

    if (phase === "next") {
      const newNext = cards[(activeIdx + 2) % N];
      return [
        { card: prev,    fadeIn: false },
        { card: active,  fadeIn: false },
        { card: next,    fadeIn: false },
        { card: newNext, fadeIn: true  },
      ];
    }
    if (phase === "prev") {
      const newPrev = cards[(activeIdx - 2 + N) % N];
      return [
        { card: newPrev, fadeIn: true  },
        { card: prev,    fadeIn: false },
        { card: active,  fadeIn: false },
        { card: next,    fadeIn: false },
      ];
    }
    return [
      { card: prev,   fadeIn: false },
      { card: active, fadeIn: false },
      { card: next,   fadeIn: false },
    ];
  };

  const trackCards = buildTrack();

  const cardStyle: CSSProperties = {
    width:     cardWidth > 0 ? `${cardWidth}px` : `${CARD_W}px`,
    flexShrink: 0,
    height:    `${CARD_H}px`,
  };

  return (
    <div className="w-full flex flex-col">
      {/* カルーセルエリア — containerRef は常に DOM に存在させる（ResizeObserver のため） */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden"
        style={{ height: `${CARD_H}px` }}
      >
        {/* ローディング中はスケルトン表示 */}
        {loading ? (
          <div className="absolute inset-0 animate-pulse rounded-[14px] bg-[#1a1a1a]" />
        ) : (
          <>
            {/* トラック */}
            <div
              ref={trackRef}
              className="flex gap-6 h-full"
              style={{
                transform: containerWidth > 0 ? `translateX(${idleTranslateX}px)` : undefined,
                opacity:   containerWidth > 0 ? 1 : 0,
              }}
            >
              {trackCards.map(({ card, fadeIn }, i) => (
                <div
                  key={`${phase}-${i}-${card.title}`}
                  style={cardStyle}
                  className={fadeIn ? "animate-[card-fade-in_0.35s_ease-in-out]" : ""}
                >
                  <SkillCard {...card} levelTokenMap={levelTokenMap} />
                </div>
              ))}
            </div>

            {/* 前へボタン — カード上に重ねる */}
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-[8px] top-1/2 -translate-y-1/2 z-10 flex items-center justify-center size-[36px] rounded-[8px] bg-[#212121] border border-[#424242] p-[6px]"
            >
              <Icon set="Arrows" name="left" className="h-6 w-6" />
            </button>

            {/* 次へボタン — カード上に重ねる */}
            <button
              type="button"
              onClick={goNext}
              className="absolute right-[8px] top-1/2 -translate-y-1/2 z-10 flex items-center justify-center size-[36px] rounded-[8px] bg-[#212121] border border-[#424242] p-[6px]"
            >
              <Icon set="Arrows" name="right" className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* ページドット */}
      {!loading && (
        <div className="flex gap-2 justify-center mt-6">
          {Array.from({ length: N }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={[
                "size-[6px] rounded-full transition-colors",
                i === activeIdx ? "bg-[#48f4be]" : "bg-[#424242]",
              ].join(" ")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
