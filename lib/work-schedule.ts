/**
 * `::: schedule` の日付計算とパース（純粋関数。Date を使わず UTC の通算日数だけで計算する）。
 * 日付は `YYYY-MM-DD` または `YYYY-MM`（= その月の 1 日）。通算日数 = 1970-01-01 を 0 とした日数。
 */

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysInMonth = (y: number, m: number) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

/** 西暦 y 年 m 月 d 日の通算日数（Howard Hinnant の days_from_civil） */
export function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** 通算日数から年月日へ（civil_from_days） */
export function civilFromDays(z0: number): { y: number; m: number; d: number } {
  const z = z0 + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

/** `YYYY-MM-DD` / `YYYY-MM` を通算日数へ。形式外・存在しない日付は null */
export function parseScheduleDate(text: string): number | null {
  const m = text.trim().match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = m[3] === undefined ? 1 : Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  return daysFromCivil(y, mo, d);
}

/** その日を含む月の 1 日 */
export const monthStartOf = (day: number): number => {
  const { y, m } = civilFromDays(day);
  return daysFromCivil(y, m, 1);
};

/** その日を含む月の翌月 1 日 */
export const nextMonthStartOf = (day: number): number => {
  const { y, m } = civilFromDays(day);
  return m === 12 ? daysFromCivil(y + 1, 1, 1) : daysFromCivil(y, m + 1, 1);
};

/** `M/D` */
export const formatMD = (day: number): string => {
  const { m, d } = civilFromDays(day);
  return `${m}/${d}`;
};

export type ScheduleSpan = { start: number; end: number; label: string };
export type ScheduleMilestone = { day: number; label: string; text: string };
export type ScheduleLane = {
  name: string;
  plan: { start: number; end: number } | null;
  /** 中立の帯（`- span:`）。計画ではない（凡例に出ない）。節目の丸を載せる 1 本の線として使う */
  span: { start: number; end: number } | null;
  actuals: ScheduleSpan[];
  delays: ScheduleSpan[];
  milestones: ScheduleMilestone[];
};
export type ScheduleData = {
  /** 軸の開始日（その月の 1 日）と、終端（最終月の翌月 1 日。この日が 100%） */
  start: number;
  end: number;
  /** 月の目盛り。label は常に `N月`。year は軸が年をまたぐとき、最初の月と各 1 月だけに付く（年は月とは別の段に出す） */
  months: { label: string; day: number; year?: number }[];
  lanes: ScheduleLane[];
};

/** 軸上の位置（%）。0〜100 に収め、小数 2 桁に丸める */
export function schedulePct(day: number, start: number, end: number): number {
  const total = end - start;
  if (total <= 0) return 0;
  const pct = ((day - start) / total) * 100;
  return Math.round(Math.min(100, Math.max(0, pct)) * 100) / 100;
}

/** 軸の最大の長さ（月）。超えたら描かない */
const MAX_MONTHS = 36;

const splitPipes = (text: string): string[] => text.split(/[|｜]/).map((c) => c.trim());

/** `A .. B` を 2 つの通算日数へ（どちらかが読めなければ null。順序は見ない） */
function parseDatePair(text: string): [number, number] | null {
  const parts = text.split(/\s*\.\.\s*/);
  if (parts.length !== 2) return null;
  const a = parseScheduleDate(parts[0]);
  const b = parseScheduleDate(parts[1]);
  return a !== null && b !== null ? [a, b] : null;
}

/** `A .. B` を開始・終了へ（逆順は null） */
function parseRange(text: string): { start: number; end: number } | null {
  const pair = parseDatePair(text);
  return pair && pair[0] <= pair[1] ? { start: pair[0], end: pair[1] } : null;
}

/**
 * `::: schedule` の中身（行の配列）を読む。読めない行は捨てる。
 * 最初の `lane:` より前の行は名前なしの 1 レーンに入る。レーンが 1 つも作れなければ null
 */
export function parseSchedule(body: string[]): ScheduleData | null {
  let range: { start: number; end: number } | null = null;
  const lanes: ScheduleLane[] = [];
  let cur: ScheduleLane | null = null;
  const lane = (): ScheduleLane => {
    if (!cur) {
      cur = { name: "", plan: null, span: null, actuals: [], delays: [], milestones: [] };
      lanes.push(cur);
    }
    return cur;
  };

  for (const raw of body) {
    const line = raw.trim();
    if (!line) continue;

    const key = line.match(/^(range|lane|legend)\s*[:：]\s*(.*)$/i);
    if (key) {
      const k = key[1].toLowerCase();
      if (k === "range") {
        const pair = parseDatePair(key[2]);
        if (pair && monthStartOf(pair[0]) <= monthStartOf(pair[1])) {
          range = { start: monthStartOf(pair[0]), end: nextMonthStartOf(pair[1]) };
        }
      } else if (k === "lane") {
        cur = { name: key[2].trim(), plan: null, span: null, actuals: [], delays: [], milestones: [] };
        lanes.push(cur);
      }
      // legend は受け付けて読み捨てる
      continue;
    }

    const item = line.match(/^[-*+]\s+(.*)$/);
    if (!item) continue;
    const typed = item[1].match(/^(plan|span|actual|delay)\s*[:：]\s*(.*)$/i);
    if (typed) {
      const kind = typed[1].toLowerCase();
      const [rangeText = "", label = ""] = splitPipes(typed[2]);
      const r = parseRange(rangeText);
      if (!r) continue;
      const l = lane();
      if (kind === "plan") {
        if (!l.plan) l.plan = r;
      } else if (kind === "span") {
        if (!l.span) l.span = r;
      } else {
        (kind === "actual" ? l.actuals : l.delays).push({ ...r, label });
      }
      continue;
    }
    const [dateText = "", ...labelParts] = splitPipes(item[1]);
    const day = parseScheduleDate(dateText);
    if (day === null) continue;
    const label = labelParts.join(" | ").trim();
    // 日付は自動で添える。ただし本文に M/D の形がすでにあれば添えない
    const text = /\d+\/\d+/.test(label) ? label : `${label} ${formatMD(day)}`.trim();
    lane().milestones.push({ day, label, text });
  }

  const used = lanes.filter((l) => l.plan || l.span || l.actuals.length || l.delays.length || l.milestones.length);
  if (used.length === 0) return null;

  let start: number;
  let end: number;
  if (range) {
    ({ start, end } = range);
  } else {
    const days: number[] = [];
    for (const l of used) {
      if (l.plan) days.push(l.plan.start, l.plan.end);
      if (l.span) days.push(l.span.start, l.span.end);
      for (const s of [...l.actuals, ...l.delays]) days.push(s.start, s.end);
      for (const m of l.milestones) days.push(m.day);
    }
    start = monthStartOf(Math.min(...days));
    end = nextMonthStartOf(Math.max(...days));
  }

  const months: ScheduleData["months"] = [];
  const firstYear = civilFromDays(start).y;
  const multiYear = civilFromDays(end - 1).y !== firstYear;
  for (let d = start; d < end; d = nextMonthStartOf(d)) {
    const { y, m } = civilFromDays(d);
    months.push({ label: `${m}月`, day: d, ...(multiYear && (d === start || m === 1) ? { year: y } : {}) });
    if (months.length > MAX_MONTHS) return null;
  }
  return { start, end, months, lanes: used };
}

/**
 * 期間の表示。月の 1 日から翌月 1 日まで = `N月`。終わりが月の 1 日なら前日までとして `M/D – M/D`
 * （例: 8/1..9/1 → 8月、5/17..9/1 → 5/17 – 8/31、9/1..11/1 → 9/1 – 10/31）
 */
export function formatSpan(start: number, end: number, withYear = false): string {
  const s = civilFromDays(start);
  if (s.d === 1 && end === nextMonthStartOf(start)) return withYear ? `${s.y}年${s.m}月` : `${s.m}月`;
  const last = civilFromDays(end).d === 1 && end > start ? end - 1 : end;
  const e = civilFromDays(last);
  const head = withYear ? `${s.y}/${s.m}/${s.d}` : `${s.m}/${s.d}`;
  return `${head} – ${withYear && e.y !== s.y ? `${e.y}/` : ""}${e.m}/${e.d}`;
}

/** 軸が年をまたぐか（縦一覧で年を添えるかの判断に使う） */
export const scheduleSpansYears = (data: ScheduleData): boolean => civilFromDays(data.start).y !== civilFromDays(data.end - 1).y;

/** 月の目盛りの文字幅の見積り（px）。13px の月ラベル・11px の年ラベル */
const monthLabelPx = (label: string): number => Array.from(label).reduce((sum, ch) => sum + ((ch.codePointAt(0) ?? 0) > 255 ? 13 : 7.4), 0);
const yearLabelPx = (year: number): number => String(year).length * 6.5 + 11;

/**
 * 月の目盛りで出すラベルと、年の段のラベル。月の間隔（トラック幅 trackPx から）が月ラベルの幅 + 8px より狭いときは、
 * 何個おきかに間引く（目盛りの位置は変えない）。年は最初の月と各 1 月に 1 つ。次の年ラベルに近すぎる最初の年は出さない
 */
export function scheduleAxisLabels(data: ScheduleData, trackPx = 560): { months: { label: string; day: number; show: boolean }[]; years: { year: number; day: number }[] } {
  const total = data.end - data.start;
  const xs = data.months.map((m) => ((m.day - data.start) / total) * trackPx);
  const pitch = data.months.length > 1 ? Math.min(...xs.slice(1).map((x, i) => x - xs[i])) : trackPx;
  const widest = Math.max(...data.months.map((m) => monthLabelPx(m.label)));
  const step = Math.max(1, Math.ceil((widest + 8) / Math.max(1, pitch)));
  const months = data.months.map((m, i) => ({ label: m.label, day: m.day, show: i % step === 0 }));
  const years = data.months.flatMap((m, i) => (m.year !== undefined ? [{ year: m.year, day: m.day, x: xs[i] }] : []));
  const kept = years.filter((y, i) => i !== 0 || years.length < 2 || years[1].x - y.x >= yearLabelPx(y.year) + 4);
  return { months, years: kept.map(({ year, day }) => ({ year, day })) };
}

/** 検証用: 月・年ラベルの横の範囲（px）。showMonths は scheduleAxisLabels の結果 */
export function axisLabelRects(data: ScheduleData, trackPx: number, labels: ReturnType<typeof scheduleAxisLabels>): { row: "month" | "year"; start: number; end: number }[] {
  const total = data.end - data.start;
  const x = (day: number) => ((day - data.start) / total) * trackPx;
  return [
    ...labels.months.filter((m) => m.show).map((m) => ({ row: "month" as const, start: x(m.day), end: x(m.day) + monthLabelPx(m.label) })),
    ...labels.years.map((y) => ({ row: "year" as const, start: x(y.day), end: x(y.day) + yearLabelPx(y.year) })),
  ];
}

/** 読み上げ用の 1 行の要約（レーン名と件数） */
export function summarizeSchedule(data: ScheduleData): string {
  const from = civilFromDays(data.start);
  const to = civilFromDays(data.end - 1);
  const lanes = data.lanes.map((l) => `${l.name || "全体"}(計画${l.plan ? "あり" : "なし"}・実績${l.actuals.length}・遅れ${l.delays.length}・節目${l.milestones.length})`);
  return `${from.y}年${from.m}月から${to.y}年${to.m}月の予定表。${lanes.join("、")}`;
}

export type ScheduleLabelInput = { pct: number; text: string; prefer: 0 | 1 };

/** 文字幅の見積り（px・11px 文字。全角は 11、半角は 6.5 と多めに見る） */
const textWidthPx = (text: string): number => Array.from(text).reduce((sum, ch) => sum + ((ch.codePointAt(0) ?? 0) > 255 ? 11 : 6.5), 0);
/** ラベルの右寄せに切り替える位置（これより右の位置は、右端をその位置にそろえる） */
export const SCHEDULE_RIGHT_ALIGN_PCT = 70;
export const SCHEDULE_LABEL_ROWS = 3;
/** チャートが出るのは容器 640px 以上。トラックはそれより狭く 560px とみなす（実際はより広いので見積りは安全側） */
const TRACK_PX = 560;
const LABEL_GAP_PX = 12;

/**
 * ラベルの横の範囲（%）と寄せ方（配置と描画で共有する唯一の実装）。
 * 左寄せ（位置の 6px 左から右へ）の右端が 100% を超えるか、位置が 70% 超なら右寄せ（右端を位置にそろえる）。
 * ただし右寄せにすると左端が 0% を下回るときは左寄せのまま。
 * 左寄せの左端（位置の 6px 左）が 0% を下回るとき（位置が始点に近い）は、左端を 0% にそろえる（clampLeft。右端の規則の鏡）
 */
export function scheduleLabelExtent(it: ScheduleLabelInput): { start: number; end: number; alignRight: boolean; clampLeft: boolean } {
  const pxPct = 100 / TRACK_PX;
  const w = textWidthPx(it.text) * pxPct;
  const leftStart = it.pct - 6 * pxPct;
  const wantRight = it.pct > SCHEDULE_RIGHT_ALIGN_PCT || leftStart + w > 100;
  if (wantRight && it.pct - w >= 0) return { start: it.pct - w, end: it.pct, alignRight: true, clampLeft: false };
  if (leftStart < 0) return { start: 0, end: w, alignRight: false, clampLeft: true };
  return { start: leftStart, end: leftStart + w, alignRight: false, clampLeft: false };
}

/**
 * 軸の下に置くラベルを最大 3 段（0 / 1 / 2）へ振り分け、寄せ方も返す。結果は入力と同じ並び。
 * 位置の昇順に、希望の段（prefer）→ ほかの段の順で、先に置いた文字の見積り幅と重ならない最初の段へ置く。
 * 全部の段で重なるときは、最後の文字の右端がいちばん左にある段。見積りは幅 560px のトラック基準
 */
export function placeScheduleLabels(items: ScheduleLabelInput[]): { row: number; alignRight: boolean; clampLeft: boolean }[] {
  const gap = LABEL_GAP_PX * (100 / TRACK_PX);
  const rows: [number, number][][] = Array.from({ length: SCHEDULE_LABEL_ROWS }, () => []);
  const result = items.map(() => ({ row: 0, alignRight: false, clampLeft: false }));
  const order = items.map((_, i) => i).sort((a, b) => items[a].pct - items[b].pct || a - b);
  for (const i of order) {
    const { start: s, end: e, alignRight, clampLeft } = scheduleLabelExtent(items[i]);
    const tryOrder = [items[i].prefer, ...Array.from({ length: SCHEDULE_LABEL_ROWS }, (_, r) => r).filter((r) => r !== items[i].prefer)];
    let row = tryOrder.find((r) => rows[r].every(([rs, re]) => e + gap <= rs || re + gap <= s));
    if (row === undefined) {
      const lastEnd = (r: number) => Math.max(...rows[r].map(([, re]) => re));
      row = tryOrder.reduce((best, r) => (lastEnd(r) < lastEnd(best) ? r : best), tryOrder[0]);
    }
    rows[row].push([s, e]);
    result[i] = { row, alignRight, clampLeft };
  }
  return result;
}
