"use client";

import { useEffect, useRef, useState } from "react";
import Icon, { ICON_SETS, type IconSet } from "@/components/Icon";
import type { IconCatalog } from "./iconCatalogTypes";

export type IconValue = { set: string; name: string };

/** "Set/name" 形式の文字列を分解する。形式外なら null。 */
export function parseIconRef(ref: string | null | undefined): IconValue | null {
  if (!ref) return null;
  const i = ref.indexOf("/");
  if (i <= 0 || i === ref.length - 1) return null;
  return { set: ref.slice(0, i), name: ref.slice(i + 1) };
}

/** IconValue を "Set/name" 文字列へ。null なら undefined。 */
export function formatIconRef(v: IconValue | null): string | undefined {
  return v ? `${v.set}/${v.name}` : undefined;
}

const selectClass =
  "min-w-0 flex-1 rounded-[8px] border border-border-light bg-[#1a1a1a] px-2 py-1.5 text-[13px] text-white outline-none transition-colors focus:border-primary disabled:opacity-40";

export default function IconPickerField({
  value,
  onChange,
  catalog,
  allowEmpty = false,
  className = "",
}: {
  value: IconValue | null;
  onChange: (v: IconValue | null) => void;
  catalog: IconCatalog;
  allowEmpty?: boolean;
  className?: string;
}) {
  const entry = value ? catalog.find((e) => e.set === value.set) : undefined;
  const names = entry?.names ?? [];
  const canPreview =
    !!value &&
    !!entry &&
    names.includes(value.name) &&
    (ICON_SETS as readonly string[]).includes(value.set);

  // アイコン一覧パネル（選択中のセットのアイコンを絵で並べて選べるようにする）
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const canBrowse = !!value && !!entry && (ICON_SETS as readonly string[]).includes(value.set);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const q = query.trim().toLowerCase();
  const shown = q ? names.filter((n) => n.toLowerCase().includes(q)) : names;

  const handleSet = (set: string) => {
    if (set === "") {
      if (allowEmpty) onChange(null);
      return;
    }
    const next = catalog.find((e) => e.set === set);
    if (!next) return;
    const name = value && next.names.includes(value.name) ? value.name : next.names[0];
    onChange({ set, name });
  };

  return (
    <div ref={rootRef} className={`relative flex items-center gap-2 ${className}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-border-light bg-[#1a1a1a]">
        {canPreview ? (
          <Icon
            set={value.set as IconSet}
            name={value.name}
            tintColor="var(--color-system-white)"
            className="h-5 w-5"
          />
        ) : (
          <span className="text-[10px] text-system-700">—</span>
        )}
      </span>
      <select
        aria-label="アイコンセット"
        value={value?.set ?? ""}
        onChange={(e) => handleSet(e.target.value)}
        className={selectClass}
      >
        {(allowEmpty || !value) && <option value="">（なし）</option>}
        {value && !entry && !(value.set === "" && allowEmpty) && (
          <option value={value.set}>{value.set ? `${value.set}（未登録）` : "（未登録）"}</option>
        )}
        {catalog.map((e) => (
          <option key={e.set} value={e.set}>
            {e.set}
          </option>
        ))}
      </select>
      <select
        aria-label="アイコン名"
        value={value?.name ?? ""}
        onChange={(e) => value && onChange({ set: value.set, name: e.target.value })}
        disabled={!value || !entry}
        className={selectClass}
      >
        {!value && <option value="">—</option>}
        {value && !names.includes(value.name) && (
          <option value={value.name}>{value.name}（未登録）</option>
        )}
        {names.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label="アイコン一覧から選ぶ"
        aria-expanded={open}
        disabled={!canBrowse}
        onClick={() => {
          setQuery("");
          setOpen((o) => !o);
        }}
        className="shrink-0 rounded-[8px] border border-border-light bg-[#1a1a1a] px-2 py-1.5 text-[12px] text-system-500 transition-colors hover:border-primary hover:text-white disabled:opacity-40 disabled:hover:border-border-light disabled:hover:text-system-500"
      >
        一覧
      </button>
      {open && canBrowse && (
        <div className="absolute right-0 top-full z-50 mt-1 flex w-[344px] flex-col gap-2 rounded-[8px] border border-border-light bg-[#0a0a0a] p-2 shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${value.set} から名前で絞り込み`}
            aria-label="アイコン名で絞り込み"
            className="rounded-[6px] border border-border-light bg-[#1a1a1a] px-2 py-1 text-[12px] text-white outline-none focus:border-primary"
          />
          <div className="grid max-h-[240px] grid-cols-8 gap-1 overflow-y-auto">
            {shown.map((n) => {
              const active = n === value.name;
              return (
                <button
                  key={n}
                  type="button"
                  title={n}
                  aria-label={n}
                  aria-pressed={active}
                  onClick={() => {
                    onChange({ set: value.set, name: n });
                    setOpen(false);
                  }}
                  className={`flex size-9 items-center justify-center rounded-[6px] transition-colors ${
                    active ? "bg-main-100/20 ring-1 ring-primary" : "hover:bg-[#1f1f1f]"
                  }`}
                >
                  <Icon set={value.set as IconSet} name={n} tintColor="var(--color-system-white)" className="h-5 w-5" />
                </button>
              );
            })}
          </div>
          {shown.length === 0 && <p className="px-1 text-[11px] text-fg-muted">該当するアイコンがありません</p>}
        </div>
      )}
    </div>
  );
}
