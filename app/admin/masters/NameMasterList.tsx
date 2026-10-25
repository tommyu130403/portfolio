"use client";

import { useState } from "react";
import { FormGroupHeader, Input } from "../AdminLayout";

const smallButton =
  "shrink-0 rounded-[6px] border border-border-light px-3 py-1 text-[11px] text-fg-muted transition-colors hover:border-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40";
const dangerButton =
  "shrink-0 rounded-[6px] px-2 py-1 text-[11px] text-system-700 hover:bg-danger-300/10 hover:text-danger-300 disabled:cursor-not-allowed disabled:opacity-40";

export type NameMasterListItem = { id: string; name: string; usage: string; used: boolean };

/** Enter で実行する（IME 変換中の Enter は無視） */
function onEnter(run: () => void) {
  return (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName !== "INPUT") return;
    if (e.key === "Enter" && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
      e.preventDefault();
      run();
    }
  };
}

/** 名前だけを持つマスタ（会社・役割・工程名）の一覧・追加・改名・削除 */
export default function NameMasterList({
  title,
  placeholder,
  hint,
  items,
  busy,
  onAdd,
  onRename,
  onDelete,
  allowDeleteUsed,
}: {
  title: string;
  placeholder: string;
  hint?: string;
  items: NameMasterListItem[];
  busy: boolean;
  onAdd: (name: string) => Promise<boolean>;
  onRename: (id: string, name: string) => Promise<boolean>;
  onDelete: (item: NameMasterListItem) => void;
  allowDeleteUsed?: boolean;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const handleAdd = async () => {
    if (!newName.trim()) return;
    if (await onAdd(newName)) setNewName("");
  };

  const handleSave = async (id: string) => {
    if (await onRename(id, draft)) setEditingId(null);
  };

  return (
    <div className="mt-10">
      <FormGroupHeader>{title}</FormGroupHeader>
      {hint && <p className="mt-2 text-[12px] text-fg-muted">{hint}</p>}
      <div className="mt-3 flex items-center gap-2" onKeyDown={onEnter(() => void handleAdd())}>
        <Input value={newName} onChange={setNewName} placeholder={placeholder} />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={busy || !newName.trim()}
          className={smallButton}
        >
          追加
        </button>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((it) => {
          if (editingId === it.id) {
            return (
              <li
                key={it.id}
                className="flex items-center gap-2 rounded-[8px] border border-primary/40 bg-surface p-3"
              >
                <div className="min-w-0 flex-1" onKeyDown={onEnter(() => void handleSave(it.id))}>
                  <Input value={draft} onChange={setDraft} />
                </div>
                <button type="button" onClick={() => void handleSave(it.id)} disabled={busy} className={smallButton}>
                  保存
                </button>
                <button type="button" onClick={() => setEditingId(null)} disabled={busy} className={smallButton}>
                  キャンセル
                </button>
              </li>
            );
          }
          return (
            <li
              key={it.id}
              className="flex items-center gap-3 rounded-[8px] border border-border-light bg-surface px-3 py-2"
            >
              <span className="flex-1 text-[13px] text-white">{it.name}</span>
              <span className="text-[11px] text-fg-muted">{it.usage}</span>
              <button
                type="button"
                onClick={() => {
                  setEditingId(it.id);
                  setDraft(it.name);
                }}
                disabled={busy}
                className={smallButton}
              >
                名前変更
              </button>
              <button
                type="button"
                onClick={() => onDelete(it)}
                disabled={busy || (it.used && !allowDeleteUsed)}
                title={it.used && !allowDeleteUsed ? "使用中のため削除できません" : undefined}
                className={dangerButton}
              >
                削除
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
