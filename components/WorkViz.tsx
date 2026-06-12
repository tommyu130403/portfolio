import type { FC } from "react";
import Icon from "./Icon";

/**
 * Work 詳細の構造化ビジュアル（Figma: _Process / _Stakeholder）。
 * 本文 markdown の「::: timeline」「::: stakeholders」ディレクティブ位置に描画される。
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
  /** ホバーツールチップ（title=小見出し / body=本文） */
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

/** "Set/name" 形式のアイコン参照を描画（DB 由来の文字列を許容） */
const RefIcon: FC<{ icon?: string; tint: string; className: string }> = ({ icon, tint, className }) => {
  if (!icon || !icon.includes("/")) return null;
  const [set, name] = [icon.slice(0, icon.indexOf("/")), icon.slice(icon.indexOf("/") + 1)];
  return <Icon set={set as never} name={name} tintColor={tint} className={className} />;
};

/* ─── Timeline（_Process）────────────────────────────── */

// RACI バッジ（Figma 凡例準拠: R=mint塗り / A=枠 / C=gray塗り / I=darkgray）
const RACI_STYLE: Record<RaciKey, string> = {
  R: "bg-main-100 text-[#0a0a0a]",
  A: "border border-main-100 bg-[#0a2218] text-main-100",
  C: "bg-[#9e9e9e] text-[#0a0a0a]",
  I: "bg-[#424242] text-[#bdbdbd]",
};
const RACI_LEGEND: { key: RaciKey; label: string }[] = [
  { key: "R", label: "Responsible / 実行責任" },
  { key: "A", label: "Accountable / 意思決定責任" },
  { key: "C", label: "Consulted / 相談先" },
  { key: "I", label: "Informed / 報告先" },
];

function RaciBadge({ k }: { k: RaciKey }) {
  return (
    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${RACI_STYLE[k]}`}>
      {k}
    </span>
  );
}

export const WorkProcessChart: FC<{ data: TimelineData }> = ({ data }) => {
  const { totalUnits, phases } = data;
  return (
    <div className="rounded-[14px] bg-[#1a1a1a] p-5">
      {/* 列ヘッダー（Phase + W1..Wn） */}
      <div className="flex items-center gap-3">
        <p className="w-[120px] shrink-0 text-right text-[13px] font-extrabold tracking-[0.65px] text-[#616161]">Phase</p>
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${totalUnits}, minmax(0,1fr))` }}>
          {Array.from({ length: totalUnits }, (_, i) => (
            <p key={i} className="text-center text-[11px] font-extrabold tracking-[0.44px] text-[#616161]">
              W{i + 1}
            </p>
          ))}
        </div>
      </div>

      {/* フェーズ行 */}
      <div className="mt-3 flex flex-col gap-2.5">
        {phases.map((p, i) => {
          const active = p.raci.includes("R") || p.raci.includes("A");
          const left = ((p.start - 1) / totalUnits) * 100;
          const width = (p.span / totalUnits) * 100;
          return (
            <div key={i} className="flex items-center gap-3">
              <p className="w-[120px] shrink-0 text-right text-[13px] font-extrabold tracking-[0.65px] text-[#bdbdbd]">
                {p.label}
              </p>
              <div className="relative h-8 flex-1">
                <div
                  className={`group absolute top-0 flex h-8 items-center gap-1.5 rounded-full border px-1.5 ${
                    active ? "border-main-100 bg-[#0a2218]" : "border-[#616161] bg-[#242424]"
                  }`}
                  style={{ left: `${left}%`, width: `${width}%`, minWidth: 56 }}
                >
                  <span className="flex items-center gap-1">
                    {p.raci.map((k) => (
                      <RaciBadge key={k} k={k} />
                    ))}
                  </span>
                  {p.progress != null && (
                    <span className={`ml-auto pr-1 text-[11px] font-extrabold tracking-[0.44px] ${active ? "text-main-100" : "text-[#9e9e9e]"}`}>
                      {p.progress}%
                    </span>
                  )}
                  {/* ツールチップ */}
                  {p.note && (p.note.title || p.note.body) && (
                    <div className="pointer-events-none absolute left-2 top-full z-10 mt-1.5 hidden w-max max-w-[280px] rounded-[8px] border border-[#424242] bg-[#0a0a0a] px-3 py-2 group-hover:block">
                      {p.note.title && <p className="text-[10px] tracking-[0.3px] text-[#9e9e9e]">{p.note.title}</p>}
                      {p.note.body && <p className="text-[12px] leading-[1.5] text-white">{p.note.body}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 凡例 */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-1.5">
        {RACI_LEGEND.map(({ key, label }) => (
          <span key={key} className="flex items-center gap-1.5 text-[10px] tracking-[0.3px] text-[#9e9e9e]">
            <RaciBadge k={key} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

/* ─── Stakeholders（_Stakeholder）────────────────────── */

const Connector: FC = () => <span className="h-px w-4 shrink-0 bg-[#424242]" />;

export const WorkStakeholderDiagram: FC<{ data: StakeholdersData }> = ({ data }) => (
  <div className="flex flex-col gap-4">
    {data.groups.map((g, gi) => (
      <div key={gi} className="flex items-center">
        {/* グループタイル */}
        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-[12px] border border-[#2a2a2a] bg-[#161616]">
          <RefIcon icon={g.icon} tint="#bdbdbd" className="h-5 w-5" />
          <p className="text-[10px] leading-none tracking-[0.3px] text-[#bdbdbd]">{g.label}</p>
        </div>
        {/* メンバーピル連結 */}
        <div className="flex min-w-0 flex-wrap items-center gap-y-2">
          {g.members.map((m, mi) => (
            <span key={mi} className="flex items-center">
              <Connector />
              <span
                className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[12px] tracking-[0.36px] ${
                  m.me ? "border-main-100 text-main-100" : "border-[#424242] text-[#9e9e9e]"
                }`}
              >
                <Icon set="Peoples" name="people" tintColor={m.me ? "var(--color-main-100)" : "#9e9e9e"} className="h-4 w-4 shrink-0" />
                {m.label}
                {m.me && (
                  <span className="rounded-full bg-main-100 px-1.5 py-0.5 text-[9px] font-bold leading-none text-[#0a0a0a]">me</span>
                )}
              </span>
            </span>
          ))}
        </div>
      </div>
    ))}
  </div>
);
