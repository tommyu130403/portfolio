"use client";

import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/Icon";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/supabase";

type CareerItem = Tables<"career_items">;
type EnrichedItem = CareerItem & { startYear: number; endYear: number; isCurrent: boolean };
type WorkLink = { id: string; title: string };

const CHART_START = 2016;
const CHART_TOTAL = 10; // 2016–2026
const CHART_YEARS = Array.from({ length: 11 }, (_, i) => CHART_START + i);
const CURRENT_YEAR = new Date().getFullYear();

/* Figma node 770-6279 / 770-6653 準拠カラー（既存コードの未定義 CSS 変数を実 hex に置換） */
const C = {
  outerBg: "#1a1a1a",
  cardBg: "#212121", // System/900 (Background/Default)
  cardBgHover: "#2a2a2a",
  cardBorder: "#424242", // System/800 (Border/Default) — 折りたたみ default
  cardBorderOpen: "#9e9e9e", // System/500 (Border/light) — 展開 default
  currentBg: "#0f2a23",
  currentBgHover: "#143a2e",
  currentBorder: "rgba(72,244,190,0.4)", // 折りたたみ current
  currentBorderOpen: "#48f4be", // Main/100 — 展開 current
  period: "#b3ffe7", // Main/050
  role: "#48f4be", // Main/100
  company: "#9e9e9e", // System/500
  desc: "#9e9e9e", // System/500
  worksLabel: "#616161", // System/700
  worksLink: "#b3ffe7", // Main/050
  worksLinkHover: "#39c89b", // Main/200 — Works リンク hover 時
  iconArrow: "#9e9e9e", // chevron / arrow-right ネイティブ色
  badgeBg: "#48f4be",
  badgeText: "#212121", // System/900
  gridLine: "#2a2a2a",
  yearText: "#757575", // System/600
  yearCurrent: "#b3ffe7",
  divider: "rgba(255,255,255,0.05)", // Background/Light-α5
  // Figma Effects: shadow-wisper(折りたたみ) / shadow(展開)
  shadowWisper: "0px 1px 1.5px rgba(0,0,0,0.1)",
  shadowStrong: "1px 1px 8px rgba(0,0,0,0.25)",
} as const;

// "2022.04 - 現在"  or  "2019.04 - 2022.03"
function parsePeriod(period: string) {
  const [startStr, endStr] = period.split(/\s*[-–−]\s*/);
  const sy = parseInt(startStr?.match(/(\d{4})/)?.[1] ?? "");
  const isCurrent = Boolean(endStr?.trim().includes("現在"));
  const ey = isCurrent ? CURRENT_YEAR : parseInt(endStr?.match(/(\d{4})/)?.[1] ?? "");
  return {
    startYear: isNaN(sy) ? CHART_START : sy,
    endYear:   isNaN(ey) ? CURRENT_YEAR : ey,
    isCurrent,
  };
}

function useIsMobile(bp: number) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < bp : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, [bp]);
  return isMobile;
}

/* Works リンク列（展開カード内）。デスクトップ・モバイル共通 */
function WorksLinks({
  works,
  onOpenWork,
}: {
  works: WorkLink[];
  onOpenWork: (projectId: string) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  if (works.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 2 }}>
      <p style={{ fontSize: 10, letterSpacing: ".3px", color: C.worksLabel, margin: 0 }}>Works</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {works.map((w) => {
          const linkColor = hoveredId === w.id ? C.worksLinkHover : C.worksLink;
          return (
            <button
              key={w.id}
              type="button"
              onMouseEnter={() => setHoveredId(w.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={(e) => {
                e.stopPropagation();
                onOpenWork(w.id);
              }}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 4,
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
              }}
            >
              <Icon
                set="Arrows"
                name="arrow-right"
                tintColor={linkColor}
                style={{ width: 12, height: 12, flexShrink: 0, marginTop: 1, transition: "background-color .15s ease" }}
              />
              <span style={{ fontSize: 10, letterSpacing: ".3px", color: linkColor, lineHeight: 1.4, transition: "color .15s ease" }}>
                {w.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Mobile card — 縦型タイムライン（既存デザイン維持・内容のみ更新）
   timeline: "end"=最新(上)  "middle"=中間  "start"=最古(下)
   ────────────────────────────────────────────────────────────────────────── */
function CareerCardMobile({
  item,
  timeline,
  works,
  onOpenWork,
}: {
  item: EnrichedItem;
  timeline: "end" | "middle" | "start";
  works: WorkLink[];
  onOpenWork: (projectId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const topLineBg    = timeline === "middle" || timeline === "start" ? "#424242" : "transparent";
  const dotBorder    = timeline === "start" ? "#424242" : "#48f4be";
  const bottomLineBg = timeline === "start" ? "transparent" : "#424242";

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      {/* タイムライン列 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, alignSelf: "stretch", flexShrink: 0 }}>
        <div style={{ height: 24, width: 2, flexShrink: 0, borderRadius: "0 0 2px 2px", background: topLineBg }} />
        <div style={{ width: 12, height: 12, border: `2px solid ${dotBorder}`, borderRadius: "50%", flexShrink: 0 }} />
        <div style={{ flex: 1, minHeight: 1, width: 2, borderRadius: "2px 2px 0 0", background: bottomLineBg }} />
      </div>

      {/* カード */}
      <div style={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0, minWidth: 0, paddingBottom: 16 }}>
        <div style={{
          background: item.isCurrent ? "#122e24" : "#1a1a1a",
          borderRadius: 14,
          border: item.isCurrent
            ? "1px solid rgba(72,244,190,0.72)"
            : "1px solid #424242",
          boxShadow: item.isCurrent
            ? "0 0 0 1px rgba(72,244,190,0.12), 0 4px 24px rgba(72,244,190,0.10)"
            : "none",
          overflow: "hidden",
          width: "100%",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 24 }}>
            {/* ヘッダー（期間 / 役職 / 会社） */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon set="Time" name="calendar-three-mint" style={{ width: 16, height: 16, flexShrink: 0 }} />
                <p style={{ fontSize: 11, lineHeight: 1.5, letterSpacing: ".33px", color: C.period, whiteSpace: "nowrap", margin: 0 }}>
                  {item.period}
                </p>
                {item.isCurrent && (
                  <span style={{ background: C.badgeBg, color: "#212121", fontSize: 10, padding: "1px 8px", borderRadius: 9999, flexShrink: 0, lineHeight: 1.6 }}>
                    現在
                  </span>
                )}
              </div>
              <p style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.5, letterSpacing: ".51px", color: C.role, margin: 0 }}>
                {item.role}
              </p>
              <p style={{ fontSize: 11, lineHeight: 1.5, letterSpacing: ".33px", color: C.company, margin: 0 }}>
                {item.company}
              </p>
            </div>

            {/* アコーディオン */}
            <div>
              <button
                onClick={() => setIsOpen((o) => !o)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
              >
                <p style={{ fontSize: 9, letterSpacing: ".6px", textTransform: "uppercase", color: C.worksLabel, margin: 0 }}>
                  Details
                </p>
                <svg
                  width={10} height={10} viewBox="0 0 24 24" fill="none"
                  style={{ flexShrink: 0, opacity: 0.5, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .25s" }}
                >
                  <path d="M6 9l6 6 6-6" stroke="#48f4be" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div style={{ maxHeight: isOpen ? 600 : 0, overflow: "hidden", transition: "max-height .3s ease" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10 }}>
                  {item.description && (
                    <p style={{ fontSize: 11, lineHeight: 1.5, letterSpacing: ".33px", color: "#ffffff", margin: 0 }}>
                      {item.description}
                    </p>
                  )}
                  <WorksLinks works={works} onOpenWork={onOpenWork} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Desktop bar — ガントチャート（期間で伸縮するバーを維持）
   ────────────────────────────────────────────────────────────────────────── */
function CareerBar({
  item,
  index,
  hoveredId,
  setHoveredId,
  works,
  onOpenWork,
}: {
  item: EnrichedItem;
  index: number;
  hoveredId: number | null;
  setHoveredId: (id: number | null) => void;
  works: WorkLink[];
  onOpenWork: (projectId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isHovered = hoveredId === index;

  // 役職・会社テキストの実幅（省略されている分=scrollWidth も含む）を測定し、
  // ホバー or 展開時に「1行で収まる幅」へ拡張するために使う。
  // callback ref で計測することで effect 内 setState を避ける。
  const [naturalContentWidth, setNaturalContentWidth] = useState(0);
  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    let max = 140; // 期間行（アイコン+期間+シェブロン）が収まる最低幅
    node.querySelectorAll<HTMLElement>("[data-measure]").forEach((el) => {
      max = Math.max(max, el.scrollWidth);
    });
    setNaturalContentWidth(max);
  }, []);

  const left  = (item.startYear - CHART_START) / CHART_TOTAL * 100;
  const width = (item.endYear   - item.startYear) / CHART_TOTAL * 100;

  // ホバー中、または展開中は幅を拡張（クリック展開後はホバーが外れても維持）
  const isExpanded = isHovered || isOpen;
  const CARD_PADDING = 24; // 左右 12px ずつ
  const expandedPx = naturalContentWidth + CARD_PADDING + 4;
  // 期間ベースのバー幅(100%)と、テキストが収まる幅の大きい方
  const cardWidth = isExpanded ? `max(100%, ${expandedPx}px)` : "100%";

  // Figma: 展開(toggle)で枠線が明るくなり、影も強くなる
  const borderColor = isOpen
    ? (item.isCurrent ? C.currentBorderOpen : C.cardBorderOpen)
    : (item.isCurrent ? C.currentBorder : C.cardBorder);
  const boxShadow = isOpen ? C.shadowStrong : C.shadowWisper;

  return (
    <div style={{ position: "relative", marginLeft: `${left}%`, width: `${width}%`, minWidth: 180 }}>
      <div
        ref={measureRef}
        onMouseEnter={() => setHoveredId(index)}
        onMouseLeave={() => setHoveredId(null)}
        onClick={() => setIsOpen((o) => !o)}
        style={{
          width: cardWidth,
          borderRadius: 10,
          border: `1px solid ${borderColor}`,
          background: item.isCurrent
            ? (isHovered ? C.currentBgHover : C.currentBg)
            : (isHovered ? C.cardBgHover : C.cardBg),
          boxShadow,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          cursor: "pointer",
          transition: "width .2s ease, background .15s, box-shadow .2s ease, border-color .2s ease",
          boxSizing: "border-box",
          position: "relative",
          zIndex: isExpanded ? 2 : 1,
        }}
      >
        {/* ヘッダー（期間行 + 役職/会社）— Figma: gap 12 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }}>
          {/* 期間行 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon set="Time" name="calendar-three-mint" style={{ width: 12, height: 12, flexShrink: 0 }} />
            <span style={{ color: C.period, fontSize: 11, letterSpacing: ".33px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
              {item.period}
            </span>
            {item.isCurrent && (
              <span style={{ background: C.badgeBg, color: C.badgeText, fontSize: 10, padding: "1px 8px", borderRadius: 9999, flexShrink: 0, lineHeight: 1.6 }}>
                現在
              </span>
            )}
            <Icon
              set="Arrows"
              name={isOpen ? "up" : "down"}
              tintColor={C.iconArrow}
              style={{ width: 12, height: 12, flexShrink: 0, marginLeft: 2 }}
            />
          </div>

          {/* 役職 + 会社 — Figma: gap 8 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p data-measure="role" style={{ color: C.role, fontWeight: 700, fontSize: 15, lineHeight: 1.5, letterSpacing: ".45px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
              {item.role}
            </p>
            <p data-measure="company" style={{ color: C.company, fontSize: 10, lineHeight: "normal", letterSpacing: ".3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
              {item.company}
            </p>
          </div>
        </div>

        {/* アコーディオン：区切り線 + 説明文 + Works（Figma: 各 gap 12） */}
        <div style={{ maxHeight: isOpen ? 600 : 0, overflow: "hidden", transition: "max-height .3s ease, opacity .2s ease", opacity: isOpen ? 1 : 0, flexShrink: 0 }}>
          <div style={{ height: 1, background: C.divider, margin: "12px 0" }} />
          {item.description && (
            <p style={{ fontSize: 11, lineHeight: 1.5, letterSpacing: ".33px", color: C.desc, margin: "0 0 12px 0" }}>
              {item.description}
            </p>
          )}
          <WorksLinks works={works} onOpenWork={onOpenWork} />
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Main export
   ────────────────────────────────────────────────────────────────────────── */
export default function CareerGanttChart({ career }: { career: CareerItem[] }) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [worksByCareer, setWorksByCareer] = useState<Record<string, WorkLink[]>>({});
  const isMobile = useIsMobile(728);

  // career_item_id で projects をグルーピング → カード別 Works リンク
  useEffect(() => {
    let active = true;
    supabase
      .from("projects")
      .select("id, title, career_item_id, sort_order")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        const map: Record<string, WorkLink[]> = {};
        for (const p of data ?? []) {
          if (!p.career_item_id) continue;
          (map[p.career_item_id] ??= []).push({ id: p.id, title: p.title });
        }
        setWorksByCareer(map);
      });
    return () => { active = false; };
  }, []);

  // Works リンククリック → Works セクションへスクロール＋モーダル展開イベント発火（リスナーは WorksList 側）
  const handleOpenWork = (projectId: string) => {
    const target = document.getElementById("works") ?? document.getElementById("projects");
    target?.scrollIntoView({ behavior: "smooth" });
    window.dispatchEvent(new CustomEvent("portfolio:open-work", { detail: { projectId } }));
  };

  const enriched = career.map((item) => ({ ...item, ...parsePeriod(item.period) }));
  // 古い順（上）→ 新しい順（下）
  const reversed = [...enriched].reverse();

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {reversed.map((item, i) => {
          const timeline =
            i === 0 ? "end" :
            i === reversed.length - 1 ? "start" : "middle";
          return (
            <CareerCardMobile
              key={item.id}
              item={item}
              timeline={timeline as "end" | "middle" | "start"}
              works={worksByCareer[item.id] ?? []}
              onOpenWork={handleOpenWork}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", width: "100%" }}>
      <div style={{ background: C.outerBg, borderRadius: 14, padding: 24, minWidth: 640 }}>
        {/* 年ラベル行 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(11, 1fr)", marginBottom: 8 }}>
          {CHART_YEARS.map((year, i) => (
            <div key={year} style={{ fontSize: 11, color: year === CURRENT_YEAR ? C.yearCurrent : C.yearText, letterSpacing: ".33px", textAlign: "center", borderLeft: i === 0 ? "none" : `1px solid ${C.gridLine}`, paddingTop: 2 }}>
              {year}
            </div>
          ))}
        </div>

        {/* チャート本体 */}
        <div style={{ position: "relative" }}>
          {/* 縦グリッド線 */}
          <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "repeat(11, 1fr)", pointerEvents: "none" }}>
            {CHART_YEARS.map((_, i) => (
              <div key={i} style={{ borderLeft: i === 0 ? "none" : `1px solid ${C.gridLine}` }} />
            ))}
          </div>

          {/* バー列 */}
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12, padding: "8px 0" }}>
            {reversed.map((item, i) => (
              <CareerBar
                key={item.id}
                item={item}
                index={i}
                hoveredId={hoveredId}
                setHoveredId={setHoveredId}
                works={worksByCareer[item.id] ?? []}
                onOpenWork={handleOpenWork}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
