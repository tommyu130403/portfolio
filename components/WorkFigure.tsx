import React, { type FC, type ReactNode } from "react";
import { WORK_FIGURE_TONE } from "@/lib/work-figure-tone";
import { useWorkLayout } from "./WorkLayoutContext";

/**
 * 作品本文の「図版」ブロック群（WorkMarkdown の `::: figure` / `beforeafter` / `flow` / `bars` から使う）。
 * 見た目だけを持つ。記法の解析とインライン描画は WorkMarkdown 側（ここは ReactNode を受け取る）。
 * 560px 未満（親 MarkdownBody の @container 幅）では、ステップを縦積み（矢印は ↓）にする。
 */

export type StepTone = "default" | "good" | "bad";
export type FigureStep = { content: ReactNode; tone: StepTone };

// v1 は凍結: 直すのは v2 だけ
const FRAME_CLASS = {
  v1: "flex flex-col gap-5 rounded-2xl bg-surface-light px-4 pb-6 pt-7 @min-[560px]:px-8",
  v2: `flex flex-col gap-5 ${WORK_FIGURE_TONE.frame} px-4 py-6 @min-[560px]:px-6`,
} as const;

// 補足文: v1 は凍結。v2 は 13px・fg-muted（fg-caption は地との差が足りない）
const LEAD_CLASS = { v1: "text-caption-01-jp text-fg-caption", v2: "text-[13px] leading-[1.6] text-fg-muted" } as const;

const STEP_BASE_V1 =
  "flex min-w-0 items-center justify-center rounded-md border px-2 py-2 text-center @min-[560px]:flex-1";
const STEP_BASE_V2 = "flex min-w-0 items-center justify-center px-2 py-2 text-center @min-[560px]:flex-1";

const STEP_CLASS = {
  v1: {
    good: `${STEP_BASE_V1} text-body-02-jp border-main-100-a60 bg-main-100-a10 text-main-050`,
    bad: `${STEP_BASE_V1} text-body-02-jp border-danger-300-a60 bg-danger-300-a10 text-danger-100`,
    default: `${STEP_BASE_V1} text-body-02-jp border-border bg-system-900-a25 text-fg`,
  },
  v2: {
    good: `${STEP_BASE_V2} text-body-02-jp rounded-r8 ${WORK_FIGURE_TONE.accent}`,
    bad: `${STEP_BASE_V2} text-body-02-jp rounded-r8 ${WORK_FIGURE_TONE.blocked}`,
    default: `${STEP_BASE_V2} text-body-02-jp text-fg ${WORK_FIGURE_TONE.cell}`,
  },
} as const;

/* ------------------------------------------------------------------ *
 * 枠
 * ------------------------------------------------------------------ */

/** `::: figure 見出し | 補足文` の枠。中身（子）は任意の本文ブロック。aside は見出し行の右端に置く凡例など */
export const FigureFrame: FC<{ title?: ReactNode; lead?: ReactNode; aside?: ReactNode; children?: ReactNode }> = ({
  title,
  lead,
  aside,
  children,
}) => {
  const layout = useWorkLayout();
  const head =
    title || lead ? (
      <div className="flex flex-col gap-0.5">
        {title ? <p className="text-body-01-jp-bold text-fg-headline-01">{title}</p> : null}
        {lead ? <p className={LEAD_CLASS[layout]}>{lead}</p> : null}
      </div>
    ) : null;
  return (
    <div className={FRAME_CLASS[layout]}>
      {aside ? (
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          {head}
          {aside}
        </div>
      ) : (
        head
      )}
      {children}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * ステップ列（横フロー / Before・After 共通）
 * ------------------------------------------------------------------ */

const stepClass = (layout: "v1" | "v2", tone: StepTone) => STEP_CLASS[layout][tone];

const Arrow: FC = () => (
  <span aria-hidden className="text-body-02-jp flex items-center justify-center text-fg-subtle">
    <span className="@min-[560px]:hidden">↓</span>
    <span className="hidden @min-[560px]:inline">→</span>
  </span>
);

const StepRow: FC<{ steps: FigureStep[]; spacer?: boolean; gap: string }> = ({ steps, spacer, gap }) => {
  const layout = useWorkLayout();
  return (
    <div className={`flex flex-col items-stretch @min-[560px]:flex-row ${gap}`}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <Arrow /> : null}
          <div className={stepClass(layout, s.tone)}>{s.content}</div>
        </React.Fragment>
      ))}
      {spacer ? <div aria-hidden className="hidden @min-[560px]:block @min-[560px]:flex-1" /> : null}
    </div>
  );
};

/** `::: flow ラベル highlight=N` — 横並びの手順（狭い幅では縦積み） */
export const FlowSteps: FC<{ label?: ReactNode; steps: FigureStep[] }> = ({ label, steps }) => (
  <div className="flex flex-col gap-2">
    {label ? <p className="text-body-02-jp-bold text-fg-muted">{label}</p> : null}
    <StepRow steps={steps} gap="gap-2" />
  </div>
);

/** `::: flow ラベル numbered` — 番号つきステップ。番号・文の順に並べ、矢印は付けない（折り返しはコンテナ幅に任せる） */
export const NumberedFlow: FC<{ label?: ReactNode; steps: ReactNode[] }> = ({ label, steps }) => {
  const layout = useWorkLayout();
  // 面は InfoCard と同じ（v2 = 共通のセル色調・角丸 8 / v1 = 枠線）。上線は引かない（角丸の箱に直線のアクセントは合わない）。強調は番号のミントだけ
  const cell = layout === "v2" ? WORK_FIGURE_TONE.cell : "rounded-r8 border border-border";
  return (
    <div className="flex flex-col gap-2">
      {label ? <p className="text-body-02-jp-bold text-fg-muted">{label}</p> : null}
      <ol
        style={{ "--steps": steps.length } as React.CSSProperties}
        className={`m-0 grid list-none grid-cols-2 gap-2 p-0 @min-[480px]:grid-cols-3 ${
          steps.length > 6 ? "@min-[640px]:grid-cols-4" : "@min-[640px]:grid-cols-[repeat(var(--steps),minmax(0,1fr))]"
        }`}
      >
        {steps.map((s, i) => (
          <li
            key={i}
            className={`flex min-w-0 flex-col gap-2 p-4 text-[13px] leading-[1.6] text-fg ${cell}`}
          >
            <span aria-hidden className="font-guide text-main-050">
              {i + 1}
            </span>
            <span className="min-w-0 [word-break:break-word]">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Before / After
 * ------------------------------------------------------------------ */

export type BeforeAfterRowData = {
  kind: "before" | "after";
  steps: FigureStep[];
  note?: ReactNode;
};

/** `::: beforeafter タグ | 見出し` — 上に罫線を引いた Before / After の行を縦に並べる */
export const BeforeAfter: FC<{ tag?: ReactNode; title?: ReactNode; rows: BeforeAfterRowData[] }> = ({
  tag,
  title,
  rows,
}) => (
  <div className="flex flex-col">
    {tag || title ? (
      <div className="text-body-02-jp-bold flex items-center gap-2 pb-2 text-fg-muted">
        {tag ? <span className="text-primary">{tag}</span> : null}
        {title}
      </div>
    ) : null}
    {rows.map((row, i) => {
      const isAfter = row.kind === "after";
      return (
        <div
          key={i}
          className="flex flex-col gap-2 border-t border-border pt-4 [&:not(:last-child)]:pb-4 @min-[560px]:flex-row @min-[560px]:items-start @min-[560px]:gap-3.5"
        >
          <p
            className={`text-body-02-jp-bold shrink-0 @min-[560px]:w-24 @min-[560px]:pt-[7px] ${
              isAfter ? "text-primary" : "text-fg"
            }`}
          >
            {isAfter ? "After" : "Before"}
          </p>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <StepRow steps={row.steps} gap="gap-2" spacer={isAfter && row.steps.length <= 2} />
            {row.note ? (
              <p className={`text-body-02-jp ${isAfter ? "text-primary" : "text-danger-300"}`}>{row.note}</p>
            ) : null}
          </div>
        </div>
      );
    })}
  </div>
);

/* ------------------------------------------------------------------ *
 * 横棒グラフ
 * ------------------------------------------------------------------ */

export type BarTone = "up" | "down" | "flat";
export type BarRowData = {
  label: ReactNode;
  sub?: ReactNode;
  /** 0〜100（%）。呼び出し側でクランプ済み */
  width: number;
  display: ReactNode;
  tone: BarTone;
};

/**
 * 棒の塗り。v1 は凍結: Figma WorkFigure Kind=bars（2026-11-13 照合）。up / down は色の 10% 地 + 60% 枠、flat は Indigo/850 地 + Border/Default 枠。
 * v2 は塗らずに線だけ（up = 枠 Main、down = danger の破線、flat = 薄い枠）
 */
const FILL: Record<"v1" | "v2", Record<BarTone, string>> = {
  v1: {
    up: "border border-main-100-a60 bg-main-100-a10",
    down: "border border-danger-300-a60 bg-danger-300-a10",
    flat: "border border-border bg-surface-light",
  },
  v2: {
    up: "border border-border-main",
    down: "border border-dashed border-danger-200",
    flat: "border border-border-light",
  },
};
const VALUE: Record<BarTone, string> = { up: "text-primary", down: "text-danger-300", flat: "text-fg-muted" };

/** `::: bars base=1.0 max=1.4` — ラベル / 棒 / 値の横棒。base（%位置）があれば白い基準線を引く */
export const BarChart: FC<{ rows: BarRowData[]; base: number | null; legend?: ReactNode }> = ({
  rows,
  base,
  legend,
}) => {
  const layout = useWorkLayout();
  return (
  <div className="flex flex-col gap-3.5">
    {rows.map((r, i) => (
      <div key={i} className="grid grid-cols-[6rem_minmax(0,1fr)_4.5rem] items-center gap-3.5">
        <div className="min-w-0">
          <p className="text-body-02-jp-bold text-fg">{r.label}</p>
          {r.sub ? <p className="text-[12px] leading-[18px] tracking-[0.03em] mt-px text-fg-muted">{r.sub}</p> : null}
        </div>
        <div className="relative h-[22px] rounded bg-surface">
          <div
            className={`h-full rounded ${r.width > 0 ? `${FILL[layout][r.tone]} min-w-1.5` : ""}`}
            style={{ width: `${r.width}%` }}
          />
          {base !== null ? (
            <span aria-hidden className="absolute -bottom-[5px] -top-[5px] w-0.5 bg-fg" style={{ left: `${base}%` }} />
          ) : null}
        </div>
        <p className={`text-body-01-jp-bold text-right ${VALUE[r.tone]}`}>{r.display}</p>
      </div>
    ))}
    {legend ? <p className="text-[12px] leading-[18px] tracking-[0.03em] text-fg-caption">{legend}</p> : null}
  </div>
  );
};
