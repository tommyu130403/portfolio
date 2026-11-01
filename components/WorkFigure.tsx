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
  <div className="flex flex-col gap-5 rounded-2xl bg-system-900 px-5 pb-6 pt-7 @min-[560px]:px-8">
    {title || lead ? (
      <div className="flex flex-col gap-0.5">
        {title ? <p className="text-body-01-jp-bold text-fg">{title}</p> : null}
        {lead ? <p className="text-body-02-jp text-fg-muted">{lead}</p> : null}
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
    ? `${STEP_BASE} text-body-03-jp-bold border-main-100 bg-main-100 text-system-950`
    : tone === "bad"
      ? `${STEP_BASE} text-body-03-jp border-danger-300/60 bg-danger-300/10 text-danger-100 @min-[560px]:flex-[1.4]`
      : `${STEP_BASE} text-body-03-jp border-border bg-surface-light`;

const Arrow: FC = () => (
  <span aria-hidden className="text-body-03-jp flex items-center justify-center text-fg-subtle">
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
    {spacer ? <div aria-hidden className="hidden @min-[560px]:block @min-[560px]:flex-[1.1]" /> : null}
  </div>
);

/** `::: flow ラベル highlight=N` — 横並びの手順（狭い幅では縦積み） */
export const FlowSteps: FC<{ label?: ReactNode; steps: FigureStep[] }> = ({ label, steps }) => (
  <div className="flex flex-col gap-2">
    {label ? <p className="text-body-03-jp-bold text-fg-muted">{label}</p> : null}
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

/** `::: beforeafter タグ | 見出し` — Before / After の行を、それぞれ枠付きの箱で並べる */
export const BeforeAfter: FC<{ tag?: ReactNode; title?: ReactNode; rows: BeforeAfterRowData[] }> = ({
  tag,
  title,
  rows,
}) => (
  <div className="flex flex-col gap-2">
    {tag || title ? (
      <div className="text-body-02-jp-bold flex items-center gap-2.5 text-fg">
        {tag ? (
          <span className="text-body-03-jp rounded bg-main-100/15 px-2 py-0.5 text-primary">{tag}</span>
        ) : null}
        {title}
      </div>
    ) : null}
    {rows.map((row, i) => {
      const isAfter = row.kind === "after";
      return (
        <div
          key={i}
          className={`grid grid-cols-1 items-center gap-x-3 gap-y-2.5 rounded-[10px] border px-4 py-3.5 @min-[560px]:grid-cols-[74px_1fr] ${
            isAfter ? "border-border-main" : "border-border"
          }`}
        >
          <span
            className={`text-caption-01-en inline-flex items-center justify-center justify-self-start rounded-full px-2.5 py-1 @min-[560px]:justify-self-stretch ${
              isAfter
                ? "bg-main-100 text-system-950"
                : "border border-border-light bg-surface-light text-fg-muted"
            }`}
          >
            {isAfter ? "After" : "Before"}
          </span>
          <StepRow steps={row.steps} gap="gap-1.5" spacer={isAfter && row.steps.length <= 2} />
          {row.note ? (
            <p
              className={`text-body-03-jp rounded-md px-2.5 py-1 @min-[560px]:col-start-2 ${
                isAfter ? "bg-main-100/10 text-primary" : "bg-danger-300/10 text-danger-300"
              }`}
            >
              {row.note}
            </p>
          ) : null}
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

const FILL: Record<BarTone, string> = { up: "bg-secondary", down: "bg-danger-500", flat: "bg-system-750" };
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
          {r.sub ? <p className="text-caption-01-jp mt-px text-fg-muted">{r.sub}</p> : null}
        </div>
        <div className="relative h-[22px] rounded bg-surface-light">
          <div
            className={`h-full rounded ${FILL[r.tone]} ${r.width > 0 ? "min-w-1.5" : ""}`}
            style={{ width: `${r.width}%` }}
          />
          {base !== null ? (
            <span aria-hidden className="absolute -bottom-[5px] -top-[5px] w-0.5 bg-fg" style={{ left: `${base}%` }} />
          ) : null}
        </div>
        <p className={`text-body-01-jp-bold text-right ${VALUE[r.tone]}`}>{r.display}</p>
      </div>
    ))}
    {legend ? <p className="text-caption-01-jp text-fg-subtle">{legend}</p> : null}
  </div>
);
