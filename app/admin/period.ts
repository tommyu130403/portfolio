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
