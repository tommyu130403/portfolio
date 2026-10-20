"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "../../AdminLayout";
import {
  addWorkCategory,
  checkWorkCategoryDeletable,
  deleteWorkCategory,
  listWorkCategories,
  renameWorkCategory,
  type WorkCategory,
} from "../../actions";

const smallButton =
  "shrink-0 rounded-[6px] border border-border-light px-3 py-1 text-[11px] text-fg-muted transition-colors hover:border-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40";
const dangerButton =
  "shrink-0 rounded-[6px] px-2 py-1 text-[11px] text-system-700 hover:bg-danger-300/10 hover:text-danger-300 disabled:cursor-not-allowed disabled:opacity-40";

export default function WorkCategoryField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

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

  const handleRename = async (c: WorkCategory) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await renameWorkCategory(c.id, editingName);
    if (res.error) {
      setError(res.error);
    } else {
      await refresh();
      if (value === c.name) onChange(editingName.trim());
      setEditingId(null);
    }
    setBusy(false);
  };

  const handleDelete = async (c: WorkCategory) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const usage = await checkWorkCategoryDeletable(c.name);
    if (usage.error) {
      setError(usage.error);
      setBusy(false);
      return;
    }
    if (!window.confirm(`カテゴリ「${c.name}」を削除しますか？`)) {
      setBusy(false);
      return;
    }
    const res = await deleteWorkCategory(c.id);
    if (res.error) setError(res.error);
    else await refresh();
    setBusy(false);
  };

  const isLegacy = value !== null && !categories.some((c) => c.name === value);

  return (
    <div className="flex flex-col gap-2">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-[8px] border border-border-light bg-[#1a1a1a] px-3 py-2 text-[14px] text-white outline-none transition-colors focus:border-primary"
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

      <button
        type="button"
        onClick={() => setManaging((v) => !v)}
        className="self-start text-[11px] text-primary hover:underline"
      >
        {managing ? "カテゴリの管理を閉じる" : "カテゴリを管理"}
      </button>

      {managing && (
        <ul className="flex flex-col gap-1 rounded-[8px] border border-border-light p-2">
          {categories.length === 0 && (
            <li className="text-[12px] text-fg-muted">カテゴリはまだありません</li>
          )}
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              {editingId === c.id ? (
                <>
                  <div
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
                        e.preventDefault();
                        void handleRename(c);
                      }
                    }}
                  >
                    <Input value={editingName} onChange={setEditingName} />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRename(c)}
                    disabled={busy || !editingName.trim()}
                    className={smallButton}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    disabled={busy}
                    className={smallButton}
                  >
                    キャンセル
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-[13px] text-white">{c.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(c.id);
                      setEditingName(c.name);
                      setError(null);
                    }}
                    disabled={busy}
                    className={smallButton}
                  >
                    名前変更
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(c)}
                    disabled={busy}
                    className={dangerButton}
                  >
                    削除
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-[12px] text-danger-300">{error}</p>}
    </div>
  );
}
