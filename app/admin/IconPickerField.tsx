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

const MAX_SEARCH_RESULTS = 240;

export default function IconPickerField({
  value,
  onChange,
  catalog,
  allowEmpty = false,
  className = "",
  align = "right",
  disabled = false,
}: {
  value: IconValue | null;
  onChange: (v: IconValue | null) => void;
  catalog: IconCatalog;
  allowEmpty?: boolean;
  className?: string;
  align?: "left" | "right";
  disabled?: boolean;
}) {
  const entry = value ? catalog.find((e) => e.set === value.set) : undefined;
  const registered =
    !!value &&
    !!entry &&
    entry.names.includes(value.name) &&
    (ICON_SETS as readonly string[]).includes(value.set);

  // 描画できるセット（Icon が知っているセット）だけを一覧に出す
  const sets = catalog.filter((e) => (ICON_SETS as readonly string[]).includes(e.set));

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeSet, setActiveSet] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
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
  const matches = q
    ? sets.flatMap((e) =>
        e.names
          .filter((n) => `${e.set}/${n}`.toLowerCase().includes(q))
          .map((n) => ({ set: e.set, name: n })),
      )
    : [];
  const searchShown = matches.slice(0, MAX_SEARCH_RESULTS);
  const activeNames = sets.find((e) => e.set === activeSet)?.names ?? [];

  const toggle = () => {
    if (disabled) return;
    if (!open) {
      setQuery("");
      setActiveSet(value && sets.some((e) => e.set === value.set) ? value.set : (sets[0]?.set ?? ""));
    }
    setOpen((o) => !o);
  };

  const pick = (set: string, name: string) => {
    onChange({ set, name });
    setOpen(false);
  };

  const iconButton = (set: string, name: string) => {
    const active = !!value && value.set === set && value.name === name;
    return (
      <button
        key={`${set}/${name}`}
        type="button"
        title={`${set}/${name}`}
        aria-label={`${set}/${name}`}
        aria-pressed={active}
        onClick={() => pick(set, name)}
        className={`flex size-9 items-center justify-center rounded-[6px] transition-colors ${
          active ? "bg-main-100/20 ring-1 ring-primary" : "hover:bg-[#1f1f1f]"
        }`}
      >
        <Icon set={set as IconSet} name={name} tintColor="var(--color-system-white)" className="h-5 w-5" />
      </button>
    );
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggle}
        className="flex max-w-full items-center gap-2 rounded-[8px] border border-border-light bg-[#1a1a1a] py-1 pl-1 pr-2.5 text-left text-[13px] text-white transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-border-light bg-[#0a0a0a]">
          {registered ? (
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
        <span className="min-w-0 truncate">
          {!value ? "（なし）" : registered ? value.name : `${value.set}/${value.name}（未登録）`}
        </span>
      </button>
      {open && !disabled && (
        <div className={`absolute ${align === "left" ? "left-0" : "right-0"} top-full z-50 mt-1 flex w-[400px] max-w-[90vw] flex-col gap-2 rounded-[8px] border border-border-light bg-[#0a0a0a] p-2 shadow-lg`}>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="アイコン名で全セットから検索"
              aria-label="アイコン名で検索"
              className="min-w-0 flex-1 rounded-[6px] border border-border-light bg-[#1a1a1a] px-2 py-1 text-[12px] text-white outline-none focus:border-primary"
            />
            {allowEmpty && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="shrink-0 rounded-[6px] border border-border-light bg-[#1a1a1a] px-2 py-1 text-[12px] text-system-500 transition-colors hover:border-primary hover:text-white"
              >
                なし
              </button>
            )}
          </div>
          {q ? (
            <>
              <div className="grid max-h-[280px] grid-cols-9 gap-1 overflow-y-auto">
                {searchShown.map((m) => iconButton(m.set, m.name))}
              </div>
              {matches.length === 0 && (
                <p className="px-1 text-[11px] text-fg-muted">該当するアイコンがありません</p>
              )}
              {matches.length > MAX_SEARCH_RESULTS && (
                <p className="px-1 text-[11px] text-fg-muted">
                  一致 {matches.length} 件のうち先頭 {MAX_SEARCH_RESULTS} 件を表示しています
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-1">
                {sets.map((e) => (
                  <button
                    key={e.set}
                    type="button"
                    aria-pressed={e.set === activeSet}
                    onClick={() => setActiveSet(e.set)}
                    className={`rounded-[6px] border px-2 py-0.5 text-[11px] transition-colors ${
                      e.set === activeSet
                        ? "border-primary bg-main-100/20 text-white"
                        : "border-border-light text-system-500 hover:text-white"
                    }`}
                  >
                    {e.set}
                  </button>
                ))}
              </div>
              <div className="grid max-h-[280px] grid-cols-9 gap-1 overflow-y-auto">
                {activeNames.map((n) => iconButton(activeSet, n))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
