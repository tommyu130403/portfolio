"use client";

import { useState } from "react";
import { Input } from "./AdminLayout";
import type { NameMaster } from "./actions";

const smallButton =
  "shrink-0 rounded-[6px] border border-border-light px-3 py-1 text-[11px] text-fg-muted transition-colors hover:border-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40";
const selectClass =
  "w-full rounded-[8px] border border-border-light bg-[#1a1a1a] px-3 py-2 text-[14px] outline-none transition-colors focus:border-primary";

const LEGACY = "__legacy__";

/** マスタから選ぶ選択欄。その場で新しい項目も追加できる */
export default function MasterSelect({
  value,
  legacyText,
  options,
  onSelect,
  onAdd,
  placeholder,
  addPlaceholder,
}: {
  value: string | null;
  legacyText: string;
  options: NameMaster[];
  onSelect: (item: NameMaster | null) => void;
  onAdd: (name: string) => Promise<{ error: string | null; item?: NameMaster }>;
  placeholder: string;
  addPlaceholder: string;
}) {
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLegacy = legacyText.trim() !== "";
  const valueMissing = value !== null && !options.some((o) => o.id === value);

  const handleAdd = async () => {
    if (busy || !newName.trim()) return;
    setBusy(true);
    setError(null);
    const res = await onAdd(newName);
    if (res.error || !res.item) {
      setError(res.error ?? "追加できませんでした");
    } else {
      onSelect(res.item);
      setNewName("");
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <select
        value={value ?? (hasLegacy ? LEGACY : "")}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") onSelect(null);
          else if (v === LEGACY) return;
          else onSelect(options.find((o) => o.id === v) ?? null);
        }}
        className={`${selectClass} ${value === null && !hasLegacy ? "text-system-750" : "text-white"}`}
      >
        <option value="">{placeholder}</option>
        {value === null && hasLegacy && <option value={LEGACY}>{legacyText}（未登録）</option>}
        {valueMissing && <option value={value}>{legacyText}（未登録）</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      <div
        className="flex items-center gap-2"
        onKeyDown={(e) => {
          if ((e.target as HTMLElement).tagName !== "INPUT") return;
          if (e.key === "Enter" && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
            e.preventDefault();
            void handleAdd();
          }
        }}
      >
        <Input value={newName} onChange={setNewName} placeholder={addPlaceholder} />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={busy || !newName.trim()}
          className={smallButton}
        >
          追加
        </button>
      </div>

      {error && <p className="text-[12px] text-danger-300">{error}</p>}
    </div>
  );
}
