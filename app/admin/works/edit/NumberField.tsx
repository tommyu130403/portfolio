"use client";

import { useState } from "react";

/**
 * 数値入力を整数へ。空欄・非数値・min 未満は min に丸める
 * （`Number(v) || 既定値` だと空欄で恣意的な大きい既定へ飛ぶ・0 を握り潰すため）。
 */
const clampInt = (v: string, min: number): number => {
  const parsed = Number(v.trim());
  if (v.trim() === "" || !Number.isFinite(parsed)) return min;
  return Math.max(min, Math.trunc(parsed));
};

export default function NumberField({ value, min, max, onCommit, className = "", disabled = false }: { value: number; min: number; max: number; onCommit: (n: number) => void; className?: string; disabled?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Math.max(min, Math.min(max, clampInt(draft, min)));
    setDraft(null);
    if (n !== value) onCommit(n);
  };
  return (
    <input
      type="number"
      min={min}
      max={max}
      disabled={disabled}
      value={draft ?? String(value)}
      onFocus={() => setDraft(String(value))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      className={`rounded-[8px] border border-border-light bg-[#1a1a1a] px-2 py-1 text-[13px] text-white outline-none transition-colors focus:border-primary disabled:opacity-40 ${className}`}
    />
  );
}
