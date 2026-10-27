import { useEffect, useRef, useState, type CSSProperties, type FC, type RefObject } from "react";
import Icon, { ICON_SETS, type IconSet } from "./Icon";
import { labelStep, scaleForTimeline, type TimelinePeriod, type TimelineScale } from "@/lib/timeline-scale";

/**
 * Work 詳細の構造化ビジュアル（Figma: _Process / _Stakeholder）。
 * WorkVizModal（全画面ボタンから開くモーダル）内に描画される。
 * データは works.timeline / works.stakeholders（jsonb）。
 */

export type RaciKey = "R" | "A" | "C" | "I";

export type TimelinePhase = {
  label: string;
  /** 開始位置（1 始まり、週番号） */
  start: number;
  /** 期間（週数） */
  span: number;
  raci: RaciKey[];
  /** 進捗率 0-100 */
  progress?: number;
  /** ホバーツールチップ（body=本文。見出しは工程名を使う。title は旧データ互換のため保持するが表示しない） */
  note?: { title?: string; body?: string };
};
export type TimelineData = { totalUnits: number; phases: TimelinePhase[] };

export type StakeholderMember = { label: string; me?: boolean };
export type StakeholderGroup = { label: string; icon?: string; members: StakeholderMember[] };
export type StakeholdersData = { groups: StakeholderGroup[] };

export function parseTimeline(raw: unknown): TimelineData | null {
  const obj = (raw ?? null) as Record<string, unknown> | null;
  if (!obj || !Array.isArray(obj.phases)) return null;
  const phases = (obj.phases as unknown[])
    .map((p): TimelinePhase | null => {
      const o = (p ?? {}) as Record<string, unknown>;
      if (typeof o.label !== "string") return null;
      return {
        label: o.label,
        start: Number(o.start) || 1,
        span: Math.max(1, Number(o.span) || 1),
        raci: (Array.isArray(o.raci) ? o.raci : []).filter((r): r is RaciKey =>
          ["R", "A", "C", "I"].includes(r as string)
        ),
        progress: o.progress == null ? undefined : Math.max(0, Math.min(100, Number(o.progress) || 0)),
        note:
          o.note && typeof o.note === "object"
            ? {
                title: typeof (o.note as Record<string, unknown>).title === "string" ? ((o.note as Record<string, unknown>).title as string) : undefined,
                body: typeof (o.note as Record<string, unknown>).body === "string" ? ((o.note as Record<string, unknown>).body as string) : undefined,
              }
            : undefined,
      };
    })
    .filter((p): p is TimelinePhase => p !== null);
  if (phases.length === 0) return null;
  const totalUnits = Math.max(Number(obj.totalUnits) || 12, ...phases.map((p) => p.start + p.span - 1));
  return { totalUnits, phases };
}

export function parseStakeholders(raw: unknown): StakeholdersData | null {
  const obj = (raw ?? null) as Record<string, unknown> | null;
  if (!obj || !Array.isArray(obj.groups)) return null;
  const groups = (obj.groups as unknown[])
    .map((g): StakeholderGroup | null => {
      const o = (g ?? {}) as Record<string, unknown>;
      if (typeof o.label !== "string") return null;
      return {
        label: o.label,
        icon: typeof o.icon === "string" ? o.icon : undefined,
        members: (Array.isArray(o.members) ? o.members : [])
          .map((m): StakeholderMember | null => {
            const mo = (m ?? {}) as Record<string, unknown>;
            return typeof mo.label === "string" ? { label: mo.label, me: mo.me === true } : null;
          })
          .filter((m): m is StakeholderMember => m !== null),
      };
    })
    .filter((g): g is StakeholderGroup => g !== null && g.members.length > 0);
  return groups.length > 0 ? { groups } : null;
}

/** "Set/name" 形式のアイコン参照を描画（DB 由来の文字列を許容）。不正な set 名は描画しない（404 アイコンを避ける）。 */
const RefIcon: FC<{ icon?: string; tint: string; className: string }> = ({ icon, tint, className }) => {
  if (!icon || !icon.includes("/")) return null;
  const set = icon.slice(0, icon.indexOf("/"));
  const name = icon.slice(icon.indexOf("/") + 1);
  if (!name || !(ICON_SETS as readonly string[]).includes(set)) return null;
  return <Icon set={set as IconSet} name={name} tintColor={tint} className={className} />;
};

/* ─── Timeline（_Process）────────────────────────────── */

// RACI バッジ（Figma 814:3872〜3875）
const RACI_STYLE: Record<RaciKey, string> = {
  R: "bg-main-100 text-surface",
  A: "bg-white text-surface",
  C: "bg-system-600 text-surface",
  I: "bg-system-800 text-system-500",
};
const RACI_LEGEND: { key: RaciKey; label: string }[] = [
  { key: "R", label: "Responsible / 実行責任" },
  { key: "A", label: "Accountable / 意思決定責任" },
  { key: "C", label: "Consulted / 相談先" },
  { key: "I", label: "Informed / 報告先" },
];

function RaciBadge({ k }: { k: RaciKey }) {
  return (
    <span className={`flex size-3 shrink-0 items-center justify-center rounded-full ${RACI_STYLE[k]}`}>
      <span className="font-sans text-[8px] font-medium leading-4 [text-box:trim-both_cap_alphabetic]">{k}</span>
    </span>
  );
}

/** 要素の幅（px）を監視する。計測前（SSR・初回描画）は 0 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

const NO_PERIOD: TimelinePeriod = { start: null, end: null, isCurrent: false };

/** 目盛り 2 段（上段: 年 or 月 / 下段: 月 or 週 or W 番号）。colPx は 1 週あたりの幅（0 なら未計測で全ラベル表示） */
export const TimelineAxis: FC<{ scale: TimelineScale; colPx: number }> = ({ scale, colPx }) => {
  const tickPx = colPx * scale.unitsPerTick;
  const minLabelPx = scale.mode === "month" ? 28 : scale.mode === "week" ? 14 : 22;
  const step = labelStep(tickPx, minLabelPx);
  return (
    <div className="flex flex-col">
      {scale.groups.length > 0 && (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${scale.totalUnits}, minmax(0,1fr))` }}>
          {scale.groups.map((g, gi) => {
            const showText = colPx <= 0 || g.span * colPx >= g.label.length * 7 + 12;
            return (
              <p
                key={gi}
                title={g.label}
                className="font-en overflow-hidden whitespace-nowrap border-l border-border pl-1.5 text-left text-[11px] font-extrabold leading-6 tracking-[0.55px] text-system-700"
                style={{ gridColumn: `span ${g.span}` }}
              >
                {showText ? g.label : ""}
              </p>
            );
          })}
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${scale.ticks.length}, minmax(0,1fr))` }}>
        {scale.ticks.map((t, i) => (
          <p
            key={i}
            className={`font-en overflow-hidden whitespace-nowrap text-center text-[11px] font-extrabold leading-6 tracking-[0.55px] text-system-700 ${
              scale.groups.length > 0 ? "border-l border-border" : ""
            }`}
          >
            {i % step === 0 ? t.label : ""}
          </p>
        ))}
      </div>
    </div>
  );
};

export const WorkProcessChart: FC<{ data: TimelineData; period?: TimelinePeriod | null }> = ({ data, period }) => {
  const { phases } = data;
  const scale = scaleForTimeline(data, period ?? NO_PERIOD);
  const { totalUnits } = scale;
  const axisRef = useRef<HTMLDivElement>(null);
  const colPx = useElementWidth(axisRef) / totalUnits;
  // 目盛り 1 つあたり最低 24px。ラベルの間引きを先に効かせ、横スクロールは最後の手段にする
  const minW = scale.ticks.length * 24 + 50;
  return (
    <div className="w-full max-md:overflow-x-auto">
      <div
        className="after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:content-[''] after:border-[rgba(0,0,0,0.1)] relative flex flex-col gap-6 rounded-[14px] px-[25px] pt-[25px] pb-[9px] max-md:min-w-[var(--tl-min-w)]"
        style={{ "--tl-min-w": `${minW}px` } as CSSProperties}
      >
        <div ref={axisRef} className="flex flex-col gap-4">
          {/* 目盛り行 */}
          <TimelineAxis scale={scale} colPx={colPx} />

          {/* フェーズ行一覧 */}
          <div className="isolate flex flex-col gap-2">
            {phases.map((p, i) => {
              const active = p.raci.includes("R") || p.raci.includes("A");
              const left = ((p.start - 1) / totalUnits) * 100;
              const width = (p.span / totalUnits) * 100;
              // バーの最小幅（px）= pl(5) + バッジ幅(12px×個数 + gap4px×(個数-1)) + pr(13)。
              // 短いバーでもRACIバッジがはみ出さないようにする（フェーズ名は最小幅では見えなくてよい）。
              const badgeCount = p.raci.length;
              const minBarWidth = 18 + (badgeCount > 0 ? badgeCount * 12 + (badgeCount - 1) * 4 : 0);
              return (
                <div key={i} className="relative h-6 w-full hover:z-[100]! focus-within:z-[100]!" style={{ zIndex: phases.length - i }}>
                  <div
                    className={`group after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:content-[''] absolute top-0 flex h-6 items-center justify-between gap-1 rounded-[48px] py-px pl-[5px] pr-[13px] ${
                      active ? "bg-main-700 after:border-border-main" : "bg-[rgba(0,0,0,0.25)] after:border-border"
                    }`}
                    style={{
                      left: `min(${left}%, calc(100% - ${minBarWidth}px))`,
                      width: `max(${width}%, ${minBarWidth}px)`,
                    }}
                  >
                    <span className="flex shrink-0 items-center gap-1">
                      {p.raci.map((k, ki) => (
                        <RaciBadge key={ki} k={k} />
                      ))}
                    </span>
                    <span
                      className={`font-en min-w-0 truncate text-[10px] font-extrabold leading-[14px] tracking-[0.4px] ${
                        active ? "text-main-100" : "text-system-500"
                      }`}
                      title={p.label}
                    >
                      {p.label}
                    </span>
                    {/* ツールチップ */}
                    {p.note?.body && (
                      <div className={`pointer-events-none absolute ${left >= 50 ? "right-2" : "left-2"} ${i >= Math.ceil(phases.length / 2) ? "bottom-full mb-1.5" : "top-full mt-1.5"} z-10 hidden w-max max-w-[280px] rounded-[8px] border border-border-light bg-[#0a0a0a] px-3 py-2 group-hover:block`}>
                        <p className="text-[10px] tracking-[0.3px] text-fg-muted">{p.label}</p>
                        <p className="text-[12px] leading-[1.5] text-white">{p.note.body}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 凡例 */}
        <div className="flex min-h-[26px] flex-wrap items-center justify-end">
          {RACI_LEGEND.map(({ key, label }) => (
            <span key={key} className="flex items-center gap-2 overflow-clip rounded-r8 px-2 text-[10px] leading-4 tracking-[0.5px] text-system-600">
              <RaciBadge k={key} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── Stakeholders（_Stakeholder）────────────────────── */

// 行の中央 31.5 だと描画で 32 に丸まるため、下マージン1px で 31 ちょうどに（Figma 31）
const Connector: FC = () => <span className="mb-px h-px w-4 shrink-0 rounded-full bg-border" />;

export const WorkStakeholderDiagram: FC<{ data: StakeholdersData }> = ({ data }) => (
  <div className="flex flex-col items-start gap-2 md:px-10">
    {data.groups.map((g, gi) => (
      <div key={gi} className="flex max-w-full items-center gap-1">
        {/* グループタイル */}
        <div className="after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:content-[''] after:border-border relative flex size-16 shrink-0 flex-col items-center justify-center rounded-r16 bg-surface">
          <RefIcon icon={g.icon} tint="var(--color-system-white)" className="h-4 w-4" />
          <p className="font-sans text-center text-[10px] font-bold leading-normal tracking-[0.5px] text-white">{g.label}</p>
        </div>
        {/* メンバーピル連結 */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-2">
          {g.members.map((m, mi) => {
            const memberTint = m.me ? "var(--color-main-050)" : "var(--color-system-500)";
            return (
              <span key={mi} className="flex min-w-0 max-w-full items-center gap-1">
                <Connector />
                <span
                  className={`after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:content-[''] relative flex h-8 min-w-0 max-w-full items-center gap-2 whitespace-nowrap rounded-[32px] px-[9px] py-px ${
                    m.me ? "after:border-border-main" : "after:border-border"
                  }`}
                >
                  <span className="flex min-w-0 max-w-full items-center gap-1.5">
                    <Icon
                      set="Peoples"
                      name={m.label ? "peoples-two" : "user"}
                      tintColor={memberTint}
                      className="h-4 w-4 shrink-0"
                    />
                    {m.label && (
                      <span
                        title={m.label}
                        className={`font-en max-md:truncate text-[11px] font-extrabold leading-none tracking-[0.44px] [text-box:trim-both_cap_alphabetic] ${
                          m.me ? "text-main-050" : "text-system-500"
                        }`}
                      >
                        {m.label}
                      </span>
                    )}
                  </span>
                  {m.me && (
                    <span className="font-sans rounded-full bg-main-100 px-1.5 py-1 text-[10px] font-normal leading-none tracking-[0.3px] text-surface">
                      担当
                    </span>
                  )}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    ))}
  </div>
);
