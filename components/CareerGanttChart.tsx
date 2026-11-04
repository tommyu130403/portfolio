"use client";

import { useState, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import Icon from "@/components/Icon";
import { ButtonFunction } from "@/components/ButtonFunction";
import { BUTTON_FUNCTION_ICON } from "@/lib/figma-button-variants";
import { supabase } from "@/src/lib/supabase";
import type { Json, Tables } from "@/src/types/supabase";
import WorkPagerCard from "@/components/WorkPagerCard";
import { DEFAULT_IMAGE, parseThumbnail } from "@/lib/work-content";
import { useWorkCategoryHues } from "@/src/lib/work-category-colors";
import { formatPeriodLabel } from "@/lib/work-period";

type CareerItem = Tables<"career_items">;
type EnrichedItem = CareerItem & {
  startVal: number;
  endVal: number;
  startYear: number;
  endYear: number;
  isCurrent: boolean;
};
type WorkLink = {
  id: string;
  title: string;
  category: string | null;
  thumbnail_url: string | null;
  thumbnail: Json | null;
  hero_brand: string | null;
};

const CURRENT_YEAR = new Date().getFullYear();
const CHART_TOTAL = 10; // Figma 770:6432 10列
const CHART_START = CURRENT_YEAR - (CHART_TOTAL - 1);
const CHART_YEARS = Array.from({ length: CHART_TOTAL }, (_, i) => CHART_START + i);
// 詳細パネルの開閉アニメーションの長さ。閉じ終わるまで描画を残す時間と揃える
const PANEL_MS = 300;
// ボトムシートを下へドラッグして閉じるしきい値（px）
const SHEET_CLOSE_DRAG = 100;
// Modal.tsx（z-50）と同じ層。サイドメニュー（sticky z-[2]）より手前に出す
const PANEL_Z = 50;

/* Figma フォント指定（node 770-6652 準拠）
   period / 年ラベル = Avenir Heavy（英数）、role/company/説明/Works = Noto Sans JP */
// FONT_JP は Noto のみ（日本語テキスト用）。FONT_EN は英数字表示用に Avenir を明示する（Avenir の無い端末は Figtree）。
const FONT_EN = "Avenir, var(--font-figtree), var(--font-noto-sans-jp), sans-serif";
const FONT_JP = "var(--font-noto-sans-jp), sans-serif";
// 詳細パネルの見出し用（globals.css の --font-guide と同じ並び。@theme inline の変数は CSS 変数として出ないため実体を直接指定）
const FONT_GUIDE = "var(--font-afacad), var(--font-noto-sans-jp), sans-serif";

/* Figma node 770-6652 / 781-9583 準拠カラー */
const C = {
  // 背景はページと同じ Background/Default。目盛り線を隠すため透明にはせず不透明で塗る。
  // 選択中・ホバー時は他のカードと同じ Action/hover を重ねる（lib/hover-card.ts の HOVER_CARD と同じ見た目）
  cardBg: "var(--color-surface)",
  cardHoverOverlay: "inset 0 0 0 9999px var(--color-action-hover)",
  cardShadowHover: "1px 1px 16px 2px rgba(0, 0, 0, 0.25)", // shadow-base（@theme の --shadow-base は CSS 変数として出ないため実値）
  cardBorder: "var(--color-border)", // Border/Default（System/825）
  cardBorderHover: "var(--color-border-light)", // Border/Light
  cardBorderSelected: "var(--color-border-main)", // Border/Main
  panelBg: "var(--color-surface)", // Background/Default（System/925）
  period: "#9e9e9e", // System/500
  role: "#e0e0e0", // Text/Body/Primary（System/300）
  company: "#616161", // System/700
  desc: "#e0e0e0", // System/300
  muted: "#9e9e9e", // System/500
  caption: "#757575", // System/600
  iconArrow: "#757575", // System/600
  iconArrowCurrent: "#2b9e7a", // Main/300
  label: "#b3ffe7", // Main/050（セクション見出しの和文ラベルと同じ）
  badgeBg: "#48f4be",
  badgeText: "#191919", // Background/Default（System/925）
  divider: "#3a3a3a",
  dot: "#3a3a3a", // Border/Default（System/825）
  dotSelected: "#2b9e7a", // Main/300（開いている経歴）
  dotCurrent: "#48f4be", // Main/base
  bar: "#3a3a3a", // Border/Default（System/825）
  barSelected: "#2b9e7a", // Main/300（開いている経歴）
  gridLine: "#3a3a3a",
  yearText: "#757575", // System/600
  yearCurrent: "#b3ffe7", // Main/050
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

function useMediaQuery(query: string) {
  // useSyncExternalStore で matchMedia を購読（SSR は false を返す）。
  // effect 内同期 setState を避けつつ、ハイドレーション後に正しい値へ同期する。
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

/* 期間行（カレンダーアイコン + 期間 + 現在バッジ）。カードと詳細パネルで共通 */
function PeriodRow({ item }: { item: EnrichedItem }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <Icon set="Time" name="calendar-line" tintColor="var(--color-system-500)" style={{ width: 12, height: 12, flexShrink: 0 }} />
        <span
          style={{
            fontFamily: FONT_EN,
            fontWeight: 800,
            color: C.period,
            fontSize: 11,
            letterSpacing: ".33px",
            lineHeight: 1,
            whiteSpace: "nowrap",
            textBox: "trim-both cap alphabetic",
          }}
        >
          {formatPeriodLabel(item.period)}
        </span>
      </div>
      {item.isCurrent && (
        <span
          style={{
            fontFamily: FONT_JP,
            background: C.badgeBg,
            color: C.badgeText,
            fontSize: 9,
            lineHeight: 1,
            letterSpacing: "0.1172px",
            padding: "3px 7px",
            borderRadius: 9999,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          現在
        </span>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   CareerCard — デスクトップ（バー下）／モバイル（縦リスト）共通の入口カード
   期間・役職・会社だけを見せ、押すと詳細パネルが開く。
   width: 100%（幅は呼び出し側の包み div が決める）。role/company は折り返し。
   ────────────────────────────────────────────────────────────────────────── */
function CareerCard({
  item,
  isSelected,
  isMobile,
  onOpen,
}: {
  item: EnrichedItem;
  isSelected: boolean;
  isMobile: boolean;
  onOpen: () => void;
}) {
  const [hoverRaw, setHovered] = useState(false);
  // タッチ端末ではホバー表示を出さない（タップ後に残り続けるため）
  const canHover = useMediaQuery("(hover: hover) and (pointer: fine)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const hovered = hoverRaw && canHover;
  const active = isSelected || hovered;
  const borderColor = isSelected ? C.cardBorderSelected : hovered ? C.cardBorderHover : C.cardBorder;
  const chevronColor = item.isCurrent ? C.iconArrowCurrent : C.iconArrow;

  // role/company は折り返し（nowrap/ellipsis を付けない。右端切れの原因だったため廃止）
  const clampStyle = { whiteSpace: "normal", overflowWrap: "anywhere" } as const;

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      data-career-card-id={item.id}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        minWidth: 180,
        boxSizing: "border-box",
        textAlign: "left",
        font: "inherit",
        color: "inherit",
        borderRadius: 10,
        border: `1px solid ${borderColor}`,
        background: C.cardBg,
        // 影が隣の行の下に隠れないよう active 中は手前に出し、外したら影が消え終わる 300ms 後に戻す
        position: "relative",
        zIndex: active ? 1 : 0,
        boxShadow: active ? `${C.cardHoverOverlay}, ${C.cardShadowHover}` : "inset 0 0 0 9999px transparent, 0 0 0 0 transparent",
        padding: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
        pointerEvents: "auto",
        transition: reducedMotion
          ? "none"
          : `border-color 300ms ease-out, box-shadow 300ms ease-out, z-index 0s linear ${active ? "0s" : "300ms"}`,
      }}
    >
      {/* 左列（期間行 + 役職 + 会社）— Figma: gap 6 */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <PeriodRow item={item} />
        {/* 役職 — Noto Sans JP Bold */}
        <p style={{ fontFamily: FONT_JP, fontWeight: 700, color: C.role, fontSize: 13, lineHeight: "20px", letterSpacing: ".39px", margin: 0, ...clampStyle }}>
          {item.role}
        </p>
        {/* 会社 — Noto Sans JP Regular */}
        <p style={{ fontFamily: FONT_JP, color: C.company, fontSize: 10, lineHeight: "12px", letterSpacing: ".3px", margin: 0, ...clampStyle }}>
          {item.company}
        </p>
      </div>

      {isMobile ? (
        <span
          aria-hidden
          style={{
            alignSelf: "flex-end",
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            height: 28,
            padding: "0 10px 0 8px",
            borderRadius: 9999,
            border: `1px solid ${C.cardBorder}`,
            boxSizing: "border-box",
          }}
        >
          <Icon set="Arrows" name="up" tintColor={item.isCurrent ? C.iconArrowCurrent : C.muted} style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span style={{ fontFamily: FONT_JP, fontSize: 10, lineHeight: 1, color: C.muted }}>詳細</span>
        </span>
      ) : (
        <Icon set="Arrows" name="right" tintColor={chevronColor} style={{ width: 16, height: 16, flexShrink: 0 }} />
      )}
    </button>
  );
}

/* タイムラインのドット（中空丸）。色は呼び出し側が状態に応じて指定する。 */
function Dot({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        border: `2px solid ${color}`,
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Desktop row — 期間でバーが伸縮し、その下に fit-content カードを配置
   行は固定高。開いている経歴はバーとドットを main-300 にする
   ────────────────────────────────────────────────────────────────────────── */
function CareerRowDesktop({
  item,
  isSelected,
  onOpen,
}: {
  item: EnrichedItem;
  isSelected: boolean;
  onOpen: () => void;
}) {
  // バー長 = 期間スパン（CHART_START 以前開始は左端でクランプ）
  const s = Math.max(0, Math.min(CHART_TOTAL, item.startVal));
  const e = item.isCurrent ? CHART_TOTAL : Math.max(0, Math.min(CHART_TOTAL, item.endVal));
  const left = (s / CHART_TOTAL) * 100;
  // 不正データ（開始 > 終了）でも width が負値（CSS 無効）にならないよう 0 でガード
  const width = Math.max(0, ((e - s) / CHART_TOTAL) * 100);

  // type: current = 右端まで（終点ドットなし）／ prev = CHART_START 以前開始（始点ドットなし）
  const hasStartDot = item.startYear >= CHART_START;
  const hasEndDot = !item.isCurrent;
  const startDotColor = item.isCurrent ? C.dotCurrent : isSelected ? C.dotSelected : C.dot;

  return (
    <div
      // 行の透明部分は下の行へのクリックを素通りさせる。受けるのはレールとカード本体だけ
      style={{
        position: "relative",
        width: "100%",
        height: 112,
        display: "flex",
        flexDirection: "column",
        gap: 11,
        pointerEvents: "none",
      }}
    >
      {/* バー行（レール。位置・幅は Figma の期間バーのまま） */}
      <div style={{ marginLeft: `${left}%`, width: `${width}%`, minWidth: 8, display: "flex", alignItems: "center", gap: 4, pointerEvents: "auto" }}>
        {hasStartDot && <Dot color={startDotColor} />}
        <div style={{ flex: 1, minWidth: 0, height: 2, background: isSelected ? C.barSelected : C.bar, borderRadius: "2px 0 0 2px" }} />
        {hasEndDot && <Dot color={isSelected ? C.dotSelected : C.dot} />}
      </div>
      {/* カード（行の直下）。[スペーサー][カード包み div] の2分割 flex にして、
         カード幅は中身（役職・会社名）に合わせつつ、右端にはみ出す場合はスペーサーが縮んで
         カードが左へ寄る（min-width/max-width の固定値ではなく、実際のテキスト幅で決まる）。 */}
      <div style={{ display: "flex", width: "100%" }}>
        <div style={{ flex: `0 1 ${left}%`, minWidth: 0 }} />
        <div
          style={{
            flex: "0 0 auto",
            width: "max-content",
            minWidth: `max(228px, ${width}%)`,
            maxWidth: 400,
            paddingLeft: 24,
            paddingRight: 24,
            boxSizing: "border-box",
          }}
        >
          <CareerCard item={item} isSelected={isSelected} isMobile={false} onOpen={onOpen} />
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
  isSelected,
  onOpen,
  isFirst,
  isLast,
}: {
  item: EnrichedItem;
  isSelected: boolean;
  onOpen: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
      {/* タイムラインレール */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, alignSelf: "stretch", flexShrink: 0 }}>
        <div style={{ width: 2, height: 10, borderRadius: "0 0 2px 2px", background: isFirst ? "transparent" : C.bar, flexShrink: 0 }} />
        <Dot color={isSelected ? C.dotSelected : C.dot} />
        <div style={{ width: 2, flex: 1, minHeight: 1, borderRadius: "2px 2px 0 0", background: isLast ? "transparent" : C.bar }} />
      </div>
      {/* カード */}
      <div style={{ paddingBottom: 16, minWidth: 0, flex: 1 }}>
        <CareerCard item={item} isSelected={isSelected} isMobile onOpen={onOpen} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   詳細パネルの中身（PC ドロワー・SP ボトムシート共通）
   ────────────────────────────────────────────────────────────────────────── */
function DetailBody({
  item,
  works,
  onOpenWork,
}: {
  item: EnrichedItem;
  works: WorkLink[];
  onOpenWork: () => void;
}) {
  const hues = useWorkCategoryHues();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <PeriodRow item={item} />
        <p style={{ fontFamily: FONT_JP, fontWeight: 700, color: C.role, fontSize: 22, lineHeight: 1.4, letterSpacing: ".96px", margin: 0, overflowWrap: "anywhere" }}>
          {item.role}
        </p>
        <p style={{ fontFamily: FONT_JP, color: C.muted, fontSize: 12, lineHeight: 1.6, letterSpacing: ".36px", margin: 0, overflowWrap: "anywhere" }}>
          {item.company}
        </p>
      </div>
      {(item.description || works.length > 0) && (
        <div style={{ height: 1, width: "100%", background: C.divider }} />
      )}
      {item.description && (
        <p
          style={{
            fontFamily: FONT_JP,
            color: C.desc,
            fontSize: 14,
            lineHeight: 1.9,
            letterSpacing: ".04em",
            margin: 0,
            textWrap: "pretty",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {item.description}
        </p>
      )}
      {works.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontFamily: FONT_EN, fontSize: 10, lineHeight: "12px", letterSpacing: ".4px", textTransform: "uppercase", color: C.caption, margin: 0 }}>
            Works
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {works.map((w) => (
              // Library の WorkPagerCard（413:259 から方向の行を外した形。作品本文の埋め込みカードと同じ）
              // 新しいタブで開く操作（修飾キー付き）では閉じない
              <div key={w.id} onClickCapture={(e) => { if (!(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) onOpenWork(); }}>
                <WorkPagerCard
                  category={w.category}
                  categoryHue={w.category ? hues[w.category] ?? null : null}
                  title={w.title}
                  thumbnail={w.thumbnail_url ?? DEFAULT_IMAGE}
                  composedThumbnail={parseThumbnail(w.thumbnail)}
                  serviceName={w.hero_brand}
                  href={`/works?id=${w.id}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* 前後の経歴へ送るフッター。古い順で「前 = 古い」「次 = 新しい」 */
function PrevNext({
  index,
  total,
  onPrev,
  onNext,
}: {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [hovered, setHovered] = useState<"prev" | "next" | null>(null);
  const btn = (kind: "prev" | "next", disabled: boolean, onClick: () => void) => {
    const isHover = hovered === kind && !disabled;
    const chevron = (
      <Icon set="Arrows" name={kind === "prev" ? "left" : "right"} tintColor="currentColor" style={{ width: 16, height: 16, flexShrink: 0 }} />
    );
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        onMouseEnter={() => setHovered(kind)}
        onMouseLeave={() => setHovered(null)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          height: 36,
          padding: "0 12px",
          borderRadius: 8,
          border: `1px solid ${C.cardBorder}`,
          background: isHover ? "rgba(255,255,255,.05)" : "transparent",
          color: isHover ? "var(--color-fg)" : C.muted,
          fontFamily: FONT_JP,
          fontSize: 12,
          lineHeight: 1,
          opacity: disabled ? 0.35 : 1,
          cursor: disabled ? "default" : "pointer",
          transition: "background-color .15s ease, color .15s ease",
        }}
      >
        {kind === "prev" && chevron}
        {kind === "prev" ? "前の経歴" : "次の経歴"}
        {kind === "next" && chevron}
      </button>
    );
  };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      {btn("prev", index <= 0, onPrev)}
      <span style={{ fontFamily: FONT_EN, fontSize: 11, color: C.caption, whiteSpace: "nowrap" }}>
        {index + 1} / {total}
      </span>
      {btn("next", index >= total - 1, onNext)}
    </div>
  );
}

function CloseButton({ onClose }: { onClose: (viaKeyboard: boolean) => void }) {
  return (
    // detail === 0 = Enter / Space での押下
    <ButtonFunction border="off" onClick={(e) => onClose(e.detail === 0)} aria-label="閉じる">
      <Icon set="Character" name="close" alt="" aria-hidden tintColor="currentColor" className={`h-6 w-6 shrink-0 ${BUTTON_FUNCTION_ICON}`} />
    </ButtonFunction>
  );
}

const PANEL_SHADOW = "1px 1px 16px 2px rgba(0,0,0,.25)";
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* ──────────────────────────────────────────────────────────────────────────
   CareerPanel — 詳細パネル。PC = 右ドロワー / SP = ボトムシート
   document.body へ portal で出す（親の z-index に閉じ込められないため）。
   visible が false になると退場アニメーションに入り、親が PANEL_MS 後に unmount する。
   ────────────────────────────────────────────────────────────────────────── */
function CareerPanel({
  items,
  index,
  works,
  isMobile,
  visible,
  open,
  reducedMotion,
  onClose,
  onGo,
  onOpenWork,
}: {
  items: EnrichedItem[];
  index: number;
  works: WorkLink[];
  isMobile: boolean;
  /** 表示位置にいるか（false = 画面外へ退場中） */
  visible: boolean;
  /** 操作を受け付けるか（閉じ始めたら false） */
  open: boolean;
  reducedMotion: boolean;
  /** viaKeyboard = キーボード操作で閉じたか（カードへ戻すフォーカス枠の有無） */
  onClose: (viaKeyboard: boolean) => void;
  onGo: (next: number) => void;
  onOpenWork: () => void;
}) {
  const item = items[index];
  const dialogRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState<number | null>(null);
  const dragStartRef = useRef(0);

  // 開いた直後にダイアログ本体へフォーカス
  useEffect(() => {
    if (open) dialogRef.current?.focus({ preventScroll: true });
  }, [open]);

  // キーボード: Esc で閉じる / ← → で送る / Tab はダイアログ内に閉じ込める
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) {
        onClose(true);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (e.altKey || e.metaKey || e.ctrlKey) return;
        const t = e.target;
        if (t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        const next = index + (e.key === "ArrowLeft" ? -1 : 1);
        if (next >= 0 && next < items.length) {
          e.preventDefault();
          onGo(next);
        }
        return;
      }
      if (e.key === "Tab") {
        const root = dialogRef.current;
        if (!root) return;
        const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (!root.contains(active)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        } else if (e.shiftKey) {
          if (active === first || active === root) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, index, items.length, onClose, onGo]);

  if (!item) return null;

  const dragging = dragY !== null;
  const ease = reducedMotion ? "none" : `transform ${PANEL_MS}ms ease-in-out`;
  const scrimStyle = {
    position: "fixed",
    inset: 0,
    zIndex: PANEL_Z,
    background: "rgba(0,0,0,.25)",
    opacity: visible ? 1 : 0,
    pointerEvents: open ? "auto" : "none",
    transition: reducedMotion ? "none" : `opacity ${PANEL_MS}ms ease-in-out`,
  } as const;

  // 配色はセクション見出し（Headline: 和文ラベル = Main/050、英字タイトル = fg）に揃える
  const eyebrow = (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <span style={{ fontFamily: FONT_GUIDE, fontSize: 14, lineHeight: 1, letterSpacing: ".4px", color: "var(--color-fg)" }}>Career</span>
      <span style={{ fontFamily: FONT_JP, fontSize: 11, lineHeight: 1, color: C.label }}>経歴詳細</span>
    </div>
  );

  const body = <DetailBody item={item} works={works} onOpenWork={onOpenWork} />;
  const footer = <PrevNext index={index} total={items.length} onPrev={() => onGo(index - 1)} onNext={() => onGo(index + 1)} />;

  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // 閉じるボタン上の操作はドラッグにしない
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = e.clientY;
    setDragY(0);
  };
  const onHandleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragY === null) return;
    setDragY(Math.max(0, e.clientY - dragStartRef.current));
  };
  const onHandleUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragY === null) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const dy = dragY;
    setDragY(null);
    if (dy > SHEET_CLOSE_DRAG) onClose(false);
  };

  const dialogCommon = {
    ref: dialogRef,
    role: "dialog",
    "aria-modal": true,
    "aria-label": item.role,
    "aria-hidden": !open || undefined,
    tabIndex: -1,
  } as const;

  let panel: ReactNode;
  if (isMobile) {
    panel = (
      <div
        {...dialogCommon}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: PANEL_Z + 1,
          maxHeight: "86dvh",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          background: C.panelBg,
          border: `1px solid ${C.cardBorder}`,
          borderBottom: "none",
          borderRadius: "16px 16px 0 0",
          boxShadow: PANEL_SHADOW,
          outline: "none",
          pointerEvents: open ? "auto" : "none",
          transform: visible ? `translateY(${dragY ?? 0}px)` : "translateY(100%)",
          transition: dragging ? "none" : ease,
        }}
      >
        {/* ドラッグ領域（ハンドル + ヘッダー行） */}
        <div
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={() => setDragY(null)}
          style={{ touchAction: "none", padding: "8px 8px 0 24px", flexShrink: 0 }}
        >
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--color-border-light)", margin: "0 auto" }} />
          <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {eyebrow}
            <CloseButton onClose={onClose} />
          </div>
        </div>
        <div key={index} style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "8px 24px 24px" }}>{body}</div>
        <div style={{ padding: "12px 16px calc(24px + env(safe-area-inset-bottom))", borderTop: `1px solid ${C.cardBorder}`, flexShrink: 0 }}>{footer}</div>
      </div>
    );
  } else {
    panel = (
      <div
        {...dialogCommon}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: PANEL_Z + 1,
          width: 420,
          maxWidth: "100%",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          background: C.panelBg,
          borderLeft: `1px solid ${C.cardBorder}`,
          boxShadow: PANEL_SHADOW,
          outline: "none",
          pointerEvents: open ? "auto" : "none",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: ease,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 16px 32px", borderBottom: `1px solid ${C.cardBorder}`, flexShrink: 0 }}>
          {eyebrow}
          <CloseButton onClose={onClose} />
        </div>
        <div key={index} style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: 32 }}>{body}</div>
        <div style={{ padding: "16px 32px", borderTop: `1px solid ${C.cardBorder}`, flexShrink: 0 }}>{footer}</div>
      </div>
    );
  }

  return createPortal(
    <>
      <div aria-hidden onClick={() => onClose(false)} style={scrimStyle} />
      {panel}
    </>,
    document.body
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Main export
   カードは詳細を開く入口。開いた経歴（openIndex）は古い順（oldestFirst）の番号で持ち、
   PC・SP とも「前の経歴 = 古い／次の経歴 = 新しい」で送る。
   ────────────────────────────────────────────────────────────────────────── */
export default function CareerGanttChart({ career }: { career: CareerItem[] }) {
  const [worksByCareer, setWorksByCareer] = useState<Record<string, WorkLink[]>>({});
  const isMobile = useMediaQuery("(max-width: 727px)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // 開いている経歴（古い順の番号）。null = 閉じている
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // 閉じるアニメーション中も中身を描き続けるため、最後に開いていた番号を持つ
  const [lastIndex, setLastIndex] = useState(0);
  // パネルを DOM に置くか / 画面内に入ったか（マウント → 次フレーム → 表示、閉じたら退場後に外す）
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const isOpen = openIndex !== null;

  const enriched: EnrichedItem[] = career.map((item) => ({ ...item, ...parsePeriod(item.period) }));
  // 古い順（上）→ 新しい順（下）
  const oldestFirst = [...enriched].sort((a, b) => a.startVal - b.startVal);

  const openAt = (i: number) => {
    setOpenIndex(i);
    setLastIndex(i);
    setMounted(true);
  };

  const closePanel = (viaKeyboard: boolean, restoreFocus = true) => {
    const id = oldestFirst[lastIndex]?.id;
    setOpenIndex(null);
    if (restoreFocus && id) {
      const card = document.querySelector<HTMLElement>(`[data-career-card-id="${CSS.escape(id)}"]`);
      // ポインタで閉じたときはカードにフォーカス枠を出さない
      card?.focus({ preventScroll: true, focusVisible: viaKeyboard } as FocusOptions);
    }
  };

  // マウント直後は画面外に置き、2フレーム後に表示位置へ（transition を効かせる）
  useEffect(() => {
    if (!mounted) return;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [mounted]);

  // 閉じたら退場アニメーションの後に DOM から外す
  useEffect(() => {
    if (isOpen || !mounted) return;
    const t = window.setTimeout(() => {
      setMounted(false);
      setEntered(false);
    }, reducedMotion ? 0 : PANEL_MS);
    return () => window.clearTimeout(t);
  }, [isOpen, mounted, reducedMotion]);

  // 開いている間は背面をスクロールさせない（開く前の値を保存して閉じるとき復元）
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // career_item_id で works をグルーピング → 詳細パネルの Works リンク
  useEffect(() => {
    let active = true;
    supabase
      .from("works")
      .select("id, title, category, thumbnail_url, thumbnail, hero_brand, career_item_id, sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        const map: Record<string, WorkLink[]> = {};
        for (const w of data ?? []) {
          if (!w.career_item_id) continue;
          (map[w.career_item_id] ??= []).push({
            id: w.id,
            title: w.title,
            category: w.category,
            thumbnail_url: w.thumbnail_url,
            thumbnail: w.thumbnail,
            hero_brand: w.hero_brand,
          });
        }
        setWorksByCareer(map);
      });
    return () => {
      active = false;
    };
  }, []);

  // Works カードのクリック → 遷移（カード自体のリンク）の前にパネルを閉じ、背面のスクロールロックを外す
  const handleOpenWork = () => {
    // 退場中のパネル（aria-hidden）にフォーカスを残さない
    (document.activeElement as HTMLElement | null)?.blur();
    flushSync(() => closePanel(false, false));
  };

  const panelItem = oldestFirst[lastIndex];
  // 経歴が減って開いていた番号が無くなったら閉じる（背面ロックが残らないように）
  const staleOpen = isOpen && !panelItem;
  useEffect(() => {
    if (staleOpen) setOpenIndex(null);
  }, [staleOpen]);
  const panel =
    mounted && panelItem ? (
      <CareerPanel
        items={oldestFirst}
        index={lastIndex}
        works={worksByCareer[panelItem.id] ?? []}
        isMobile={isMobile}
        visible={isOpen && entered}
        open={isOpen}
        reducedMotion={reducedMotion}
        onClose={closePanel}
        onGo={openAt}
        onOpenWork={handleOpenWork}
      />
    ) : null;

  if (isMobile) {
    // モバイルは新しい順（上）→ 古い順（下）
    const newestFirst = [...oldestFirst].reverse();
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {newestFirst.map((item, i) => {
          const idx = oldestFirst.length - 1 - i;
          return (
            <CareerItemMobile
              key={item.id}
              item={item}
              isSelected={openIndex === idx}
              onOpen={() => openAt(idx)}
              isFirst={i === 0}
              isLast={i === newestFirst.length - 1}
            />
          );
        })}
        {panel}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: 800, padding: "24px 0", borderRadius: 14 }}>
      <div style={{ minWidth: 640, overflowX: "clip", borderRadius: "inherit" }}>
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
                letterSpacing: ".3945px",
                lineHeight: "16.5px",
                textAlign: "center",
                borderLeft: i === 0 ? "none" : `1px solid ${C.gridLine}`,
                height: 17,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
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
            {oldestFirst.map((item, i) => (
              <CareerRowDesktop key={item.id} item={item} isSelected={openIndex === i} onOpen={() => openAt(i)} />
            ))}
          </div>
        </div>
      </div>
      {panel}
    </div>
  );
}
