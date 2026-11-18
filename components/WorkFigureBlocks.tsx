"use client";

import React, { useEffect, useState, type FC, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import { sharedPublishedWorksOrder } from "@/src/lib/published-works-order";
import { WORK_FIGURE_TONE } from "@/lib/work-figure-tone";
import { countTeamMembers, type MergeData, type RelatedData, type StairsRow, type TeamGroup, type TriageData } from "@/lib/work-figure-parse";
import { civilFromDays, formatRoughDay, formatSpan, labelHasDate, placeScheduleLabels, scheduleAxisLabels, scheduleSpansYears, schedulePct, summarizeSchedule, type ScheduleData, type ScheduleLabelInput } from "@/lib/work-schedule";
import { FigureFrame } from "./WorkFigure";
import { renderInline } from "./WorkInline";
import { useWorkLayout } from "./WorkLayoutContext";

/**
 * 作品本文の新しい図版ブロック（team / schedule / stairs / summary / merge / triage / related）の見た目。
 * 記法の読み取りは lib/work-figure-parse.ts・lib/work-schedule.ts、ブロックの位置づけは WorkMarkdown。
 * 色と線は lib/work-figure-tone.ts の決まりに従う（ミントの広い塗り・danger の塗りは使わない）。
 * 幅の切り替えは親（MarkdownBody）の @container 幅で行う。v1 には旧い見た目が無いので、v1 は枠線で区切る素朴な見た目にする。
 * 見出しは目次（h2 / h3 を拾う）に入れないため p で書く。
 */

/** 面（セル）。v2 は塗り、v1 は塗りの下地（surface-light）と同化しないよう枠線 */
const CELL = { v1: "rounded-r8 border border-border", v2: WORK_FIGURE_TONE.cell } as const;
/** 角丸なしの面（階段・番号ステップ） */
const FLAT = { v1: "bg-surface", v2: "bg-surface-light" } as const;

const Chevron: FC<{ className?: string }> = ({ className = "" }) => (
  <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" className={`fill-none stroke-current ${className}`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3l5 5-5 5" />
  </svg>
);

/** 枠つき（FigureFrame）か、枠なし（見出し行だけ）かを切り替える。凡例などは aside で見出し行の右端に置く */
const BlockFrame: FC<{
  framed: boolean;
  title?: string;
  lead?: string;
  aside?: ReactNode;
  keyBase: string;
  children: ReactNode;
}> = ({ framed, title, lead, aside, keyBase, children }) => {
  const layout = useWorkLayout();
  const t = title ? renderInline(title, `${keyBase}-t`) : undefined;
  const l = lead ? renderInline(lead, `${keyBase}-l`) : undefined;
  if (framed) {
    return (
      <FigureFrame title={t} lead={l} aside={aside}>
        {children}
      </FigureFrame>
    );
  }
  if (!t && !l && !aside) return <>{children}</>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        {t || l ? (
          <div className="flex flex-col gap-0.5">
            {t ? <p className="text-body-02-jp-bold text-fg">{t}</p> : null}
            {l ? <p className={layout === "v2" ? "text-[13px] leading-[1.6] text-fg-muted" : "text-caption-01-jp text-fg-muted"}>{l}</p> : null}
          </div>
        ) : null}
        {aside}
      </div>
      {children}
    </div>
  );
};

const LegendItem: FC<{ swatch: ReactNode; children: ReactNode }> = ({ swatch, children }) => (
  <span className="inline-flex items-center gap-1.5">
    {swatch}
    {children}
  </span>
);

/* ------------------------------------------------------------------ *
 * team
 * ------------------------------------------------------------------ */

const MAX_DOTS = 10;
const Dot: FC<{ self?: boolean }> = ({ self }) => (
  <span aria-hidden className={`size-[10px] shrink-0 rounded-full ${self ? WORK_FIGURE_TONE.dotSelf : WORK_FIGURE_TONE.dotOther}`} />
);

/** 作品の関係者データが渡されない場所で出す見本の枠 */
export const TeamPlaceholder: FC = () => (
  <div className="rounded-r8 border border-dashed border-border-light p-4 text-[12px] leading-[18px] text-fg-muted">
    体制図(作品の関係者データから表示されます)
  </div>
);

/** `::: team` — 役割ごとに人数ぶんのドットを並べる。自分がいる役割は先頭の 1 つを primary にする */
export const TeamDots: FC<{ groups: TeamGroup[]; title: string; lead: string; framed: boolean; edit?: ReactNode }> = ({ groups, title, lead, framed, edit }) => {
  const layout = useWorkLayout();
  const total = countTeamMembers(groups);
  // 自分が 2 つ以上の役割にいると、ドットの数（役割ごとの人数の和）が合計より多くなるので一言添える
  const sharedSelf = groups.flatMap((g) => g.rows).filter((r) => r.me).length > 1;
  const legend = (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-muted">
      <span className="text-body-03-jp text-fg-muted">
        計 <span className="text-fg">{total}</span> 名{sharedSelf ? "（自分は 1 名で計上）" : null}
      </span>
      <LegendItem swatch={<Dot self />}>自分</LegendItem>
      <LegendItem swatch={<Dot />}>メンバー</LegendItem>
      {edit}
    </span>
  );
  return (
    <BlockFrame framed={framed} title={title || (framed ? "体制" : "")} lead={lead} aside={legend} keyBase="team">
      <div role="group" aria-label={`${title || "体制"} 計 ${total} 名`} className="grid grid-cols-1 gap-2 @min-[480px]:grid-cols-2">
        {groups.map((g, gi) => (
          <div key={gi} className={`flex min-w-0 flex-col gap-3 p-4 ${CELL[layout]}`}>
            <p className="text-[11px] text-fg-muted">{g.label}</p>
            {g.rows.map((r, ri) => {
              const shown = Math.min(r.count, MAX_DOTS);
              return (
                <div
                  key={ri}
                  role="img"
                  aria-label={`${r.name} ${r.count}名${r.me ? "(うち自分)" : ""}`}
                  className="flex items-center justify-between gap-2 text-[13px] leading-[1.6]"
                >
                  <span className={r.me ? "text-main-050" : "text-fg"}>{r.name}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {Array.from({ length: shown }, (_, di) => (
                      <Dot key={di} self={r.me && di === 0} />
                    ))}
                    {r.count > MAX_DOTS ? <span className="ml-1 text-[11px] text-fg-muted">+{r.count - MAX_DOTS}</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </BlockFrame>
  );
};

/* ------------------------------------------------------------------ *
 * schedule
 * ------------------------------------------------------------------ */

type ChartLabel = ScheduleLabelInput & { tone: string };

/**
 * `::: schedule` — 計画と実際の年表。幅 640px 以上は軸つきのチャート、未満は縦の一覧（チャートは出さない）。
 * 両方を DOM に置き、親の @container で切り替える。チャートは見た目だけ（aria-hidden）で、一覧が読み上げ用（広い幅では視覚的に隠す）
 */
export const ScheduleFigure: FC<{ data: ScheduleData; title: string; lead: string; framed: boolean; keyBase: string }> = ({ data, title, lead, framed, keyBase }) => {
  const pct = (day: number) => schedulePct(day, data.start, data.end);
  const span = (start: number, end: number) => ({ left: `${pct(start)}%`, width: `${Math.max(0, pct(end) - pct(start))}%` });
  // 凡例は「計画」と「実際」を見分けるためのもの。計画の棒がどのレーンにも無い（実際の棒だけの工程表）ときは出さない
  const axis = scheduleAxisLabels(data);
  const multiYear = scheduleSpansYears(data);
  const hasPlan = data.lanes.some((l) => l.plan);
  const hasActual = data.lanes.some((l) => l.actuals.length > 0);
  const legend = hasPlan ? (
    <span className="hidden items-center gap-4 text-[11px] text-fg-muted @min-[640px]:flex">
      <LegendItem swatch={<span aria-hidden className={`h-1.5 w-4 rounded-r2 ${WORK_FIGURE_TONE.barPlan}`} />}>計画</LegendItem>
      {hasActual ? <LegendItem swatch={<span aria-hidden className={`h-1.5 w-4 rounded-r2 ${WORK_FIGURE_TONE.barActual}`} />}>実際のリリース月</LegendItem> : null}
    </span>
  ) : null;

  return (
    <BlockFrame framed={framed} title={title} lead={lead} aside={legend} keyBase={keyBase}>
      <div aria-hidden className="hidden flex-col gap-2 overflow-x-clip @min-[640px]:flex">
        {axis.years.length > 0 ? (
          // 年は月とは別の段（最初の月と各 1 月）。年つきの月ラベルが次の月と重ならないようにする
          <div className="relative h-4 font-guide text-[11px] leading-4 text-fg-muted">
            {axis.years.map((y) => (
              <span key={y.year} className="absolute whitespace-nowrap" style={{ left: `${pct(y.day)}%` }}>
                {y.year}年
              </span>
            ))}
          </div>
        ) : null}
        <div className="relative h-6 border-b border-border font-guide text-[13px] leading-[1.6] text-fg-muted">
          {axis.months.filter((m) => m.show).map((m, mi) => (
            <span key={mi} className="absolute whitespace-nowrap" style={{ left: `${pct(m.day)}%` }}>
              {m.label}
            </span>
          ))}
        </div>
        {data.lanes.map((lane, li) => {
          // ラベルは軸の下の上下 2 段へ振り分ける（節目は番号の偶奇で交互。重なりそうなら反対の段）。右寄り（70% 超）は右端をその位置にそろえて枠からはみ出さない
          const labels: ChartLabel[] = [
            ...lane.milestones.map((m, mi): ChartLabel => ({ pct: pct(m.day), text: m.text, tone: "text-fg-muted", prefer: mi % 2 === 0 ? 0 : 1 })),
            ...lane.delays.filter((d) => d.label).map((d): ChartLabel => ({ pct: pct((d.start + d.end) / 2), text: d.label, tone: "text-danger-100", prefer: 1 })),
            ...lane.actuals.filter((a) => a.label).map((a): ChartLabel => ({ pct: pct(a.start), text: a.label, tone: "text-fg", prefer: 0 })),
          ];
          const placed = placeScheduleLabels(labels);
          return (
            <div key={li} className={`flex flex-col gap-2 pt-2 ${li > 0 ? "border-t border-border" : ""}`}>
              {lane.name ? <p className="text-[13px] font-bold leading-[1.6] text-fg">{renderInline(lane.name, `${keyBase}-n${li}`)}</p> : null}
              <div className="relative" style={{ height: labels.length > 0 ? 24 + Math.max(0, ...placed.map((p) => p.row)) * 22 + 30 : 18 }}>
                {lane.plan ? <div className={`absolute top-[5px] h-1.5 rounded-r2 ${WORK_FIGURE_TONE.barPlan}`} style={span(lane.plan.start, lane.plan.end)} /> : null}
                {lane.span ? <div className={`absolute top-[5px] h-1.5 rounded-r2 ${WORK_FIGURE_TONE.barPlan}`} style={span(lane.span.start, lane.span.end)} /> : null}
                {lane.delays.map((d, di) => (
                  <div key={di} className="absolute top-[7px] h-0 border-t-2 border-dashed border-danger-200" style={span(d.start, d.end)} />
                ))}
                {lane.actuals.map((a, ai) => (
                  <div key={ai} className={`absolute top-[5px] h-1.5 rounded-r2 ${WORK_FIGURE_TONE.barActual}`} style={span(a.start, a.end)} />
                ))}
                {lane.milestones.map((m, mi) => (
                  <span
                    key={mi}
                    className="absolute top-0.5 -ml-1.5 size-3 rounded-full border-2 border-fg bg-surface"
                    // 始点・終点のそばの丸は、円全体が軸の中に収まるよう中心を半径（6px）ぶん内側へ寄せる
                    style={{ left: pct(m.day) < 1.5 || pct(m.day) > 98.5 ? `clamp(6px, ${pct(m.day)}%, calc(100% - 6px))` : `${pct(m.day)}%` }}
                  />
                ))}
                {labels.map((lb, bi) => (
                  <span
                    key={bi}
                    className={`absolute whitespace-nowrap text-[11px] leading-[1.6] ${lb.tone} ${placed[bi].alignRight ? "text-right" : placed[bi].clampLeft ? "" : "-ml-1.5"}`}
                    style={{ top: 24 + placed[bi].row * 22, ...(placed[bi].alignRight ? { right: `${100 - lb.pct}%` } : { left: placed[bi].clampLeft ? 0 : `${lb.pct}%` }) }}
                  >
                    {renderInline(lb.text, `${keyBase}-L${li}-${bi}`)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div role="group" aria-label={lead ? (title ? `${title}: ${lead}` : lead) : summarizeSchedule(data)} className="flex flex-col gap-6 @min-[640px]:sr-only">
        {data.lanes.map((lane, li) => {
          type Row = { day: number; order: number; first?: boolean; node: (withYear: boolean) => ReactNode; cls: string };
          const rows: Row[] = [];
          const plan = lane.plan;
          if (plan) {
            rows.push({
              day: plan.start,
              order: 0,
              cls: "border-border-light text-fg",
              node: (y) => (
                <>
                  <span>計画</span>
                  <span className="font-guide text-fg-muted">{formatSpan(plan.start, plan.end, y)}</span>
                </>
              ),
            });
          }
          const bar = lane.span;
          if (bar) {
            rows.push({
              day: bar.start,
              order: 0,
              first: !lane.plan && lane.delays.length === 0,
              cls: "border-border-light text-fg",
              node: (y) => (
                <>
                  {hasPlan ? <span>期間</span> : null}
                  <span className="font-guide text-fg-muted">{formatSpan(bar.start, bar.end, y)}</span>
                </>
              ),
            });
          }
          lane.milestones.forEach((m) =>
            rows.push({
              day: m.day,
              order: 1,
              cls: "border-border text-fg-muted",
              node: (y) => (
                <>
                  {/* ラベルに日付がすでにあるときは、左の日付列を出さない（日付の二重表示を避ける） */}
                  {labelHasDate(m.label) ? null : <span className="min-w-10 font-guide">{formatRoughDay(m.day, y)}</span>}
                  <span>{m.label ? renderInline(m.label, `${keyBase}-m${li}-${m.day}`) : null}</span>
                </>
              ),
            }),
          );
          lane.delays.forEach((d) =>
            rows.push({
              day: d.start,
              order: 2,
              cls: "border-dashed border-danger-200 text-danger-100",
              node: (y) => (
                <>
                  <span>{d.label ? renderInline(d.label, `${keyBase}-d${li}-${d.start}`) : "遅れ"}</span>
                  {d.label.includes(formatSpan(d.start, d.end)) ? null : <span className="font-guide">{formatSpan(d.start, d.end, y)}</span>}
                </>
              ),
            }),
          );
          lane.actuals.forEach((a) =>
            rows.push({
              day: a.start,
              order: 3,
              first: !lane.plan && lane.delays.length === 0,
              cls: "border-primary text-main-050",
              node: (y) => (
                <>
                  {/* 計画の棒がある図でだけ「実際」と添える（工程だけの一覧では不要） */}
                  {a.label ? <span>{renderInline(a.label, `${keyBase}-a${li}-${a.start}`)}</span> : hasPlan ? <span>実際</span> : null}
                  {a.label.includes(formatSpan(a.start, a.end)) ? null : <span className="font-guide">{formatSpan(a.start, a.end, y)}</span>}
                </>
              ),
            }),
          );
          // 計画も遅れも無いレーン（帯が span / actual だけ）は、そのレーンの期間の行を先頭に置き、節目はその後に日付順
          rows.sort((a, b) => Number(!!b.first) - Number(!!a.first) || a.day - b.day || a.order - b.order);
          return (
            <div key={li} className="flex flex-col gap-2">
              {lane.name ? <p className="text-[13px] font-bold leading-[1.6] text-fg">{renderInline(lane.name, `${keyBase}-ln${li}`)}</p> : null}
              <ol className="m-0 flex list-none flex-col gap-1 p-0">
                {rows.map((r, ri) => {
                  // 年を添えるのは、軸が年をまたぐときの最初の行と、年が変わった最初の行
                  const year = civilFromDays(r.day).y;
                  const withYear = ri === 0 ? multiYear : year !== civilFromDays(rows[ri - 1].day).y;
                  return (
                    <li key={ri} className={`flex flex-wrap items-baseline gap-x-3 border-l-2 py-0.5 pl-3 text-[13px] leading-[1.6] ${r.cls}`}>
                      {r.node(withYear)}
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </BlockFrame>
  );
};

/* ------------------------------------------------------------------ *
 * stairs
 * ------------------------------------------------------------------ */

const STAIR_BORDER = { neutral: "border-fg-caption", mid: "border-main-300", accent: "border-primary" } as const;
const STAIR_INDENT_STEP = 4;
const STAIR_INDENT_MAX = 24;

/** `::: stairs` — 階段状に右へずらした行。560px 未満はずらさず、各行を縦に積む */
export const StairsFigure: FC<{ rows: StairsRow[]; title: string; lead: string; framed: boolean; keyBase: string }> = ({ rows, title, lead, framed, keyBase }) => {
  const layout = useWorkLayout();
  return (
    <BlockFrame framed={framed} title={title} lead={lead} keyBase={keyBase}>
      <div className="flex flex-col gap-1">
        {rows.map((r, i) => {
          const accent = r.tone === "accent";
          return (
            <div
              key={i}
              style={{ "--stair-indent": `${Math.min(i * STAIR_INDENT_STEP, STAIR_INDENT_MAX)}%` } as React.CSSProperties}
              className={`flex min-w-0 flex-col gap-1 border-l-2 px-4 py-3 @min-[560px]:ml-[var(--stair-indent)] @min-[560px]:flex-row @min-[560px]:items-center @min-[560px]:gap-4 ${FLAT[layout]} ${STAIR_BORDER[r.tone]}`}
            >
              <div className="flex items-baseline gap-2 @min-[560px]:contents">
                <span className={`text-[13px] font-bold leading-[1.6] @min-[560px]:w-[72px] @min-[560px]:shrink-0 ${accent ? "text-main-050" : "text-fg"}`}>
                  {renderInline(r.name, `${keyBase}-n${i}`)}
                </span>
                <span className={`text-[11px] leading-[1.6] @min-[560px]:w-[76px] @min-[560px]:shrink-0 ${accent ? "text-main-050" : "text-fg-muted"}`}>
                  {renderInline(r.tag, `${keyBase}-t${i}`)}
                </span>
              </div>
              <span className="min-w-0 text-[13px] leading-[1.6] text-fg [word-break:break-word] @min-[560px]:flex-1">
                {renderInline(r.desc, `${keyBase}-d${i}`)}
              </span>
              <span className={`text-[11px] leading-[1.6] @min-[560px]:w-[150px] @min-[560px]:shrink-0 @min-[560px]:text-right ${accent ? "text-fg" : "text-fg-muted"}`}>
                {renderInline(r.note, `${keyBase}-o${i}`)}
              </span>
            </div>
          );
        })}
      </div>
    </BlockFrame>
  );
};

/* ------------------------------------------------------------------ *
 * summary
 * ------------------------------------------------------------------ */

const SUMMARY_LABELS = ["01 課題", "02 打ち手", "03 結果"] as const;

/**
 * 課題 → 打ち手 → 結果の 3 枚。無い項目は飛ばし、番号は位置で固定（打ち手が無ければ 01 → 03）。
 * 760px 以上は横並びで間にシェブロン、未満は縦に積んで間に下向きのシェブロン。全部空なら何も出さない。
 * 本文中（v1 / 置いた場所のまま）でも、v2 でページ上部へ移したときも同じ部品
 */
export const SummaryCards: FC<{ problem: string; action: string; result: string; keyBase: string }> = ({ problem, action, result, keyBase }) => {
  const layout = useWorkLayout();
  const cards = [problem, action, result].map((text, i) => ({ text, label: SUMMARY_LABELS[i] })).filter((c) => c.text);
  if (cards.length === 0) return null;
  return (
    <div className="@container w-full">
      <div className="flex flex-col items-stretch gap-2 @min-[760px]:flex-row">
        {cards.map((c, i) => (
          <React.Fragment key={c.label}>
            {i > 0 ? (
              <div className="flex shrink-0 items-center justify-center text-fg-muted @min-[760px]:w-6">
                <Chevron className="rotate-90 @min-[760px]:rotate-0" />
              </div>
            ) : null}
            <div className={`flex min-w-0 flex-col gap-2 p-6 @min-[760px]:flex-1 ${CELL[layout]}`}>
              <span className="font-guide text-[13px] text-main-050">{c.label}</span>
              <span className="text-[15px] leading-[1.8] text-fg [word-break:break-word]">{renderInline(c.text, `${keyBase}-sc${i}`)}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * merge
 * ------------------------------------------------------------------ */

const MERGE_STEP_BORDER = { default: "border border-border", accent: WORK_FIGURE_TONE.accent, dashed: WORK_FIGURE_TONE.deferred } as const;

/** `::: merge` — 元の複数の流れ（from）→ 統合の説明 → 1 本にした流れ（into の手順）。560px 未満は縦に積む */
export const MergeFigure: FC<{ data: MergeData; caption: string; keyBase: string }> = ({ data, caption, keyBase }) => {
  const layout = useWorkLayout();
  return (
    <div className="flex flex-col gap-3">
      {data.from.length > 0 ? (
        <div className="flex flex-col gap-2 @min-[560px]:flex-row">
          {data.from.map((f, i) => (
            <div key={i} className="flex min-w-0 flex-1 flex-col gap-1 rounded-r8 border border-border px-6 py-4 text-[13px] leading-[1.6]">
              {f.title ? <span className="font-bold text-fg">{renderInline(f.title, `${keyBase}-ft${i}`)}</span> : null}
              {f.body ? <span className="text-fg">{renderInline(f.body, `${keyBase}-fb${i}`)}</span> : null}
              {f.note ? <span className="text-[11px] text-fg-muted">{renderInline(f.note, `${keyBase}-fn${i}`)}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
      {data.from.length > 0 || caption ? (
        <div className="flex flex-col items-center gap-1 text-center text-[13px] leading-[1.6] text-fg-muted">
          {data.from.length > 0 ? <Chevron className="rotate-90" /> : null}
          {caption ? <span>{renderInline(caption, `${keyBase}-cap`)}</span> : null}
        </div>
      ) : null}
      <div className={`flex flex-col gap-4 p-4 @min-[560px]:p-6 ${CELL[layout]}`}>
        {data.intoTitle ? <p className="text-[13px] font-bold leading-[1.6] text-main-050">{renderInline(data.intoTitle, `${keyBase}-it`)}</p> : null}
        <div className="flex flex-col items-stretch gap-2 @min-[560px]:flex-row">
          {data.steps.map((s, i) => {
            const dashed = s.tone === "dashed";
            const accent = s.tone === "accent";
            return (
              <React.Fragment key={i}>
                {i > 0 ? (
                  <div className="flex shrink-0 items-center justify-center text-fg-muted @min-[560px]:mt-[22px] @min-[560px]:w-6 @min-[560px]:self-start">
                    <Chevron className="rotate-90 @min-[560px]:rotate-0" />
                  </div>
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className={`flex flex-col items-center justify-center gap-0.5 rounded-r8 bg-surface p-2 text-center text-[13px] leading-[1.6] ${MERGE_STEP_BORDER[s.tone]}`}>
                    {s.tag ? (
                      <span className={dashed ? "text-[11px] text-fg-muted" : "font-guide text-[15px] text-main-050"}>{renderInline(s.tag, `${keyBase}-st${i}`)}</span>
                    ) : null}
                    {s.name ? <span className="font-bold text-fg">{renderInline(s.name, `${keyBase}-sn${i}`)}</span> : null}
                  </div>
                  {s.note ? (
                    <p className={`border-t-2 pt-2 text-[11px] leading-[1.6] ${accent ? "border-primary text-main-050" : "border-fg-caption text-fg-muted"}`}>
                      {renderInline(s.note, `${keyBase}-so${i}`)}
                    </p>
                  ) : null}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
      {data.note ? <p className="text-[12px] leading-[18px] tracking-[0.03em] text-fg-muted">{renderInline(data.note, `${keyBase}-mn`)}</p> : null}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * triage
 * ------------------------------------------------------------------ */

/** `::: triage` — 入れた / 削った / 見送ったの 3 列（200px 未満に縮むと折り返して縦に積む）。削った項目は取り消し線 + <del> で文字だけでも伝わるようにする */
export const TriageFigure: FC<{ data: TriageData; title: string; lead: string; framed: boolean; keyBase: string }> = ({ data, title, lead, framed, keyBase }) => {
  const layout = useWorkLayout();
  return (
    <BlockFrame framed={framed} title={title} lead={lead} keyBase={keyBase}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start gap-2">
          {data.sections.map((sec, si) => {
            const head = (
              <>
                <p className={`text-[13px] font-bold leading-[1.6] ${sec.kind === "in" ? "text-main-050" : "text-fg"}`}>{renderInline(sec.label, `${keyBase}-h${si}`)}</p>
                {sec.reason ? <p className="text-[11px] leading-[1.6] text-fg-muted">{renderInline(sec.reason, `${keyBase}-r${si}`)}</p> : null}
              </>
            );
            if (sec.kind === "cut") {
              return (
                <div key={si} className={`flex min-w-0 flex-[1_1_200px] flex-col gap-2 p-4 ${CELL[layout]}`}>
                  {head}
                  <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
                    {sec.items.map((it, ii) => (
                      <li key={ii}>
                        <del className={`inline-block rounded-r4 px-2 py-0.5 text-[11px] leading-[1.6] ${WORK_FIGURE_TONE.cut}`}>{renderInline(it, `${keyBase}-c${si}-${ii}`)}</del>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }
            const box = sec.kind === "in" ? WORK_FIGURE_TONE.accent : WORK_FIGURE_TONE.deferred;
            return (
              <div key={si} className={`flex min-w-0 flex-[1_1_200px] flex-col gap-2 rounded-r8 p-4 ${box}`}>
                {head}
                <ul className="m-0 list-disc pl-4 text-[13px] leading-[1.8] text-fg marker:text-fg-muted">
                  {sec.items.map((it, ii) => (
                    <li key={ii}>{renderInline(it, `${keyBase}-i${si}-${ii}`)}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        {data.note ? <p className="text-[12px] leading-[18px] tracking-[0.03em] text-fg-muted">{renderInline(data.note, `${keyBase}-tn`)}</p> : null}
      </div>
    </BlockFrame>
  );
};

/* ------------------------------------------------------------------ *
 * related
 * ------------------------------------------------------------------ */

/**
 * 作品 id から題名を引く。WorkCardEmbed と同じ手順: 作品詳細が取った公開作品の一覧にあればそれを使い、無い id だけ公開中の作品から取り直す。
 * 読み込み中は null。見つからない（非公開・存在しない）id は null の値
 */
function useWorkTitles(idsKey: string): Record<string, string | null> | null {
  const [state, setState] = useState<{ key: string; titles: Record<string, string | null> } | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      const ids = idsKey.split(",");
      try {
        const listed = await sharedPublishedWorksOrder();
        const titles: Record<string, string | null> = {};
        const missing: string[] = [];
        for (const id of ids) {
          const hit = listed?.find((w) => w.id === id);
          if (hit) titles[id] = hit.title;
          else missing.push(id);
        }
        if (missing.length > 0) {
          const { data, error } = await supabase.from("works").select("id, title").in("id", missing).eq("is_published", true);
          const rows = error ? [] : (data ?? []);
          for (const id of missing) titles[id] = rows.find((r) => r.id === id)?.title ?? null;
        }
        if (active) setState({ key: idsKey, titles });
      } catch (error) {
        // 取得に失敗したら全部「見つからない」にして、何も出さない（未処理の拒否にしない）
        console.error("Failed to fetch related works:", error);
        if (active) setState({ key: idsKey, titles: Object.fromEntries(ids.map((id) => [id, null])) });
      }
    })();
    return () => {
      active = false;
    };
  }, [idsKey]);
  return state?.key === idsKey ? state.titles : null;
}

export type RelatedCard = { id: string; label: string; accent: boolean; title: string };

/**
 * 文字だけのカードの並び（ラベル + 題名）。題名を引いたあとの見た目だけを持つ（スタイルガイドもこれを直接使う）。
 * hoisted = true（v2 でページ末尾へ移したとき）は上に罫線を引く。className は呼び出し側の余白
 */
export const RelatedList: FC<{ heading: string; cards: RelatedCard[]; hoisted?: boolean; className?: string }> = ({ heading, cards, hoisted, className = "" }) => {
  const layout = useWorkLayout();
  const pathname = usePathname();
  // admin のプレビュー内ではクリックで遷移させない（編集中の内容が失われるため。WorkCardEmbed と同じ）
  const inAdmin = pathname?.startsWith("/admin") ?? false;
  return (
    <div
      className={`flex flex-col gap-4 ${hoisted ? "border-t border-border pt-12" : ""} ${className}`}
      onClickCapture={inAdmin ? (e) => e.preventDefault() : undefined}
    >
      {hoisted ? (
        <h2 className="font-guide text-[15px] leading-[1.6] text-fg-muted">{renderInline(heading, "rel-h")}</h2>
      ) : (
        <p className="font-guide text-[15px] leading-[1.6] text-fg-muted">{renderInline(heading, "rel-h")}</p>
      )}
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {cards.map((c, i) => (
          <li key={c.id} className="flex min-w-0 flex-[1_1_220px]">
            <Link
              href={`/works?id=${c.id}`}
              className={`flex min-h-11 w-full min-w-0 items-center justify-between gap-3 border border-border p-4 no-underline transition-colors hover:bg-indigo-800 ${CELL[layout]}`}
            >
              <span className="flex min-w-0 flex-col gap-1">
                {c.label ? <span className={`text-[11px] leading-[1.6] ${c.accent ? "text-main-050" : "text-fg-muted"}`}>{renderInline(c.label, `rel-l${i}`)}</span> : null}
                <span className="text-[15px] font-bold leading-[1.6] text-fg [word-break:break-word]">{c.title}</span>
              </span>
              <Chevron className="shrink-0 text-fg-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * `::: related` — 他の作品への文字だけのカード。公開中でない作品は飛ばし、全部飛ばしたら何も出さない（余白も残さない）
 */
export const RelatedWorks: FC<{ data: RelatedData; hoisted?: boolean; className?: string }> = ({ data, hoisted, className }) => {
  const titles = useWorkTitles(data.items.map((i) => i.id).join(","));
  if (!titles) return null;
  const cards = data.items.flatMap((i): RelatedCard[] => {
    const title = titles[i.id];
    return title ? [{ id: i.id, label: i.label, accent: i.accent, title }] : [];
  });
  if (cards.length === 0) return null;
  return <RelatedList heading={data.heading} cards={cards} hoisted={hoisted} className={className} />;
};
