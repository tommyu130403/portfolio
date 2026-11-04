import { useEffect, useRef, useState, type CSSProperties, type FC, type ReactNode, type RefObject } from "react";
import { Icon, ICON_SETS, type IconSet } from "@/components/Icon";
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

/** 組織カードの 1 行（役割名 + （メモ）+ ×人数 を組み立て済みの文字） */
export type StakeholderOrgRow = { text: string; me: boolean };
export type StakeholderCard =
  | { kind: "role"; name: string; note: string; me: boolean }
  | { kind: "org"; title: string; rows: StakeholderOrgRow[] };
/** 関係者グループ 1 つ = 層 1 つ。name が空の層は「グループ未設定」。icon = 「セット名/アイコン名」 */
export type StakeholderLayer = { name: string; note: string | null; icon: string | null; cards: StakeholderCard[] };

/** 層の icon を Icon に渡せる形へ。形式外・未知のセットは null（壊れた画像を出さない） */
function layerIcon(ref: string | null): { set: IconSet; name: string } | null {
  const m = ref ? /^([A-Za-z]+)\/([^/\s]+)$/.exec(ref) : null;
  if (!m || !(ICON_SETS as readonly string[]).includes(m[1])) return null;
  return { set: m[1] as IconSet, name: m[2] };
}
export type StakeholdersData = { v: 2; layers: StakeholderLayer[] };

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

/** works.stakeholders（jsonb）を読む。新形式 { v: 2, layers } と旧形式 { groups } の両方を受け付ける。 */
export function parseStakeholders(raw: unknown): StakeholdersData | null {
  const obj = (raw ?? null) as Record<string, unknown> | null;
  if (!obj || typeof obj !== "object") return null;

  if (obj.v === 2 && Array.isArray(obj.layers)) {
    const layers = (obj.layers as unknown[])
      .map((l): StakeholderLayer | null => {
        const o = (l ?? {}) as Record<string, unknown>;
        if (typeof o.name !== "string") return null;
        const cards = (Array.isArray(o.cards) ? o.cards : [])
          .map((c): StakeholderCard | null => {
            const co = (c ?? {}) as Record<string, unknown>;
            if (co.kind === "role") {
              if (typeof co.name !== "string" || typeof co.note !== "string") return null;
              return { kind: "role", name: co.name, note: co.note, me: co.me === true };
            }
            if (co.kind === "org") {
              if (typeof co.title !== "string") return null;
              const rows = (Array.isArray(co.rows) ? co.rows : [])
                .map((r): StakeholderOrgRow | null => {
                  const ro = (r ?? {}) as Record<string, unknown>;
                  return typeof ro.text === "string" ? { text: ro.text, me: ro.me === true } : null;
                })
                .filter((r): r is StakeholderOrgRow => r !== null);
              return rows.length > 0 ? { kind: "org", title: co.title, rows } : null;
            }
            return null;
          })
          .filter((c): c is StakeholderCard => c !== null);
        return cards.length > 0
          ? {
              name: o.name,
              note: typeof o.note === "string" ? o.note : null,
              icon: typeof o.icon === "string" ? o.icon : null,
              cards,
            }
          : null;
      })
      .filter((l): l is StakeholderLayer => l !== null);
    return layers.length > 0 ? { v: 2, layers } : null;
  }

  // 旧形式 { groups: [{ label, members: [{ label, me }] }] }（20261101120000 の出力・手描きの図）
  if (Array.isArray(obj.groups)) {
    const layers = (obj.groups as unknown[])
      .map((g): StakeholderLayer | null => {
        const o = (g ?? {}) as Record<string, unknown>;
        if (typeof o.label !== "string") return null;
        const byLabel = new Map<string, { count: number; me: boolean }>();
        for (const m of Array.isArray(o.members) ? o.members : []) {
          const mo = (m ?? {}) as Record<string, unknown>;
          if (typeof mo.label !== "string") continue;
          const cur = byLabel.get(mo.label) ?? { count: 0, me: false };
          cur.count += 1;
          cur.me = cur.me || mo.me === true;
          byLabel.set(mo.label, cur);
        }
        const cards: StakeholderCard[] = [...byLabel].map(([name, v]) => ({
          kind: "role",
          name,
          note: `${v.count}名`,
          me: v.me,
        }));
        return cards.length > 0 ? { name: o.label, note: null, icon: null, cards } : null;
      })
      .filter((l): l is StakeholderLayer => l !== null);
    return layers.length > 0 ? { v: 2, layers } : null;
  }

  return null;
}

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

/** 英数字の連なり（"API" "Next.js" "PjM" など）だけ欧文フォントにする。大きさ・太さは親から引き継ぐ */
const MIXED_RE = /[A-Za-z0-9]+(?:[ .\-/][A-Za-z0-9]+)*/g;
const MixedText: FC<{ text: string }> = ({ text }) => {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MIXED_RE)) {
    const at = m.index ?? 0;
    if (at > last) nodes.push(text.slice(last, at));
    nodes.push(
      <span key={at} className="font-en tracking-normal">
        {m[0]}
      </span>,
    );
    last = at + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
};

const MeBadge: FC<{ className?: string }> = ({ className = "" }) => (
  <span className={`w-fit rounded-full bg-main-100 px-1.5 py-1 text-caption-01-jp text-surface ${className}`}>担当</span>
);

export const WorkStakeholderDiagram: FC<{ data: StakeholdersData }> = ({ data }) => (
  <div className="flex flex-col gap-4 md:gap-2.5">
    {data.layers.map((layer, li) => {
      const icon = layerIcon(layer.icon);
      return (
      <div key={li} className="flex flex-col gap-2 md:grid md:grid-cols-[104px_minmax(0,1fr)] md:gap-3">
        {/* 層のラベル。md 以上はアイコン → 層名を中央揃えで縦に積む（スマホは横並び）。層のメモ（note）は表示しない */}
        <div className="flex items-center gap-2 md:flex-col md:gap-1 md:py-2.5 md:text-center">
          {icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-r8 border border-border bg-surface-light">
              <Icon set={icon.set} name={icon.name} tintColor="var(--color-main-100)" alt="" aria-hidden className="h-5 w-5" />
            </span>
          )}
          {layer.name && (
            <p className="min-w-0 text-body-02-jp-bold text-fg-muted">
              <MixedText text={layer.name} />
            </p>
          )}
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-2">
          {layer.cards.map((card, ci) =>
            card.kind === "role" ? (
              <div
                key={ci}
                className={`flex min-w-0 flex-col rounded-r8 border px-3 py-[9px] ${
                  card.me ? "border-border-main bg-main-100/6" : "border-border bg-surface-light"
                }`}
              >
                {(card.name || card.me) && (
                  <div className="flex min-w-0 items-center gap-1.5">
                    {card.name && (
                      <p className="min-w-0 text-body-02-jp-bold text-fg">
                        <MixedText text={card.name} />
                      </p>
                    )}
                    {card.me && <MeBadge className="shrink-0" />}
                  </div>
                )}
                <p className="mt-0.5 text-body-03-jp text-fg-muted">
                  <MixedText text={card.note} />
                </p>
              </div>
            ) : (
              <div
                key={ci}
                className="flex min-w-0 flex-col rounded-r8 border border-border bg-surface-light px-3 py-2.5"
              >
                <p className="text-body-03-jp-bold text-fg-muted">
                  <MixedText text={card.title} />
                </p>
                <ul className="mt-2.5 flex flex-col gap-1">
                  {card.rows.map((row, ri) => (
                    <li
                      key={ri}
                      className="flex items-center gap-1.5 rounded-r4 bg-system-900 px-2 py-1 text-body-03-jp text-fg"
                    >
                      {row.me && <MeBadge />}
                      <span className="min-w-0">
                        <MixedText text={row.text} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>
      </div>
      );
    })}
  </div>
);
