import React, { type FC, type ReactNode } from "react";

/**
 * 作品本文の「図版」ブロック群（WorkMarkdown の `::: figure` / `beforeafter` / `flow` / `bars` から使う）。
 * 見た目だけを持つ。記法の解析とインライン描画は WorkMarkdown 側（ここは ReactNode を受け取る）。
 * 560px 未満（親 MarkdownBody の @container 幅）では、ステップを縦積み（矢印は ↓）にする。
 */

export type StepTone = "default" | "good" | "bad";
export type FigureStep = { content: ReactNode; tone: StepTone };

/* ------------------------------------------------------------------ *
 * 枠
 * ------------------------------------------------------------------ */

/** `::: figure 見出し | 補足文` の枠。中身（子）は任意の本文ブロック */
export const FigureFrame: FC<{ title?: ReactNode; lead?: ReactNode; children?: ReactNode }> = ({
  title,
  lead,
  children,
}) => (
  <div className="flex flex-col gap-5 rounded-2xl bg-surface-light px-4 pb-6 pt-7 @min-[560px]:px-8">
    {title || lead ? (
      <div className="flex flex-col gap-0.5">
        {title ? <p className="text-body-01-jp-bold text-fg-title">{title}</p> : null}
        {lead ? <p className="text-caption-01-jp text-fg-muted">{lead}</p> : null}
      </div>
    ) : null}
    {children}
  </div>
);

/* ------------------------------------------------------------------ *
 * ステップ列（横フロー / Before・After 共通）
 * ------------------------------------------------------------------ */

const STEP_BASE =
  "flex min-w-0 items-center justify-center rounded-md border px-2 py-2 text-center @min-[560px]:flex-1";

const stepClass = (tone: StepTone) =>
  tone === "good"
    ? `${STEP_BASE} text-body-02-jp border-main-100/60 bg-main-100/10 text-main-050`
    : tone === "bad"
      ? `${STEP_BASE} text-body-02-jp border-danger-300/60 bg-danger-300/10 text-danger-100`
      : `${STEP_BASE} text-body-02-jp border-border bg-system-900/25 text-fg-muted`;

const Arrow: FC = () => (
  <span aria-hidden className="text-body-02-jp flex items-center justify-center text-fg-subtle">
    <span className="@min-[560px]:hidden">↓</span>
    <span className="hidden @min-[560px]:inline">→</span>
  </span>
);

const StepRow: FC<{ steps: FigureStep[]; spacer?: boolean; gap: string }> = ({ steps, spacer, gap }) => (
  <div className={`flex flex-col items-stretch @min-[560px]:flex-row ${gap}`}>
    {steps.map((s, i) => (
      <React.Fragment key={i}>
        {i > 0 ? <Arrow /> : null}
        <div className={stepClass(s.tone)}>{s.content}</div>
      </React.Fragment>
    ))}
    {spacer ? <div aria-hidden className="hidden @min-[560px]:block @min-[560px]:flex-1" /> : null}
  </div>
);

/** `::: flow ラベル highlight=N` — 横並びの手順（狭い幅では縦積み） */
export const FlowSteps: FC<{ label?: ReactNode; steps: FigureStep[] }> = ({ label, steps }) => (
  <div className="flex flex-col gap-2">
    {label ? <p className="text-body-02-jp-bold text-fg-muted">{label}</p> : null}
    <StepRow steps={steps} gap="gap-2" />
  </div>
);

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

/** 棒の塗り: Figma WorkFigure Kind=bars（2026-11-13 照合）。up / down は色の 10% 地 + 60% 枠、flat は Indigo/850 地 + Border/Default 枠 */
const FILL: Record<BarTone, string> = {
  up: "border border-main-100/60 bg-main-100/10",
  down: "border border-danger-300/60 bg-danger-300/10",
  flat: "border border-border bg-surface-light",
};
const VALUE: Record<BarTone, string> = { up: "text-primary", down: "text-danger-300", flat: "text-fg-muted" };

/** `::: bars base=1.0 max=1.4` — ラベル / 棒 / 値の横棒。base（%位置）があれば白い基準線を引く */
export const BarChart: FC<{ rows: BarRowData[]; base: number | null; legend?: ReactNode }> = ({
  rows,
  base,
  legend,
}) => (
  <div className="flex flex-col gap-3.5">
    {rows.map((r, i) => (
      <div key={i} className="grid grid-cols-[6rem_minmax(0,1fr)_4.5rem] items-center gap-3.5">
        <div className="min-w-0">
          <p className="text-body-02-jp-bold text-fg">{r.label}</p>
          {r.sub ? <p className="text-[12px] leading-[18px] tracking-[0.03em] mt-px text-fg-muted">{r.sub}</p> : null}
        </div>
        <div className="relative h-[22px] rounded bg-surface">
          <div
            className={`h-full rounded ${r.width > 0 ? `${FILL[r.tone]} min-w-1.5` : ""}`}
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
