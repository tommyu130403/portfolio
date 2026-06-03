"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import Icon from "@/components/Icon";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/supabase";

type CareerItem = Tables<"career_items">;
type EnrichedItem = CareerItem & {
  startVal: number;
  endVal: number;
  startYear: number;
  endYear: number;
  isCurrent: boolean;
};
type WorkLink = { id: string; title: string };

const CHART_START = 2016;
const CHART_TOTAL = 10; // 2016–2026（11 ラベル）
const CHART_YEARS = Array.from({ length: CHART_TOTAL + 1 }, (_, i) => CHART_START + i);
const CURRENT_YEAR = new Date().getFullYear();

/* Figma フォント指定（node 770-6652 準拠）
   period / 年ラベル = Avenir Heavy（英数）、role/company/説明/Works = Noto Sans JP */
const FONT_EN = "Avenir, var(--font-noto-sans-jp), sans-serif";
const FONT_JP = "var(--font-noto-sans-jp), sans-serif";

/* Figma node 770-6652 / 781-9583 準拠カラー */
const C = {
  outerBg: "#1a1a1a",
  cardBg: "#212121", // System/900
  cardBorder: "#424242", // System/800（折りたたみ default）
  cardBorderOpen: "#9e9e9e", // System/500（展開 default）
  currentBg: "#0f2a23",
  currentBorder: "rgba(72,244,190,0.4)", // 折りたたみ current
  currentBorderOpen: "#48f4be", // Main/base（展開 current）
  period: "#b3ffe7", // Main/050
  role: "#48f4be", // Main/base
  company: "#616161", // System/700
  desc: "#9e9e9e", // System/500
  worksLabel: "#616161", // System/700
  worksLink: "#b3ffe7", // Main/050
  worksLinkHover: "#39c89b", // Main/200
  iconArrow: "#9e9e9e",
  badgeBg: "#48f4be",
  badgeText: "#212121",
  divider: "rgba(255,255,255,0.05)", // Background/Light-α5
  dot: "#424242", // System/800
  dotActive: "#48f4be", // Main/base
  bar: "#424242", // System/800
  gridLine: "#2a2a2a",
  yearText: "#757575", // System/600
  yearCurrent: "#b3ffe7", // Main/050
  shadowWisper: "0px 1px 1.5px rgba(0,0,0,0.1)",
  shadowStrong: "1px 1px 8px rgba(0,0,0,0.25)",
} as const;

/* 期間文字列を解析（月精度）。
   "2023年12月 - 現在" / "2013年4月 - 2017年3月" / "2022.04 - 現在" などに対応。
   startVal / endVal は CHART_START からの「年単位」値（バー長算出に使用）。 */
function parsePeriod(period: string): {
  startVal: number;
  endVal: number;
  startYear: number;
  endYear: number;
  isCurrent: boolean;
} {
  const [startStr = "", endStr = ""] = period.split(/\s*[-–−~〜]\s*/);
  const parse = (s: string): [number, number] => {
    const m = s.match(/(\d{4})\D*(\d{1,2})?/);
    return [m ? parseInt(m[1], 10) : NaN, m && m[2] ? parseInt(m[2], 10) : NaN];
  };

  const [syRaw, smRaw] = parse(startStr);
  const isCurrent = /現在|present/i.test(endStr);

  let eyRaw: number, emRaw: number;
  if (isCurrent) {
    const now = new Date();
    eyRaw = now.getFullYear();
    emRaw = now.getMonth() + 1;
  } else {
    [eyRaw, emRaw] = parse(endStr);
  }

  const startYear = isNaN(syRaw) ? CHART_START : syRaw;
  const startMonth = isNaN(smRaw) ? 1 : smRaw;
  const endYear = isNaN(eyRaw) ? CURRENT_YEAR : eyRaw;
  const endMonth = isNaN(emRaw) ? 12 : emRaw;

  // 開始は月初 (m-1)/12、終了は月末 m/12 → 連続する経歴のバーが隙間なく接する
  const startVal = startYear - CHART_START + (startMonth - 1) / 12;
  const endVal = endYear - CHART_START + endMonth / 12;

  return { startVal, endVal, startYear, endYear, isCurrent };
}

/* 表示用に Figma 表記へ整形： "2023年12月" / "2022.04" → "2023.12" / "2022.4"（ゼロ埋めなし） */
function formatPeriod(period: string): string {
  return period
    // YYYY年M月 / YYYY.MM → YYYY.M（ゼロ埋め除去）
    .replace(/(\d{4})\s*[年.]\s*(\d{1,2})\s*月?/g, (_, y, m) => `${y}.${parseInt(m, 10)}`)
    // 月欠落の YYYY年 → YYYY（和暦表記の取り残しを防ぐ）
    .replace(/(\d{4})\s*年/g, "$1")
    // 区切りを正規化
    .replace(/\s*[-–−~〜]\s*/g, " - ");
}

function useIsMobile(bp: number) {
  // useSyncExternalStore で matchMedia を購読（SSR は desktop=false を返す）。
  // effect 内同期 setState を避けつつ、ハイドレーション後に正しい値へ同期する。
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(`(max-width: ${bp - 1}px)`);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(`(max-width: ${bp - 1}px)`).matches,
    () => false
  );
}

/* Works リンク列（展開カード内）。デスクトップ・モバイル共通 */
function WorksLinks({
  works,
  onOpenWork,
}: {
  works: WorkLink[];
  onOpenWork: (workId: string) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  if (works.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontFamily: FONT_JP, fontSize: 10, letterSpacing: ".3px", color: C.worksLabel, margin: 0 }}>
        Works
      </p>
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
              <span style={{ fontFamily: FONT_JP, fontSize: 10, letterSpacing: ".3px", color: linkColor, lineHeight: 1.4, transition: "color .15s ease" }}>
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
   CareerCard — デスクトップ（バー下）／モバイル（縦リスト）共通の小型カード
   width: fit-content（min 180 / max 400）で role が 1 行に収まる幅へ。
   開閉は親が制御（バー・レールのドット色と連動）。
   multiline=true（モバイル）では role/company を折り返し、幅は利用可能域まで。
   ────────────────────────────────────────────────────────────────────────── */
function CareerCard({
  item,
  works,
  onOpenWork,
  isOpen,
  onToggle,
  multiline = false,
}: {
  item: EnrichedItem;
  works: WorkLink[];
  onOpenWork: (workId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  multiline?: boolean;
}) {
  const isCurrent = item.isCurrent;
  const borderColor = isOpen
    ? isCurrent
      ? C.currentBorderOpen
      : C.cardBorderOpen
    : isCurrent
      ? C.currentBorder
      : C.cardBorder;

  // role/company の 1 行クランプ（デスクトップ）／折り返し（モバイル）
  const clampStyle = multiline
    ? ({ whiteSpace: "normal", overflowWrap: "anywhere" } as const)
    : ({ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as const);

  return (
    <div
      onClick={onToggle}
      style={{
        width: "fit-content",
        minWidth: 180,
        maxWidth: multiline ? "100%" : 400,
        boxSizing: "border-box",
        borderRadius: 10,
        border: `1px solid ${borderColor}`,
        background: isCurrent ? C.currentBg : C.cardBg,
        boxShadow: isOpen ? C.shadowStrong : C.shadowWisper,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        position: "relative",
        transition: "border-color .2s ease, box-shadow .2s ease",
      }}
    >
      {/* ヘッダー（期間行 + 役職 + 会社）— Figma: gap 6 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* 期間行 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Icon set="Time" name="calendar-three-mint" style={{ width: 12, height: 12, flexShrink: 0 }} />
            <span style={{ fontFamily: FONT_EN, fontWeight: 800, color: C.period, fontSize: 11, letterSpacing: ".33px", lineHeight: 1, whiteSpace: "nowrap" }}>
              {formatPeriod(item.period)}
            </span>
            {isCurrent && (
              <span style={{ background: C.badgeBg, color: C.badgeText, fontSize: 9, lineHeight: 1, padding: "3px 7px", borderRadius: 9999, whiteSpace: "nowrap", flexShrink: 0 }}>
                現在
              </span>
            )}
          </div>
          <Icon
            set="Arrows"
            name={isOpen ? "up" : "down"}
            tintColor={C.iconArrow}
            style={{ width: 12, height: 12, flexShrink: 0 }}
          />
        </div>

        {/* 役職 — Noto Sans JP Bold */}
        <p style={{ fontFamily: FONT_JP, fontWeight: 700, color: C.role, fontSize: 13, lineHeight: 1.5, letterSpacing: ".39px", margin: 0, ...clampStyle }}>
          {item.role}
        </p>
        {/* 会社 — Noto Sans JP Regular */}
        <p style={{ fontFamily: FONT_JP, color: C.company, fontSize: 10, lineHeight: "normal", letterSpacing: ".3px", margin: 0, ...clampStyle }}>
          {item.company}
        </p>
      </div>

      {/* アコーディオン（区切り線 + 説明 + Works）— width:0/minWidth:100% で
         カード幅は role に依存させつつ、内部は幅いっぱいに折り返す */}
      <div
        style={{
          width: 0,
          minWidth: "100%",
          maxHeight: isOpen ? 2000 : 0,
          opacity: isOpen ? 1 : 0,
          overflow: "hidden",
          transition: "max-height .3s ease, opacity .2s ease",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12 }}>
          <div style={{ height: 1, width: "100%", background: C.divider }} />
          {item.description && (
            <p style={{ fontFamily: FONT_JP, color: C.desc, fontSize: 11, lineHeight: 1.5, letterSpacing: ".33px", margin: 0, overflowWrap: "anywhere" }}>
              {item.description}
            </p>
          )}
          <WorksLinks works={works} onOpenWork={onOpenWork} />
        </div>
      </div>
    </div>
  );
}

/* タイムラインのドット（中空丸）。展開中は mint。 */
function Dot({ active }: { active: boolean }) {
  return (
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        border: `2px solid ${active ? C.dotActive : C.dot}`,
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Desktop row — 期間でバーが伸縮し、その下に fit-content カードを配置
   ────────────────────────────────────────────────────────────────────────── */
function CareerRowDesktop({
  item,
  works,
  onOpenWork,
}: {
  item: EnrichedItem;
  works: WorkLink[];
  onOpenWork: (workId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // バー長 = 期間スパン（2016 以前開始は左端でクランプ）
  const s = Math.max(0, Math.min(CHART_TOTAL, item.startVal));
  const e = Math.max(0, Math.min(CHART_TOTAL, item.endVal));
  const left = (s / CHART_TOTAL) * 100;
  // 不正データ（開始 > 終了）でも width が負値（CSS 無効）にならないよう 0 でガード
  const width = Math.max(0, ((e - s) / CHART_TOTAL) * 100);

  // type: current = 右端まで（終点ドットなし）／ prev = 2016 以前開始（始点ドットなし）
  const hasStartDot = item.startYear >= CHART_START;
  const hasEndDot = !item.isCurrent;

  return (
    <div style={{ position: "relative", width: "100%", zIndex: isOpen ? 2 : 1 }}>
      <div style={{ marginLeft: `${left}%`, width: `${width}%`, minWidth: 8, display: "flex", flexDirection: "column", gap: 11 }}>
        {/* バー行 */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, width: "100%" }}>
          {hasStartDot && <Dot active={isOpen} />}
          <div style={{ flex: 1, minWidth: 0, height: 2, background: C.bar, borderRadius: 2 }} />
          {hasEndDot && <Dot active={isOpen} />}
        </div>
        {/* カード（バー左端に揃え、px-16 インセット） */}
        <div style={{ paddingLeft: 16, paddingRight: 16 }}>
          <CareerCard
            item={item}
            works={works}
            onOpenWork={onOpenWork}
            isOpen={isOpen}
            onToggle={() => setIsOpen((o) => !o)}
          />
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Mobile item — 縦タイムラインレール + 共通カード（Figma node 781-9583）
   ────────────────────────────────────────────────────────────────────────── */
function CareerItemMobile({
  item,
  works,
  onOpenWork,
  isFirst,
  isLast,
}: {
  item: EnrichedItem;
  works: WorkLink[];
  onOpenWork: (workId: string) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
      {/* タイムラインレール */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, alignSelf: "stretch", flexShrink: 0 }}>
        <div style={{ width: 2, height: 10, borderRadius: "0 0 2px 2px", background: isFirst ? "transparent" : C.bar, flexShrink: 0 }} />
        <Dot active={isOpen} />
        <div style={{ width: 2, flex: 1, minHeight: 1, borderRadius: "2px 2px 0 0", background: isLast ? "transparent" : C.bar }} />
      </div>
      {/* カード */}
      <div style={{ paddingBottom: 16, minWidth: 0, flex: 1 }}>
        <CareerCard
          item={item}
          works={works}
          onOpenWork={onOpenWork}
          isOpen={isOpen}
          onToggle={() => setIsOpen((o) => !o)}
          multiline
        />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Main export
   ────────────────────────────────────────────────────────────────────────── */
export default function CareerGanttChart({ career }: { career: CareerItem[] }) {
  const [worksByCareer, setWorksByCareer] = useState<Record<string, WorkLink[]>>({});
  const isMobile = useIsMobile(728);

  // career_item_id で works をグルーピング → カード別 Works リンク
  useEffect(() => {
    let active = true;
    supabase
      .from("works")
      .select("id, title, career_item_id, sort_order")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        const map: Record<string, WorkLink[]> = {};
        for (const w of data ?? []) {
          if (!w.career_item_id) continue;
          (map[w.career_item_id] ??= []).push({ id: w.id, title: w.title });
        }
        setWorksByCareer(map);
      });
    return () => {
      active = false;
    };
  }, []);

  // Works リンククリック → Works セクションへスクロール＋モーダル展開イベント
  const handleOpenWork = (workId: string) => {
    const target = document.getElementById("works");
    target?.scrollIntoView({ behavior: "smooth" });
    window.dispatchEvent(new CustomEvent("portfolio:open-work", { detail: { workId } }));
  };

  const enriched: EnrichedItem[] = career.map((item) => ({ ...item, ...parsePeriod(item.period) }));
  // 古い順（上）→ 新しい順（下）
  const oldestFirst = [...enriched].sort((a, b) => a.startVal - b.startVal);

  if (isMobile) {
    // モバイルは新しい順（上）→ 古い順（下）
    const newestFirst = [...oldestFirst].reverse();
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {newestFirst.map((item, i) => (
          <CareerItemMobile
            key={item.id}
            item={item}
            works={worksByCareer[item.id] ?? []}
            onOpenWork={handleOpenWork}
            isFirst={i === 0}
            isLast={i === newestFirst.length - 1}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", width: "100%" }}>
      <div style={{ background: C.outerBg, borderRadius: 14, padding: 24, minWidth: 640 }}>
        {/* 年ラベル行 */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${CHART_YEARS.length}, 1fr)`, marginBottom: 8 }}>
          {CHART_YEARS.map((year, i) => (
            <div
              key={year}
              style={{
                fontFamily: FONT_EN,
                fontWeight: 800,
                fontSize: 11,
                color: year === CURRENT_YEAR ? C.yearCurrent : C.yearText,
                letterSpacing: ".33px",
                textAlign: "center",
                borderLeft: i === 0 ? "none" : `1px solid ${C.gridLine}`,
                paddingTop: 2,
              }}
            >
              {year}
            </div>
          ))}
        </div>

        {/* チャート本体 */}
        <div style={{ position: "relative" }}>
          {/* 縦グリッド線 */}
          <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: `repeat(${CHART_YEARS.length}, 1fr)`, pointerEvents: "none" }}>
            {CHART_YEARS.map((_, i) => (
              <div key={i} style={{ borderLeft: i === 0 ? "none" : `1px solid ${C.gridLine}` }} />
            ))}
          </div>

          {/* バー列 */}
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12, padding: "8px 0" }}>
            {oldestFirst.map((item) => (
              <CareerRowDesktop
                key={item.id}
                item={item}
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
