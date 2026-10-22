export type PeriodInputs = { startYear: string; startMonth: string; endYear: string; endMonth: string; isCurrent: boolean };

export const EMPTY_PERIOD: PeriodInputs = { startYear: "", startMonth: "", endYear: "", endMonth: "", isCurrent: false };

const PERIOD_RE = /^(\d{4})年(\d{1,2})月\s*-\s*(現在|(\d{4})年(\d{1,2})月)?$/;

export function isStandardPeriod(period: string | null): boolean {
  return PERIOD_RE.test(period ?? "");
}

export function parsePeriod(period: string | null): PeriodInputs {
  const m = (period ?? "").match(PERIOD_RE);
  if (!m) return { ...EMPTY_PERIOD };
  return {
    startYear: m[1] ?? "",
    startMonth: m[2] ?? "",
    endYear: m[4] ?? "",
    endMonth: m[5] ?? "",
    isCurrent: m[3] === "現在",
  };
}

function toHalfWidthDigits(v: string): string {
  return v.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

function normalizeNum(v: string): string {
  const h = toHalfWidthDigits(v.trim());
  return /^\d+$/.test(h) ? String(Number(h)) : h;
}

export function normalizePeriod(p: PeriodInputs): PeriodInputs {
  return {
    ...p,
    startYear: normalizeNum(p.startYear),
    startMonth: normalizeNum(p.startMonth),
    endYear: normalizeNum(p.endYear),
    endMonth: normalizeNum(p.endMonth),
  };
}

export function formatPeriod(p: PeriodInputs): string | null {
  const n = normalizePeriod(p);
  const sy = n.startYear;
  const sm = n.startMonth;
  if (!sy || !sm) return null;
  const start = `${sy}年${sm}月`;
  const end = n.isCurrent ? "現在" : n.endYear && n.endMonth ? `${n.endYear}年${n.endMonth}月` : "";
  return end ? `${start} - ${end}` : `${start} - `;
}

export function validatePeriod(p: PeriodInputs): string | null {
  const n = normalizePeriod(p);
  const inRange = (v: string, min: number, max: number) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max;
  const fields: { label: string; year: string; month: string }[] = [{ label: "開始", year: n.startYear, month: n.startMonth }];
  if (!n.isCurrent) fields.push({ label: "終了", year: n.endYear, month: n.endMonth });
  for (const f of fields) {
    if (f.year && !inRange(f.year, 1900, 2100)) return `${f.label}年は 1900〜2100 の西暦で入力してください`;
    if (f.month && !inRange(f.month, 1, 12)) return `${f.label}月は 1〜12 で入力してください`;
    if (f.month && !f.year) return `${f.label}月を入力する場合は${f.label}年も入力してください`;
    if (f.year && !f.month) return `${f.label}年を入力する場合は${f.label}月も入力してください`;
  }
  if (!n.startYear && (n.isCurrent || n.endYear)) return "開始年月を入力してください";
  if (!n.isCurrent && n.startYear && n.endYear && Number(n.endYear) * 12 + Number(n.endMonth) < Number(n.startYear) * 12 + Number(n.startMonth)) return "終了は開始より後にしてください";
  return null;
}

export function isSamePeriod(a: PeriodInputs, b: PeriodInputs): boolean {
  return (
    a.startYear === b.startYear &&
    a.startMonth === b.startMonth &&
    a.endYear === b.endYear &&
    a.endMonth === b.endMonth &&
    a.isCurrent === b.isCurrent
  );
}

export type PeriodColumns = { start_date: string | null; end_date: string | null; is_current: boolean };

const pad2 = (v: string) => v.padStart(2, "0");

/** 入力欄の値を DB の日付 3 列へ変換する（月単位。日は常に 1 日）。開始が空なら全部空。 */
export function toPeriodColumns(p: PeriodInputs): PeriodColumns {
  const n = normalizePeriod(p);
  if (!n.startYear || !n.startMonth) return { start_date: null, end_date: null, is_current: false };
  const start_date = `${n.startYear}-${pad2(n.startMonth)}-01`;
  if (n.isCurrent) return { start_date, end_date: null, is_current: true };
  const end_date = n.endYear && n.endMonth ? `${n.endYear}-${pad2(n.endMonth)}-01` : null;
  return { start_date, end_date, is_current: false };
}

function splitDate(d: string | null): { year: string; month: string } {
  if (!d) return { year: "", month: "" };
  const [y, m] = d.slice(0, 7).split("-");
  return { year: y ?? "", month: m ? String(Number(m)) : "" };
}

/** DB の日付 3 列を入力欄の値へ戻す。 */
export function fromPeriodColumns(c: PeriodColumns): PeriodInputs {
  const s = splitDate(c.start_date);
  const e = c.is_current ? { year: "", month: "" } : splitDate(c.end_date);
  return { startYear: s.year, startMonth: s.month, endYear: e.year, endMonth: e.month, isCurrent: c.is_current };
}

type PeriodRow = { period: string | null; start_date: string | null; end_date: string | null; is_current: boolean };

/** 行から入力欄の値を作る。日付があればそれを、無ければ文字を読む（旧形式は空欄）。 */
export function periodInputsOf(row: PeriodRow | null | undefined): PeriodInputs {
  if (!row) return { ...EMPTY_PERIOD };
  if (row.start_date) return fromPeriodColumns(row);
  return parsePeriod(row.period);
}

/** 日付が空で、文字だけが入力欄で読めない形の行か。 */
export function isLegacyPeriod(row: PeriodRow | null | undefined): boolean {
  return !!row && !row.start_date && (row.period ?? "").trim() !== "" && !isStandardPeriod(row.period);
}

/**
 * 保存用の期間 4 列（period 文字 + 日付 3 列）を決める。
 * 期間欄を触っていない行は変換しない。旧形式の文字や範囲外の値（例: 2022年13月）を
 * 無関係な保存のついでに日付へ変換すると、DB が生のエラーで弾くため。
 */
export function periodColumnsForSave(
  row: PeriodRow,
  inputs: PeriodInputs,
  touched: boolean,
): PeriodColumns & { period: string | null } {
  if (touched) return { period: formatPeriod(inputs), ...toPeriodColumns(inputs) };
  if (row.start_date != null) {
    return { period: row.period, start_date: row.start_date, end_date: row.end_date, is_current: row.is_current };
  }
  return { period: row.period, start_date: null, end_date: null, is_current: false };
}
