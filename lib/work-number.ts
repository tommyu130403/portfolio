/** 作品番号 (works.work_no) を管理画面用の表示 "W01" にする。100 以上は "W100"。未採番（null・0 以下）は空文字。 */
export function formatWorkNo(n: number | null | undefined): string {
  if (n == null || !Number.isInteger(n) || n < 1) return "";
  return `W${String(n).padStart(2, "0")}`;
}
