"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "../../AdminLayout";
import {
  addWorkCategory,
  listWorkCategories,
  type WorkCategory,
} from "../../actions";

const smallButton =
  "shrink-0 rounded-[6px] border border-border-light px-3 py-1 text-[11px] text-fg-muted transition-colors hover:border-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

export default function WorkCategoryField({
  value,
  onChange,
  dirty,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  dirty?: boolean;
}) {
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await listWorkCategories();
    if (res.error) setError(res.error);
    else setCategories(res.data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    listWorkCategories().then((res) => {
      if (cancelled) return;
      if (res.error) setError(res.error);
      else setCategories(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAdd = async () => {
    if (busy || !newName.trim()) return;
    setBusy(true);
    setError(null);
    const res = await addWorkCategory(newName);
    if (res.error || !res.category) {
      setError(res.error ?? "カテゴリを追加できませんでした");
    } else {
      await refresh();
      onChange(res.category.name);
      setNewName("");
    }
    setBusy(false);
  };

  const isLegacy = value !== null && !categories.some((c) => c.name === value);

  return (
    <div className="flex flex-col gap-2">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={`w-full rounded-[8px] border border-border-light bg-[#1a1a1a] px-3 py-2 text-[14px] outline-none transition-colors focus:border-primary ${value ? "text-white" : "text-system-750"}`}
      >
        <option value="">（未設定）</option>
        {isLegacy && <option value={value}>{value}（未登録）</option>}
        {categories.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>

      <div
        className="flex items-center gap-2"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
            e.preventDefault();
            void handleAdd();
          }
        }}
      >
        <Input value={newName} onChange={setNewName} placeholder="新しいカテゴリ名" />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={busy || !newName.trim()}
          className={smallButton}
        >
          追加
        </button>
      </div>

      <Link
        href="/admin/masters"
        className="self-start text-[11px] text-primary hover:underline"
        onClick={(e) => {
          if (dirty && !window.confirm("未保存の変更があります。破棄してマスタ管理へ移動しますか？")) e.preventDefault();
        }}
      >
        カテゴリの改名・削除は「マスタ管理」で
      </Link>

      {error && <p className="text-[12px] text-danger-300">{error}</p>}
    </div>
  );
}
