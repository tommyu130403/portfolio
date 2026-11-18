/** セクション見出しの番号（1 始まりの連番を 2 桁にそろえる。例: 3 → "03"） */
export const sectionNumber = (n: number): string => String(n).padStart(2, "0");
