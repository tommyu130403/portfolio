import { ymFromDate } from "./timeline-scale";

/* 表示用に Figma 表記へ整形： "2023年12月" / "2022.04" → "2023.12" / "2022.4"（ゼロ埋めなし） */
export function formatPeriodLabel(period: string): string {
  return period
    // YYYY年M月 / YYYY.MM → YYYY.M（ゼロ埋め除去）
    .replace(/(\d{4})\s*[年.]\s*(\d{1,2})\s*月?/g, (_, y, m) => `${y}.${parseInt(m, 10)}`)
    // 月欠落の YYYY年 → YYYY（和暦表記の取り残しを防ぐ）
    .replace(/(\d{4})\s*年/g, "$1")
    // 区切りを正規化
    .replace(/\s*[-–−~〜]\s*/g, " - ");
}

const ymLabel = (d: string | null): string => {
  const ym = ymFromDate(d);
  return ym ? `${ym.year}.${ym.month}` : "";
};

/** 作品カードの期間表示。start_date があればそこから、無ければ period 文字列を整形して返す */
export function workPeriodLabel(w: {
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  period: string | null;
}): string | null {
  const start = ymLabel(w.start_date);
  if (start) {
    const end = w.is_current ? "現在" : ymLabel(w.end_date);
    return `${start} - ${end}`;
  }
  if (w.period && w.period.trim()) return formatPeriodLabel(w.period);
  return null;
}
