/**
 * Timeline（ガント）の目盛りを作業の期間（works.start_date / end_date / is_current）から作る純粋関数群。
 * 保存データの単位は「週」。1 か月 = 4 単位に固定（1〜7日 / 8〜14日 / 15〜21日 / 22日〜月末）。
 * 年月は整数だけで計算する（Date のタイムゾーン差を避ける）。
 */

type YearMonth = { year: number; month: number };

export type TimelinePeriod = {
  start: YearMonth | null;
  end: YearMonth | null;
  isCurrent: boolean;
};

export const WEEKS_PER_MONTH = 4;

export type AxisGroup = { label: string; span: number };
export type AxisTick = { label: string };
export type TimelineScale = {
  mode: "relative" | "week" | "month";
  /** 常に「週」単位（保存データの単位） */
  totalUnits: number;
  unitsPerTick: number;
  /** 上段（relative では空） */
  groups: AxisGroup[];
  /** 下段: 長さ = totalUnits / unitsPerTick */
  ticks: AxisTick[];
};

const EMPTY_PERIOD: TimelinePeriod = { start: null, end: null, isCurrent: false };

function ymFromDate(d: string | null): YearMonth | null {
  if (!d) return null;
  const m = d.match(/^(\d{4})-(\d{1,2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? { year, month } : null;
}

export function periodFromRow(row: { start_date: string | null; end_date: string | null; is_current: boolean }): TimelinePeriod {
  const start = ymFromDate(row.start_date);
  if (!start) return { ...EMPTY_PERIOD };
  return { start, end: row.is_current ? null : ymFromDate(row.end_date), isCurrent: row.is_current };
}

function toHalfWidth(v: string): string {
  return v.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).trim();
}

function ymFromInputs(yearStr: string, monthStr: string): YearMonth | null {
  const y = toHalfWidth(yearStr);
  const m = toHalfWidth(monthStr);
  if (!/^\d+$/.test(y) || !/^\d+$/.test(m)) return null;
  const year = Number(y);
  const month = Number(m);
  if (year < 1900 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}

export function periodFromInputs(p: { startYear: string; startMonth: string; endYear: string; endMonth: string; isCurrent: boolean }): TimelinePeriod {
  const start = ymFromInputs(p.startYear, p.startMonth);
  if (!start) return { ...EMPTY_PERIOD };
  return { start, end: p.isCurrent ? null : ymFromInputs(p.endYear, p.endMonth), isCurrent: p.isCurrent };
}

const ymIndex = (ym: YearMonth) => ym.year * 12 + (ym.month - 1);
const fromIndex = (i: number): YearMonth => ({ year: Math.floor(i / 12), month: (i % 12) + 1 });

/** 開始〜終了を含む月数。開始なし・終了なし（現在でもない）・終了が開始より前なら null */
export function monthCount(period: TimelinePeriod, now: Date = new Date()): number | null {
  if (!period.start) return null;
  const end = period.isCurrent ? { year: now.getFullYear(), month: now.getMonth() + 1 } : period.end;
  if (!end) return null;
  const n = ymIndex(end) - ymIndex(period.start) + 1;
  return n >= 1 ? n : null;
}

export function buildScale(period: TimelinePeriod, minUnits: number, now: Date = new Date()): TimelineScale {
  if (!period.start) {
    const n = Math.max(1, minUnits);
    return {
      mode: "relative",
      totalUnits: n,
      unitsPerTick: 1,
      groups: [],
      ticks: Array.from({ length: n }, (_, i) => ({ label: `W${i + 1}` })),
    };
  }
  const base = monthCount(period, now) ?? Math.ceil(Math.max(1, minUnits) / WEEKS_PER_MONTH);
  // 工程が期間を超えても見えるように、必要な週数まで月を足す
  const months = Math.max(base, Math.ceil(minUnits / WEEKS_PER_MONTH));
  const totalUnits = months * WEEKS_PER_MONTH;
  const startIdx = ymIndex(period.start);

  if (months >= 4) {
    const groups: AxisGroup[] = [];
    const ticks: AxisTick[] = [];
    for (let i = 0; i < months; i++) {
      const ym = fromIndex(startIdx + i);
      ticks.push({ label: `${ym.month}月` });
      const last = groups[groups.length - 1];
      if (last && last.label === `${ym.year}年`) last.span += WEEKS_PER_MONTH;
      else groups.push({ label: `${ym.year}年`, span: WEEKS_PER_MONTH });
    }
    return { mode: "month", totalUnits, unitsPerTick: WEEKS_PER_MONTH, groups, ticks };
  }

  const groups: AxisGroup[] = [];
  let prevYear: number | null = null;
  for (let i = 0; i < months; i++) {
    const ym = fromIndex(startIdx + i);
    groups.push({ label: prevYear === ym.year ? `${ym.month}月` : `${ym.year}年${ym.month}月`, span: WEEKS_PER_MONTH });
    prevYear = ym.year;
  }
  const ticks: AxisTick[] = Array.from({ length: totalUnits }, (_, i) => ({ label: String((i % WEEKS_PER_MONTH) + 1) }));
  return { mode: "week", totalUnits, unitsPerTick: 1, groups, ticks };
}

function locate(unit: number, start: YearMonth): { ym: YearMonth; week: number } {
  const u = Math.max(1, unit);
  return { ym: fromIndex(ymIndex(start) + Math.floor((u - 1) / WEEKS_PER_MONTH)), week: ((u - 1) % WEEKS_PER_MONTH) + 1 };
}

/** 1 始まりの週単位 → "2024年4月 第3週"。開始がなければ "W3" */
export function unitLabel(unit: number, period: TimelinePeriod): string {
  if (!period.start) return `W${unit}`;
  const { ym, week } = locate(unit, period.start);
  return `${ym.year}年${ym.month}月 第${week}週`;
}

export function unitRangeLabel(start: number, span: number, period: TimelinePeriod): string {
  const endUnit = start + Math.max(1, span) - 1;
  if (!period.start) return `W${start}〜W${endUnit}`;
  const a = locate(start, period.start);
  const b = locate(endUnit, period.start);
  const head = `${a.ym.year}年${a.ym.month}月 第${a.week}週`;
  if (a.ym.year === b.ym.year && a.ym.month === b.ym.month) return `${head}〜第${b.week}週`;
  if (a.ym.year === b.ym.year) return `${head}〜${b.ym.month}月 第${b.week}週`;
  return `${head}〜${b.ym.year}年${b.ym.month}月 第${b.week}週`;
}

/** ラベルを何個おきに出すか。colPx = 1 ラベルが占める幅 */
export function labelStep(colPx: number, minLabelPx: number): number {
  if (!(colPx > 0)) return 1;
  return Math.max(1, Math.ceil(minLabelPx / colPx));
}

const MAX_RELATIVE_UNITS = 104;

/**
 * 保存データ（工程）と期間から目盛りを作る。公開側とエディタで同じ結果になるよう、両方がこれを使う。
 * 開始年月があるときは保存済みの totalUnits を見ず、工程の最終週だけを下限にする。
 * 開始年月がないとき（相対表示）だけ、保存済みの totalUnits を土台にする。
 */
export function scaleForTimeline(
  data: { totalUnits: number; phases: { start: number; span: number }[] },
  period: TimelinePeriod,
  now?: Date,
): TimelineScale {
  const minUnits = Math.max(1, ...data.phases.map((p) => p.start + p.span - 1));
  if (period.start) return buildScale(period, minUnits, now);
  const base = Math.min(Math.max(data.totalUnits, minUnits), Math.max(MAX_RELATIVE_UNITS, minUnits));
  return buildScale(period, base, now);
}
