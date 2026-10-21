"use client";

import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import {
  saveSkillCard,
  deleteSkillCard,
  addSkillCard,
  moveSkillCards,
  saveSkillBar,
  deleteSkillBar,
  addSkillBar,
  saveExperienceToolIds,
  moveSkillBars,
  addToolNameFromWorks,
  listStorageImages,
  uploadStorageImage,
  listFlowcharts,
  deleteFlowchart,
  duplicateFlowchart,
  setWorkPublished,
  saveWorksOrder,
} from "@/app/admin/actions";
import type {
  FlowchartRow,
  StorageImage,
} from "@/app/admin/actions";
import type { Tables } from "@/src/types/supabase";
import { type ProofreadIssue, runProofread } from "@/lib/proofread-client";
import { parseFlowchart } from "@/lib/flowchart";
import { compressImage } from "@/lib/compress-image";
import { SkillCard as PublicSkillCard, SKILL_LEVELS, segmentsToLevel, type SkillCardConfig } from "@/src/components/SkillsCardGrid";
import PublishToggle from "./PublishToggle";
import MastersSection from "./masters/MastersSection";
import IconPickerField, { type IconValue } from "./IconPickerField";
import type { IconCatalog } from "./iconCatalogTypes";
import { NAV_SECTIONS, type AdminSectionId } from "./sections";

// ─── 型 ───────────────────────────────────────────────
type Profile    = Tables<"profile">;
type CareerItem = Tables<"career_items">;
type SkillCard       = Tables<"skill_cards">;
type SkillExperience = Tables<"skill_experience">;

const FlowchartPreview = dynamic(
  () => import("@/components/FlowchartView"),
  { ssr: false },
);

// ─── ナビゲーション ────────────────────────────────────
// 各設定は /admin/<id> の専用ページとして表示する（1画面1セクション）
// 定義は ./sections（純粋モジュール）に置き、ここでは再エクスポートのみ行う。
export { NAV_SECTIONS, type AdminSectionId };

// ─── 共通 UI ──────────────────────────────────────────

export function SectionTitle({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-8">
      <p className="mb-1 text-[12px] tracking-[0.6px] text-primary">{label}</p>
      <p className="font-mplus text-[32px] leading-[1.5] tracking-[1.6px] text-white">{title}</p>
      <div className="mt-3 h-[2px] w-10 rounded bg-system-800" />
    </div>
  );
}

// ─── 画像ピッカー モーダル ────────────────────────────────────────────────────

export function ImagePickerModal({
  open,
  onClose,
  onSelect,
  folder,
  showAlt = false,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, alt?: string) => void;
  folder: string;
  showAlt?: boolean;
}) {
  const [images, setImages] = useState<StorageImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StorageImage | null>(null);
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setSelected(null);
      setQuery("");
      setAlt("");
      setUploadError("");
      listStorageImages().then(({ data }) => {
        setImages(data);
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const filtered = images.filter(
    (img) =>
      img.name.toLowerCase().includes(query.toLowerCase()) ||
      img.path.toLowerCase().includes(query.toLowerCase()),
  );

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError("");
    const fd = new FormData();
    fd.append("file", await compressImage(file));
    const { url, path, error } = await uploadStorageImage(fd, folder);
    setUploading(false);
    if (error || !url || !path) { setUploadError(error ?? "アップロード失敗"); return; }
    const img: StorageImage = { name: file.name, path, url };
    setImages((prev) => [img, ...prev]);
    setSelected(img);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleConfirm = () => {
    if (!selected) return;
    onSelect(selected.url, showAlt ? alt : undefined);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="flex max-h-[82vh] w-[660px] flex-col overflow-hidden rounded-[12px] border border-border-light bg-[#1a1a1a]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-5 py-4">
          <p className="text-[14px] font-semibold text-white">🖼 画像を選択</p>
          <button
            type="button"
            onClick={onClose}
            className="text-[18px] text-system-700 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* アップロードゾーン */}
        <div className="px-5 pt-4">
          <div
            className={`cursor-pointer rounded-[8px] border-2 border-dashed p-4 text-center transition-colors ${
              dragging
                ? "border-primary bg-primary/10"
                : "border-border-light hover:border-system-700"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
            />
            {uploading ? (
              <p className="text-[12px] text-fg-muted">アップロード中…</p>
            ) : (
              <p className="text-[12px] text-fg-muted">
                クリック / ドラッグ&amp;ドロップでアップロード
                <span className="ml-2 text-system-700">→ {folder}/</span>
              </p>
            )}
            {uploadError && (
              <p className="mt-1 text-[11px] text-danger-300">{uploadError}</p>
            )}
          </div>
        </div>

        {/* 検索 */}
        <div className="px-5 pt-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ファイル名 / パスで検索…"
            className="w-full rounded-[8px] border border-border-light bg-surface px-3 py-2 text-[13px] text-white outline-none focus:border-primary"
          />
        </div>

        {/* 画像グリッド */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <p className="py-8 text-center text-[12px] text-system-700">読み込み中…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-system-700">
              {query ? "一致する画像がありません" : "画像がありません。上からアップロードしてください。"}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {filtered.map((img) => (
                <button
                  key={img.path}
                  type="button"
                  onClick={() => setSelected(img)}
                  className={`group overflow-hidden rounded-[6px] border transition-colors ${
                    selected?.path === img.path
                      ? "border-primary"
                      : "border-border-light hover:border-system-700"
                  }`}
                >
                  <img src={img.url} alt={img.name} className="h-20 w-full object-cover" />
                  <p className="truncate bg-[#121212] px-1 py-1 text-left text-[9px] text-fg-muted">
                    {img.path}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* alt テキスト（SectionsEditor 用） */}
        {showAlt && selected && (
          <div className="border-t border-[#2a2a2a] px-5 py-3">
            <p className="mb-1 text-[11px] text-fg-muted">代替テキスト（alt）</p>
            <input
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="画像の説明（任意）"
              className="w-full rounded-[8px] border border-border-light bg-surface px-3 py-2 text-[13px] text-white outline-none focus:border-primary"
            />
          </div>
        )}

        {/* フッター */}
        <div className="flex items-center justify-between border-t border-[#2a2a2a] px-5 py-3">
          <p className="text-[11px] text-system-700">
            {selected ? `選択中: ${selected.path}` : "画像をクリックして選択"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[8px] border border-border-light px-4 py-2 text-[13px] text-fg-muted transition-colors hover:border-system-700 hover:text-white"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selected}
              className="rounded-[8px] bg-primary px-4 py-2 text-[13px] font-semibold text-black transition-opacity disabled:opacity-40"
            >
              {showAlt ? "挿入" : "選択"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── フローチャートピッカー モーダル ──────────────────────────────────────────

export function FlowchartPickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (flowchart: { id: string; title: string }) => void;
}) {
  const [items, setItems] = useState<FlowchartRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FlowchartRow | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setQuery("");
      setSelected(null);
      setError("");
      listFlowcharts().then((result) => {
        setItems(result.data);
        setError(result.error ?? "");
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const filtered = items.filter((item) =>
    `${item.title} ${item.description ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-[840px] flex-col overflow-hidden rounded-[12px] border border-border-light bg-[#1a1a1a]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-5 py-4">
          <p className="text-[14px] font-semibold text-white">
            フローチャートを選択
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-[18px] text-system-700 hover:text-white"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
        <div className="px-5 pt-4">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="タイトル・説明で検索…"
            className="w-full rounded-[8px] border border-border-light bg-surface px-3 py-2 text-[13px] text-white outline-none focus:border-main-100"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="h-64 animate-pulse rounded-[12px] bg-white/[0.03]" />
          ) : error ? (
            <p className="py-8 text-center text-[13px] text-danger-300">
              {error}
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-system-700">
              {query
                ? "一致するフローチャートがありません"
                : "フローチャートがありません"}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filtered.map((item) => {
                const graph = parseFlowchart(item.data);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelected(item)}
                    className={`overflow-hidden rounded-[10px] border text-left transition-colors ${
                      selected?.id === item.id
                        ? "border-main-100"
                        : "border-border-light hover:border-system-700"
                    }`}
                  >
                    <div className="h-32 bg-[#141414]">
                      {graph ? (
                        <FlowchartPreview
                          data={graph}
                          interactive={false}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[11px] text-system-700">
                          プレビューできません
                        </div>
                      )}
                    </div>
                    <div className="bg-[#101010] px-3 py-2">
                      <p className="truncate text-[13px] text-white">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[10px] text-system-700">
                        {graph?.nodes.length ?? 0} nodes
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-[#2a2a2a] px-5 py-3">
          <p className="truncate text-[11px] text-system-700">
            {selected ? `選択中: ${selected.title}` : "図を選択してください"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[8px] border border-border-light px-4 py-2 text-[13px] text-fg-muted hover:text-white"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={!selected}
              onClick={() => {
                if (selected) {
                  onSelect({ id: selected.id, title: selected.title });
                }
              }}
              className="rounded-[8px] bg-main-100 px-4 py-2 text-[13px] font-semibold text-black disabled:opacity-40"
            >
              挿入
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 画像ピッカー フィールド（URL入力欄の置き換え）────────────────────────────

export function ImagePickerField({
  value,
  onChange,
  folder,
  previewClassName = "mt-2 h-20 w-20 rounded-[8px] object-cover",
}: {
  value: string;
  onChange: (v: string) => void;
  folder: string;
  previewClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-[8px] border border-border-light bg-[#1a1a1a] px-3 py-2 text-[14px] text-white outline-none transition-colors focus:border-primary"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-[8px] border border-border-light px-3 py-2 text-[12px] text-fg-muted transition-colors hover:border-primary hover:text-white"
          title="Supabase Storageから選択"
        >
          🖼 選択
        </button>
      </div>
      {value && (
        <img src={value} alt="preview" className={previewClassName} />
      )}
      <ImagePickerModal
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(url) => { onChange(url); setOpen(false); }}
        folder={folder}
        showAlt={false}
      />
    </>
  );
}

// ─── 汎用UIパーツ ─────────────────────────────────────────────────────────────

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[12px] tracking-[0.6px] text-fg-muted">{children}</p>;
}

/** フォーム内のグループ見出し（Hero / Overview / 本文 などの区切り） */
export function FormGroupHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-2 mt-3 border-t border-border-light pt-4">
      <p className="text-[12px] font-semibold tracking-[0.5px] text-primary">{children}</p>
    </div>
  );
}

export function Input({
  value, onChange, placeholder, className = "", list, disabled, type = "text", min, max,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  list?: string;
  disabled?: boolean;
  type?: "text" | "number";
  min?: number;
  max?: number;
}) {
  return (
    <input
      type={type}
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      list={list}
      disabled={disabled}
      className={`w-full rounded-[8px] border border-border-light bg-[#1a1a1a] px-3 py-2 text-[14px] text-white outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    />
  );
}

export function Textarea({
  value, onChange, rows = 4, placeholder,
}: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full resize-y rounded-[8px] border border-border-light bg-[#1a1a1a] px-3 py-2 text-[14px] leading-relaxed text-white outline-none transition-colors focus:border-primary"
    />
  );
}

/** 配列内の要素を from から to へ移動した新しい配列を返す（範囲外・同位置はコピーのみ） */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return [...list];
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function MoveButtons({
  index, length, onMove, label, disabled = false,
}: {
  index: number;
  length: number;
  onMove: (dir: -1 | 1) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={disabled || index === 0}
        aria-label={`${label} を上へ`}
        className="rounded px-2 py-1 text-[12px] text-system-700 hover:text-white disabled:opacity-30"
      >↑</button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={disabled || index === length - 1}
        aria-label={`${label} を下へ`}
        className="rounded px-2 py-1 text-[12px] text-system-700 hover:text-white disabled:opacity-30"
      >↓</button>
    </div>
  );
}

/** Hero スクリーンショット（複数画像URL）の追加・削除エディタ */
export function HeroScreenshotsEditor({
  value, onChange,
}: { value: string[]; onChange: (v: string[]) => void }) {
  const urls = Array.isArray(value) ? value : [];
  const update = (i: number, url: string) =>
    onChange(urls.map((u, idx) => (idx === i ? url : u)));
  const remove = (i: number) => onChange(urls.filter((_, idx) => idx !== i));
  const add = () => onChange([...urls, ""]);

  return (
    <div className="flex flex-col gap-3">
      {urls.map((url, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1">
            <ImagePickerField
              value={url}
              onChange={(v) => update(i, v)}
              folder="projects/hero"
              previewClassName="mt-2 h-24 w-14 rounded-[6px] object-cover"
            />
          </div>
          <MoveButtons index={i} length={urls.length} label={`画像${i + 1}`} onMove={(d) => onChange(moveItem(urls, i, i + d))} />
          <button
            type="button"
            onClick={() => remove(i)}
            className="shrink-0 rounded-[6px] px-2 py-1 text-[11px] text-system-700 hover:bg-danger-300/10 hover:text-danger-300"
          >
            削除
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start rounded-[6px] border border-border-light px-3 py-1 text-[11px] text-fg-muted transition-colors hover:border-primary hover:text-white"
      >
        ＋ 画像を追加
      </button>
    </div>
  );
}

export function SaveButton({
  onClick, loading, saved, error,
}: { onClick: () => void; loading: boolean; saved: boolean; error: string }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="rounded-[8px] bg-primary px-5 py-2 text-[14px] font-semibold text-[#0a0a0a] transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        {loading ? "保存中…" : "保存"}
      </button>
      {saved && <span className="text-[13px] text-primary">✓ 保存しました</span>}
      {error && <span className="text-[13px] text-danger-300">{error}</span>}
    </div>
  );
}

export function ProofreadPanel({
  checking,
  issues,
  error,
}: {
  checking: boolean;
  issues: ProofreadIssue[] | null;
  error: string;
}) {
  if (checking) {
    return (
      <div className="mt-3 flex items-center gap-2 text-[13px] text-fg-muted">
        <span className="inline-block animate-spin">↻</span> チェック中…
      </div>
    );
  }
  if (error) return <p className="mt-3 text-[13px] text-danger-300">{error}</p>;
  if (issues === null) return null;
  if (issues.length === 0) {
    return (
      <div className="mt-3 rounded-[8px] border border-primary/20 bg-[#0a2a1e] px-4 py-3">
        <p className="text-[13px] text-primary">✓ 問題は見つかりませんでした</p>
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-[8px] border border-[#f4c248]/20 bg-[#2b1e08] px-4 py-3">
      <p className="mb-2.5 text-[12px] font-semibold text-[#f4c248]">
        {issues.length} 件の指摘
      </p>
      <ul className="flex flex-col gap-2.5">
        {issues.map((issue, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 rounded bg-[#f4c248]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#f4c248]">
              {issue.line}:{issue.column}
            </span>
            <div>
              <p className="text-[13px] text-white/90">{issue.message}</p>
              <p className="mt-0.5 text-[11px] text-system-700">{issue.ruleId}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Profile セクション ────────────────────────────────

// profile.introduction は jsonb カラムだが実体は string[] なのでローカル型で上書き
type ProfileForm = Omit<Profile, "updated_at" | "introduction"> & { introduction: string[] };

function ProfileSection({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [form, setForm] = useState<ProfileForm>({
    id: 1, name_jp: "", name_en: "", title: "", bio: "", hero_image_url: "", introduction: [],
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  // 文章チェック
  const [proofChecking, setProofChecking] = useState(false);
  const [proofIssues, setProofIssues]     = useState<ProofreadIssue[] | null>(null);
  const [proofError, setProofError]       = useState("");
  const [dirty, setDirty] = useState(false);

  const handleProofread = async () => {
    const text = [form.bio, ...(form.introduction as string[])].filter(Boolean).join("\n\n");
    setProofChecking(true); setProofIssues(null); setProofError("");
    try {
      const { issues } = await runProofread(text);
      setProofIssues(issues);
    } catch {
      setProofError("チェックに失敗しました");
    } finally {
      setProofChecking(false);
    }
  };

  useEffect(() => {
    supabase.from("profile").select("*").eq("id", 1).single().then(({ data }) => {
      if (data) setForm({ ...data, introduction: Array.isArray(data.introduction) ? data.introduction as string[] : [] });
      setFetching(false);
    });
  }, []);

  const markDirty = () => {
    if (!dirty) {
      setDirty(true);
      onDirtyChange(true);
    }
  };

  const markSaved = () => {
    setDirty(false);
    onDirtyChange(false);
  };

  const set = <K extends keyof typeof form>(key: K, val: typeof form[K]) => {
    markDirty();
    setForm((f) => ({ ...f, [key]: val }));
  };

  const handleSave = async () => {
    setLoading(true); setError(""); setSaved(false);
    const { error: err } = await supabase
      .from("profile")
      .upsert({ ...form, updated_at: new Date().toISOString() });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    markSaved();
  };

  if (fetching) return <div className="h-64 animate-pulse rounded-[12px] bg-[#1a1a1a]" />;

  return (
    <section id="profile" className="scroll-mt-8">
      <SectionTitle label="Profile" title="プロフィール・自己紹介" />
      {dirty && (
        <p className="mb-3 text-[11px] text-[#f4c248]">
          未保存の変更があります
        </p>
      )}

      {/* 基本情報 */}
      <div className="mb-8 grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>名前（日本語）</FieldLabel>
          <Input value={form.name_jp} onChange={(v) => set("name_jp", v)} placeholder="山田 太郎" />
        </div>
        <div>
          <FieldLabel>名前（英語）</FieldLabel>
          <Input value={form.name_en} onChange={(v) => set("name_en", v)} placeholder="Taro Yamada" />
        </div>
        <div className="col-span-2">
          <FieldLabel>肩書き（Title）</FieldLabel>
          <Input value={form.title} onChange={(v) => set("title", v)} placeholder="Product Designer" />
        </div>
        <div className="col-span-2">
          <FieldLabel>ひとことバイオ（ヒーロー下の説明文）</FieldLabel>
          <Textarea value={form.bio} onChange={(v) => set("bio", v)} rows={3} />
        </div>
        <div className="col-span-2">
          <FieldLabel>プロフィール画像</FieldLabel>
          <ImagePickerField
            value={form.hero_image_url}
            onChange={(v) => set("hero_image_url", v)}
            folder="profile"
            previewClassName="mt-2 h-20 w-20 rounded-[8px] object-cover"
          />
        </div>
      </div>

      {/* 自己紹介段落 */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <FieldLabel>自己紹介（段落ごとに編集）</FieldLabel>
          <button
            type="button"
            onClick={() => set("introduction", [...form.introduction, ""])}
            className="rounded-[6px] border border-border-light px-3 py-1 text-[12px] text-fg-muted hover:border-primary hover:text-white"
          >
            ＋ 段落追加
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {form.introduction.map((para, i) => (
            <div key={i}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] text-system-700">段落 {i + 1}</span>
                <span className="flex items-center gap-1">
                  <MoveButtons
                    index={i}
                    length={form.introduction.length}
                    label={`段落${i + 1}`}
                    onMove={(d) => set("introduction", moveItem(form.introduction, i, i + d))}
                  />
                  <button
                    type="button"
                    onClick={() => set("introduction", form.introduction.filter((_, j) => j !== i))}
                    className="rounded px-1.5 py-0.5 text-[11px] text-system-700 hover:bg-danger-300/10 hover:text-danger-300"
                  >
                    削除
                  </button>
                </span>
              </div>
              <Textarea
                value={para}
                onChange={(v) => {
                  const arr = [...form.introduction];
                  arr[i] = v;
                  set("introduction", arr);
                }}
                rows={3}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SaveButton onClick={handleSave} loading={loading} saved={saved} error={error} />
        <button
          type="button"
          onClick={handleProofread}
          disabled={proofChecking}
          className="rounded-[8px] border border-border-light px-5 py-2 text-[14px] text-fg-muted transition-colors hover:border-primary hover:text-white disabled:opacity-40"
        >
          {proofChecking ? "チェック中…" : "文章をチェック"}
        </button>
      </div>
      <ProofreadPanel checking={proofChecking} issues={proofIssues} error={proofError} />
    </section>
  );
}

// ─── Career セクション ─────────────────────────────────

function CareerSection({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [items, setItems] = useState<CareerItem[]>([]);
  const [originalItems, setOriginalItems] = useState<CareerItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState("");
  // 文章チェック（アイテムごと）
  const [proofCheckingId, setProofCheckingId] = useState<string | null>(null);
  const [proofResultsMap, setProofResultsMap] = useState<
    Record<string, { issues: ProofreadIssue[] | null; error: string }>
  >({});

  const [dirty, setDirty] = useState(false);

  const recomputeDirty = (nextItems: CareerItem[], nextOriginal: CareerItem[]) => {
    const hasDiff = nextItems.some((it) => {
      const base = nextOriginal.find((o) => o.id === it.id);
      if (!base) return true;
      return (
        base.role !== it.role ||
        base.company !== it.company ||
        base.period !== it.period ||
        base.description !== it.description ||
        base.sort_order !== it.sort_order
      );
    });
    setDirty(hasDiff);
    onDirtyChange(hasDiff);
  };

  const handleProofread = async (item: CareerItem) => {
    const text = item.description;
    setProofCheckingId(item.id);
    setProofResultsMap((prev) => ({ ...prev, [item.id]: { issues: null, error: "" } }));
    try {
      const { issues } = await runProofread(text);
      setProofResultsMap((prev) => ({ ...prev, [item.id]: { issues, error: "" } }));
    } catch {
      setProofResultsMap((prev) => ({ ...prev, [item.id]: { issues: null, error: "チェックに失敗しました" } }));
    } finally {
      setProofCheckingId(null);
    }
  };

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from("career_items").select("*").order("sort_order", { ascending: true });
    if (data) {
      setItems(data);
      setOriginalItems(data);
      setDirty(false);
      onDirtyChange(false);
    }
    setFetching(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const updateItem = (id: string, key: keyof CareerItem, val: string | number) => {
    setItems((prev) => {
      const next = prev.map((it) => (it.id === id ? { ...it, [key]: val } : it));
      recomputeDirty(next, originalItems);
      return next;
    });
  };

  const handleSave = async (item: CareerItem) => {
    setSavingId(item.id); setGlobalError("");
    const { error } = await supabase.from("career_items").upsert({
      id: item.id, role: item.role, company: item.company,
      period: item.period, description: item.description, sort_order: item.sort_order,
    });
    setSavingId(null);
    if (error) { setGlobalError(error.message); return; }
    setSavedId(item.id);
    setTimeout(() => setSavedId(null), 2000);
    // ※ recomputeDirty は onDirtyChange（親 setState）を含むため、state 更新関数の中では
    //   呼ばない（レンダー中の親 setState 警告を避ける）。次の値を求めてから順に呼ぶ。
    const existing = originalItems.find((o) => o.id === item.id);
    const nextOriginal = existing
      ? originalItems.map((o) => (o.id === item.id ? item : o))
      : [...originalItems, item];
    setOriginalItems(nextOriginal);
    recomputeDirty(items, nextOriginal);
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        "この経歴を削除します。よろしいですか？\nこの操作は取り消せません。"
      )
    ) {
      return;
    }
    setDeletingId(id);
    await supabase.from("career_items").delete().eq("id", id);
    setDeletingId(null);
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleAdd = async () => {
    const newItem = {
      role: "", company: "", period: "", description: "",
      sort_order: items.length,
    };
    const { data } = await supabase.from("career_items").insert(newItem).select().single();
    if (data) {
      // 追加直後は DB の値と一致しているので dirty にはしない。
      // setState 更新関数の中で親 setState を呼ばないよう、次の値を先に確定させてから順に呼ぶ。
      const next = [...items, data];
      const nextOriginal = [...originalItems, data];
      setItems(next);
      setOriginalItems(nextOriginal);
      recomputeDirty(next, nextOriginal);
    }
  };

  const parsePeriod = (period: string | null) => {
    const text = period ?? "";
    const m = text.match(
      /^(\d{4})年(\d{1,2})月\s*-\s*(現在|(\d{4})年(\d{1,2})月)?$/,
    );
    if (!m) {
      return {
        startYear: "",
        startMonth: "",
        endYear: "",
        endMonth: "",
        isCurrent: false,
      };
    }
    const startYear = m[1] ?? "";
    const startMonth = m[2] ?? "";
    const isCurrent = m[3] === "現在";
    const endYear = m[4] ?? "";
    const endMonth = m[5] ?? "";
    return {
      startYear,
      startMonth,
      endYear,
      endMonth,
      isCurrent,
    };
  };

  const formatPeriod = (opts: {
    startYear: string;
    startMonth: string;
    endYear: string;
    endMonth: string;
    isCurrent: boolean;
  }) => {
    const sy = opts.startYear.trim();
    const sm = opts.startMonth.trim();
    const ey = opts.endYear.trim();
    const em = opts.endMonth.trim();
    if (!sy || !sm) return "";
    const start = `${sy}年${sm}月`;
    const end = opts.isCurrent
      ? "現在"
      : ey && em
        ? `${ey}年${em}月`
        : "";
    return end ? `${start} - ${end}` : `${start} - `;
  };

  const handleMove = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    const updated = next.map((it, i) => ({ ...it, sort_order: i }));
    setItems(updated);
    await Promise.all(
      updated.map(({ id, sort_order }) =>
        supabase.from("career_items").update({ sort_order }).eq("id", id)
      )
    );
    setOriginalItems(updated);
    recomputeDirty(updated, updated);
  };

  if (fetching) return <div className="h-64 animate-pulse rounded-[12px] bg-[#1a1a1a]" />;

  return (
    <section id="career" className="scroll-mt-8">
      <SectionTitle label="Career" title="経歴" />
      {globalError && <p className="mb-4 text-[13px] text-danger-300">{globalError}</p>}

      <div className="mb-6 flex flex-col gap-4">
        {items.map((item, idx) => (
          <div key={item.id} className="rounded-[12px] border border-border-light bg-surface p-5">
            {(() => {
              const base = originalItems.find((o) => o.id === item.id);
              const dirtyRole = base && base.role !== item.role;
              const dirtyCompany = base && base.company !== item.company;
              const dirtyPeriod = base && base.period !== item.period;
              const dirtyDescription = base && base.description !== item.description;
              return (
                <>
                  {/* ヘッダー行は既存のまま */}
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[12px] text-system-700">#{idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleMove(idx, -1)}
                        disabled={idx === 0}
                        className="rounded px-2 py-1 text-[12px] text-system-700 hover:text-white disabled:opacity-30"
                      >↑</button>
                      <button
                        type="button"
                        onClick={() => handleMove(idx, 1)}
                        disabled={idx === items.length - 1}
                        className="rounded px-2 py-1 text-[12px] text-system-700 hover:text-white disabled:opacity-30"
                      >↓</button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="rounded px-2 py-1 text-[12px] text-system-700 hover:bg-danger-300/10 hover:text-danger-300 disabled:opacity-40"
                      >
                        {deletingId === item.id ? "…" : "削除"}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>役職</FieldLabel>
                      <Input
                        value={item.role}
                        onChange={(v) => updateItem(item.id, "role", v)}
                      />
                      {dirtyRole && (
                        <p className="mt-1 text-[11px] text-[#f4c248]">
                          未保存の変更があります
                        </p>
                      )}
                    </div>
                    <div>
                      <FieldLabel>会社名</FieldLabel>
                      <Input
                        value={item.company}
                        onChange={(v) => updateItem(item.id, "company", v)}
                      />
                      {dirtyCompany && (
                        <p className="mt-1 text-[11px] text-[#f4c248]">
                          未保存の変更があります
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <FieldLabel>期間</FieldLabel>
                      {(() => {
                        const { startYear, startMonth, endYear, endMonth, isCurrent } =
                          parsePeriod(item.period);
                        const handleChange = (next: {
                          startYear?: string;
                          startMonth?: string;
                          endYear?: string;
                          endMonth?: string;
                          isCurrent?: boolean;
                        }) => {
                          const formatted = formatPeriod({
                            startYear: next.startYear ?? startYear,
                            startMonth: next.startMonth ?? startMonth,
                            endYear: next.endYear ?? endYear,
                            endMonth: next.endMonth ?? endMonth,
                            isCurrent: next.isCurrent ?? isCurrent,
                          });
                          updateItem(item.id, "period", formatted);
                        };
                        return (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="mb-1 text-[11px] text-fg-muted">
                                  期間開始
                                </p>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={1900}
                                    max={2100}
                                    value={startYear}
                                    onChange={(e) =>
                                      handleChange({ startYear: e.target.value })
                                    }
                                    placeholder="2022"
                                    className="w-24 rounded-[8px] border border-border-light bg-[#1a1a1a] px-2 py-1 text-[13px] text-white outline-none"
                                  />
                                  <span className="text-[12px] text-fg-muted">
                                    年
                                  </span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={12}
                                    value={startMonth}
                                    onChange={(e) =>
                                      handleChange({ startMonth: e.target.value })
                                    }
                                    placeholder="4"
                                    className="w-16 rounded-[8px] border border-border-light bg-[#1a1a1a] px-2 py-1 text-[13px] text-white outline-none"
                                  />
                                  <span className="text-[12px] text-fg-muted">
                                    月
                                  </span>
                                </div>
                              </div>
                              <div>
                                <p className="mb-1 text-[11px] text-fg-muted">
                                  期間終了
                                </p>
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min={1900}
                                      max={2100}
                                      value={isCurrent ? "" : endYear}
                                      onChange={(e) =>
                                        handleChange({ endYear: e.target.value })
                                      }
                                      placeholder="2024"
                                      disabled={isCurrent}
                                      className="w-24 rounded-[8px] border border-border-light bg-[#1a1a1a] px-2 py-1 text-[13px] text-white outline-none disabled:opacity-40"
                                    />
                                    <span className="text-[12px] text-fg-muted">
                                      年
                                    </span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={12}
                                      value={isCurrent ? "" : endMonth}
                                      onChange={(e) =>
                                        handleChange({ endMonth: e.target.value })
                                      }
                                      placeholder="3"
                                      disabled={isCurrent}
                                      className="w-16 rounded-[8px] border border-border-light bg-[#1a1a1a] px-2 py-1 text-[13px] text-white outline-none disabled:opacity-40"
                                    />
                                    <span className="text-[12px] text-fg-muted">
                                      月
                                    </span>
                                  </div>
                                  <label className="inline-flex items-center gap-2 text-[12px] text-fg-muted">
                                    <input
                                      type="checkbox"
                                      className="h-3 w-3 accent-primary"
                                      checked={isCurrent}
                                      onChange={(e) =>
                                        handleChange({ isCurrent: e.target.checked })
                                      }
                                    />
                                    <span>現在</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                            {dirtyPeriod && (
                              <p className="mt-1 text-[11px] text-[#f4c248]">
                                未保存の変更があります
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="col-span-2">
                      <FieldLabel>説明</FieldLabel>
                      <Textarea
                        value={item.description}
                        onChange={(v) => updateItem(item.id, "description", v)}
                        rows={3}
                      />
                      {dirtyDescription && (
                        <p className="mt-1 text-[11px] text-[#f4c248]">
                          未保存の変更があります
                        </p>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleSave(item)}
                disabled={savingId === item.id}
                className="rounded-[8px] bg-primary px-4 py-1.5 text-[13px] font-semibold text-[#0a0a0a] hover:opacity-80 disabled:opacity-40"
              >
                {savingId === item.id ? "保存中…" : "保存"}
              </button>
              {savedId === item.id && <span className="text-[12px] text-primary">✓ 保存しました</span>}
              <button
                type="button"
                onClick={() => handleProofread(item)}
                disabled={proofCheckingId === item.id}
                className="rounded-[8px] border border-border-light px-3 py-1.5 text-[13px] text-fg-muted transition-colors hover:border-primary hover:text-white disabled:opacity-40"
              >
                {proofCheckingId === item.id ? "チェック中…" : "文章をチェック"}
              </button>
            </div>
            <ProofreadPanel
              checking={proofCheckingId === item.id}
              issues={proofResultsMap[item.id]?.issues ?? null}
              error={proofResultsMap[item.id]?.error ?? ""}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="w-full rounded-[12px] border border-dashed border-border-light py-4 text-[14px] text-system-700 transition-colors hover:border-primary hover:text-white"
      >
        ＋ 経歴を追加
      </button>
    </section>
  );
}

// ─── Projects セクション ───────────────────────────────

// from の要素を to の位置へ移し、sort_order を 0..n-1 で振り直す
function reorderWorks(list: Tables<"works">[], from: number, to: number): Tables<"works">[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((w, i) => ({ ...w, sort_order: i }));
}

function WorksSection() {
  const [projects, setProjects] = useState<Tables<"works">[]>([]);
  const [fetching, setFetching] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const reloadProjects = useCallback(async (): Promise<boolean> => {
    const { data, error } = await supabase
      .from("works")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error || !data) return false;
    setProjects(data);
    return true;
  }, []);

  useEffect(() => {
    let active = true;
    supabase
      .from("works")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        if (data) setProjects(data);
        setFetching(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // 公開状態は即時に画面へ反映し、保存に失敗したらその行だけ元へ戻す
  const handleTogglePublished = async (id: string, next: boolean) => {
    const setRow = (value: boolean) =>
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, is_published: value } : p)));
    setRow(next);
    setPendingIds((prev) => new Set(prev).add(id));
    setToggleError(null);
    const { error } = await setWorkPublished(id, next);
    if (error) {
      setRow(!next);
      setToggleError(error);
    }
    setPendingIds((prev) => {
      const rest = new Set(prev);
      rest.delete(id);
      return rest;
    });
  };

  // 公開切替の保存中、または並び替えの保存中は、お互いの操作を止める
  const reorderLocked = savingOrder || pendingIds.size > 0;

  // 並び順は即時に画面へ反映する。失敗したら DB の最新の並びを読み直す（一部の行だけ保存された場合に画面とズレないように）
  const applyOrder = async (from: number, to: number) => {
    if (reorderLocked || from === to || to < 0 || to >= projects.length) return;
    const next = reorderWorks(projects, from, to);
    const updates = next
      .map(({ id }, i) => ({ id, sort_order: i }))
      .filter(({ id, sort_order }) => projects.find((p) => p.id === id)?.sort_order !== sort_order);
    if (updates.length === 0) return;
    setProjects(next);
    setSavingOrder(true);
    setOrderError(null);
    const { error } = await saveWorksOrder(updates);
    if (error) {
      const reloaded = await reloadProjects();
      setOrderError(
        reloaded
          ? `${error}（最新の状態を読み込み直しました）`
          : `${error}（最新の状態を読み込めませんでした。ページを再読み込みしてください）`,
      );
    }
    setSavingOrder(false);
  };

  const clearDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  if (fetching) return <div className="h-64 animate-pulse rounded-[12px] bg-[#1a1a1a]" />;

  return (
    <section id="works" className="scroll-mt-8">
      <SectionTitle label="Works" title="制作・企画" />
      <p className="mb-6 text-[13px] text-fg-muted">
        各プロジェクトは専用の編集ページ（本文エディタ + 設定）で管理します。右のスイッチで公開 / 非公開を切り替えられます（すぐに反映されます）。ドラッグまたは ↑↓ で並び順を変更できます（すぐに反映されます）。
      </p>
      {toggleError && <p className="mb-3 text-[12px] text-danger-300">公開状態の更新に失敗しました: {toggleError}</p>}
      {orderError && <p className="mb-3 text-[12px] text-danger-300">並び順の保存に失敗しました: {orderError}</p>}
      <div className="mb-6 flex flex-col gap-3">
        {projects.map((project, idx) => (
          <div
            key={project.id}
            draggable={!reorderLocked}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("application/x-work-id", project.id);
              setDragIndex(idx);
            }}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overIndex !== idx) setOverIndex(idx);
            }}
            onDragLeave={() => {
              if (overIndex === idx) setOverIndex(null);
            }}
            onDragEnd={clearDrag}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragIndex;
              clearDrag();
              if (from !== null) void applyOrder(from, idx);
            }}
            className={`flex items-center justify-between gap-4 rounded-[12px] border bg-[#161616] px-5 py-4 transition-colors hover:border-primary ${
              overIndex === idx && dragIndex !== null && dragIndex !== idx ? "border-primary" : "border-border-light"
            } ${dragIndex === idx ? "opacity-50" : ""}`}
          >
            <span aria-hidden="true" className="shrink-0 cursor-grab select-none text-[14px] leading-none text-system-700">⋮⋮</span>
            <Link href={`/admin/works/edit?id=${project.id}`} draggable={false} className="flex min-w-0 flex-1 items-center gap-3">
              <span className="shrink-0 text-[12px] font-medium text-primary">{project.category ?? "—"}</span>
              <span className={`truncate text-[14px] ${project.is_published ? "text-white" : "text-fg-muted"}`}>{project.title}</span>
            </Link>
            <PublishToggle
              checked={project.is_published}
              disabled={pendingIds.has(project.id) || savingOrder}
              label={project.title}
              title="オフにすると公開サイトの一覧・詳細・経歴リンクに出ません（すぐに反映されます）"
              onChange={(next) => handleTogglePublished(project.id, next)}
            />
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => {
                  if (idx === 0 || reorderLocked) return;
                  void applyOrder(idx, idx - 1);
                }}
                aria-disabled={idx === 0 || reorderLocked}
                aria-label={`${project.title} を上へ`}
                className="rounded px-2 py-1 text-[12px] text-system-700 hover:text-white aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-disabled:hover:text-system-700"
              >↑</button>
              <button
                type="button"
                onClick={() => {
                  if (idx === projects.length - 1 || reorderLocked) return;
                  void applyOrder(idx, idx + 1);
                }}
                aria-disabled={idx === projects.length - 1 || reorderLocked}
                aria-label={`${project.title} を下へ`}
                className="rounded px-2 py-1 text-[12px] text-system-700 hover:text-white aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-disabled:hover:text-system-700"
              >↓</button>
            </div>
            <Link href={`/admin/works/edit?id=${project.id}`} draggable={false} className="shrink-0 text-[12px] text-system-700">
              編集 →
            </Link>
          </div>
        ))}
        {projects.length === 0 && <p className="text-[13px] text-system-700">プロジェクトがありません</p>}
      </div>
      <Link
        href="/admin/works/edit?id=new"
        className="block w-full rounded-[12px] border border-dashed border-border-light py-4 text-center text-[14px] text-system-700 transition-colors hover:border-primary hover:text-white"
      >
        ＋ プロジェクトを追加
      </Link>
    </section>
  );
}

// ─── Flowcharts セクション ────────────────────────────────────────────────────

function FlowchartsSection({
  onDirtyChange,
}: {
  onDirtyChange: (dirty: boolean) => void;
}) {
  void onDirtyChange;
  const [items, setItems] = useState<FlowchartRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setFetching(true);
    const result = await listFlowcharts();
    setItems(result.data);
    setError(result.error ?? "");
    setFetching(false);
  }, []);

  useEffect(() => {
    let active = true;
    listFlowcharts().then((result) => {
      if (!active) return;
      setItems(result.data);
      setError(result.error ?? "");
      setFetching(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleDuplicate = async (id: string) => {
    setBusyId(id);
    setError("");
    const result = await duplicateFlowchart(id);
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    await load(false);
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        "このフローチャートを削除します。\n本文から参照されている可能性があり、削除後は「図が見つかりません」と表示されます。\nこの操作は取り消せません。",
      )
    ) {
      return;
    }
    setBusyId(id);
    setError("");
    const result = await deleteFlowchart(id);
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setItems((current) => current.filter((item) => item.id !== id));
  };

  if (fetching) {
    return (
      <div className="h-64 animate-pulse rounded-[12px] bg-[#1a1a1a]" />
    );
  }

  return (
    <section id="flowcharts" className="scroll-mt-8">
      <SectionTitle label="Flowcharts" title="フローチャート" />
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-[13px] text-fg-muted">
          作品をまたいで再利用できるフローチャートを管理します。
        </p>
        <Link
          href="/admin/flowcharts/edit?id=new"
          className="shrink-0 rounded-[8px] bg-main-100 px-4 py-2 text-[13px] font-semibold text-[#0a0a0a] hover:opacity-80"
        >
          ＋ 新規作成
        </Link>
      </div>
      {error && (
        <p className="mb-4 text-[13px] text-danger-300">{error}</p>
      )}
      <div className="overflow-hidden rounded-[12px] border border-border-light">
        <div className="grid grid-cols-[minmax(0,1fr)_90px_180px_220px] gap-4 bg-[#161616] px-5 py-3 text-[11px] uppercase tracking-[0.55px] text-system-700">
          <span>タイトル</span>
          <span>ノード数</span>
          <span>更新日時</span>
          <span className="text-right">操作</span>
        </div>
        {items.map((item) => {
          const graph = parseFlowchart(item.data);
          return (
            <div
              key={item.id}
              className="grid grid-cols-[minmax(0,1fr)_90px_180px_220px] items-center gap-4 border-t border-[#2a2a2a] bg-[#101010] px-5 py-4"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] text-white">
                  {item.title}
                </p>
                {item.description && (
                  <p className="mt-1 truncate text-[11px] text-system-700">
                    {item.description}
                  </p>
                )}
              </div>
              <span className="text-[12px] text-fg-muted">
                {graph?.nodes.length ?? 0}
              </span>
              <span className="text-[12px] text-fg-muted">
                {item.updated_at
                  ? new Date(item.updated_at).toLocaleString("ja-JP")
                  : "—"}
              </span>
              <div className="flex items-center justify-end gap-2">
                <Link
                  href={`/admin/flowcharts/edit?id=${item.id}`}
                  className="rounded-[6px] border border-border-light px-3 py-1.5 text-[12px] text-white hover:border-main-100"
                >
                  編集
                </Link>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => handleDuplicate(item.id)}
                  className="rounded-[6px] px-3 py-1.5 text-[12px] text-fg-muted hover:bg-white/5 hover:text-white disabled:opacity-40"
                >
                  複製
                </button>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => handleDelete(item.id)}
                  className="rounded-[6px] px-3 py-1.5 text-[12px] text-system-700 hover:bg-danger-300/10 hover:text-danger-300 disabled:opacity-40"
                >
                  削除
                </button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="bg-[#101010] px-5 py-10 text-center text-[13px] text-system-700">
            フローチャートがありません
          </p>
        )}
      </div>
    </section>
  );
}

// ─── SkillsExperience セクション ───────────────────────

// スキル行（skill_experience）に紐づくツール（skill_experience_tools → tools_vocab）。
// 並びは選択順（skill_experience_tools.sort_order）。
type BarTool = { id: string; name: string };
type ToolChip = { id: string; name: string; icon_url: string | null; slug: string | null; category: string | null };
type BarWithTools = SkillExperience & { tools: BarTool[] };
type CardWithRelations = SkillCard & {
  bars: BarWithTools[];
};

type ExperienceToolLink = {
  experience_id: string;
  sort_order: number;
  tools_vocab: { id: string; name: string } | null;
};

// segmentsToLevel で元のレベルに戻る代表値（supabase/seed.sql:23 と同じ）
const LEVEL_SEGMENTS: Record<number, number> = { 1: 2, 2: 5, 3: 7, 4: 10 };
const LEVEL_JA: Record<number, string> = { 1: "基礎", 2: "実務", 3: "上級", 4: "専門" };

type PreviewIcon = SkillCardConfig["icon"];
function toPreviewCard(card: CardWithRelations, toolById: Map<string, ToolChip>): SkillCardConfig {
  return {
    id: card.id, icon: { set: card.icon_set as PreviewIcon["set"], name: card.icon_name }, title: card.title, titleJP: card.title_jp,
    skills: card.bars.map((b) => ({
      id: b.id, icon: { set: (b.icon_set ?? "Base") as PreviewIcon["set"], name: b.icon_name ?? "system" },
      label: b.label, labelNote: b.label_note ?? undefined, description: b.description ?? undefined, segments: b.segments,
      tools: b.tools.map((t) => { const v = toolById.get(t.id); return { name: t.name, slug: v?.slug ?? null, category: v?.category ?? null }; }),
    })),
  };
}

function SkillsExperienceSection({
  iconCatalog,
  onDirtyChange,
}: {
  iconCatalog: IconCatalog;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [cards, setCards]         = useState<CardWithRelations[]>([]);
  const [fetching, setFetching]   = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId]   = useState<string | null>(null);
  const [savedId, setSavedId]     = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState("");
  const [toolVocab, setToolVocab] = useState<ToolChip[]>([]);
  const [newToolNames, setNewToolNames] = useState<Record<string, string>>({});
  const [addingTool, setAddingTool] = useState(false);
  const [movingBars, setMovingBars] = useState(false);

  const [dirtyCards, setDirtyCards] = useState<Record<string, true>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const anyDirty = Object.keys(dirtyCards).length > 0;
  useEffect(() => {
    onDirtyChange(anyDirty);
    // onDirtyChange は親が毎回作り直すため deps に入れない（入れると無限ループ）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyDirty]);
  const markCardDirty = (cardId: string) => setDirtyCards((p) => (p[cardId] ? p : { ...p, [cardId]: true }));
  const markCardSaved = (cardId: string) => setDirtyCards((p) => { if (!p[cardId]) return p; const n = { ...p }; delete n[cardId]; return n; });

  useEffect(() => {
    const fetchAll = async () => {
      const [{ data: cardRows }, { data: barRows }, { data: linkRows }, { data: toolRows }] = await Promise.all([
        supabase.from("skill_cards").select("*").order("sort_order", { ascending: true }),
        supabase.from("skill_experience").select("*").order("sort_order",  { ascending: true }),
        supabase
          .from("skill_experience_tools")
          .select("experience_id, sort_order, tools_vocab(id, name)")
          .order("sort_order", { ascending: true }),
        supabase.from("tools_vocab").select("id, name, icon_url, slug, category").order("name"),
      ]);
      if (!cardRows) { setFetching(false); return; }

      // skill_experience_tools → スキル行 ID ごとのツール配列に整形
      const toolsByExp = new Map<string, BarTool[]>();
      for (const link of (linkRows ?? []) as unknown as ExperienceToolLink[]) {
        const tv = link.tools_vocab;
        if (!tv) continue;
        const arr = toolsByExp.get(link.experience_id) ?? [];
        arr.push({ id: tv.id, name: tv.name });
        toolsByExp.set(link.experience_id, arr);
      }

      // 公開ページ同様、「辞書用カード（Skill Vocab / Tool Vocab）」は
      // Admin の UI でも非表示にする。
      const visibleCardRows = cardRows.filter((c) => {
        const t  = (c as SkillCard).title?.trim() ?? "";
        const tj = (c as SkillCard).title_jp?.trim() ?? "";
        const isVocab =
          t === "Skill Vocab" ||
          t === "Tool Vocab" ||
          tj === "スキル辞書" ||
          tj === "ツール辞書";
        return !isVocab;
      });

      const merged = visibleCardRows.map((c) => ({
        ...c,
        bars: (barRows ?? [])
          .filter((b) => b.card_id === c.id)
          .map((b) => ({ ...b, tools: toolsByExp.get(b.id) ?? [] })),
      }));
      setCards(merged);
      setToolVocab((toolRows ?? []) as ToolChip[]);
      setFetching(false);
    };

    void fetchAll();
  }, []);

  // ── カード操作 ──────────────────────────────────────
  const updateCard = (id: string, key: keyof SkillCard, val: string | number) => {
    markCardDirty(id);
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: val } : c)));
  };

  const updateCardIcon = (id: string, v: IconValue) => {
    markCardDirty(id);
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, icon_set: v.set, icon_name: v.name } : c)));
  };

  const handleSaveCardAll = async (card: CardWithRelations) => {
    if (savingId) return;
    // アイコンのセットと名前は「両方入れる」か「両方空」。片方だけだと公開側が存在しないパスを読む
    const bad = card.bars.findIndex((b) => !!b.icon_set?.trim() !== !!b.icon_name?.trim());
    if (bad >= 0) { setCardErrors((p) => ({ ...p, [card.id]: `スキルバー #${bad + 1}: アイコンは「セット」と「名前」を両方入力するか、両方空にしてください。` })); return; }
    setSavingId(card.id); setCardErrors((p) => ({ ...p, [card.id]: "" }));
    const fail = (msg: string) => setCardErrors((p) => ({ ...p, [card.id]: msg }));
    try {
      const c = await saveSkillCard({ id: card.id, title: card.title, title_jp: card.title_jp, icon_set: card.icon_set, icon_name: card.icon_name, sort_order: card.sort_order });
      if (c.error) { fail(`カード情報: ${c.error}`); return; }
      for (const [i, bar] of card.bars.entries()) {
        const name = `スキルバー #${i + 1}（${bar.label || "無題"}）`;
        const b = await saveSkillBar({ id: bar.id, card_id: card.id, label: bar.label, label_short: bar.label_short, segments: bar.segments, level: bar.level, description: bar.description, sort_order: bar.sort_order, icon_set: bar.icon_set, icon_name: bar.icon_name, label_note: bar.label_note });
        if (b.error) { fail(`${name}: ${b.error}`); return; }
        const t = await saveExperienceToolIds(bar.id, bar.tools.map((x) => x.id));
        if (t.error) { fail(`${name} のツール: ${t.error}`); return; }
      }
      markCardSaved(card.id);
      setSavedId(card.id); setTimeout(() => setSavedId(null), 2000);
    } finally { setSavingId(null); }
  };

  const handleDeleteCard = async (id: string) => {
    if (
      !window.confirm(
        "このスキルカードを削除します。よろしいですか？\nこの操作は取り消せません。"
      )
    ) {
      return;
    }
    setDeletingId(id);
    const { error } = await deleteSkillCard(id);
    setDeletingId(null);
    if (error) {
      setCardErrors((p) => ({ ...p, [id]: `削除に失敗しました: ${error}` }));
      return;
    }
    setCards((prev) => prev.filter((c) => c.id !== id));
    markCardSaved(id);
    if (expandedId === id) setExpandedId(null);
  };

  const handleAddCard = async () => {
    const { data } = await addSkillCard(cards.length);
    if (data) {
      setCards((prev) => [...prev, { ...data, bars: [], tools: [] }]);
      setExpandedId(data.id);
      markCardDirty(data.id);
    }
  };

  const handleMoveCard = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= cards.length) return;
    const next = [...cards];
    [next[index], next[target]] = [next[target], next[index]];
    const updated = next.map((c, i) => ({ ...c, sort_order: i }));
    setCards(updated);
    await moveSkillCards(updated.map(({ id, sort_order }) => ({ id, sort_order })));
  };

  // ── スキルバー操作 ────────────────────────────────────
  const updateBar = (
    cardId: string,
    barId: string,
    key: keyof SkillExperience,
    val: string | number | null,
  ) => {
    markCardDirty(cardId);
    setCards((prev) =>
      prev.map((c) =>
        c.id !== cardId
          ? c
          : {
              ...c,
              bars: c.bars.map((b) => (b.id === barId ? { ...b, [key]: val } : b)),
            },
      ),
    );
  };

  const handleDeleteBar = async (cardId: string, barId: string) => {
    if (
      !window.confirm(
        "このスキルバーを削除します。よろしいですか？\nこの操作は取り消せません。"
      )
    ) {
      return;
    }
    const { error } = await deleteSkillBar(barId);
    if (error) {
      setCardErrors((p) => ({ ...p, [cardId]: `削除に失敗しました: ${error}` }));
      return;
    }
    setCards((prev) => prev.map((c) =>
      c.id !== cardId ? c : { ...c, bars: c.bars.filter((b) => b.id !== barId) }
    ));
  };

  const handleAddBar = async (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const { data } = await addSkillBar(cardId, card.bars.length);
    if (data) {
      setCards((prev) =>
        prev.map((c) =>
          c.id !== cardId ? c : { ...c, bars: [...c.bars, { ...data, tools: [] }] },
        ),
      );
      markCardDirty(cardId);
    }
  };

  // ── スキル行ツール操作（skill_experience_tools）─────────
  const updateBarField = (
    cardId: string,
    barId: string,
    update: (bar: BarWithTools) => BarWithTools,
  ) => {
    markCardDirty(cardId);
    setCards((prev) =>
      prev.map((c) =>
        c.id !== cardId
          ? c
          : { ...c, bars: c.bars.map((b) => (b.id === barId ? update(b) : b)) },
      ),
    );
  };

  const toggleBarTool = (cardId: string, barId: string, opt: { id: string; name: string }) => {
    updateBarField(cardId, barId, (b) => ({
      ...b,
      tools: b.tools.some((t) => t.id === opt.id)
        ? b.tools.filter((t) => t.id !== opt.id)
        : [...b.tools, { id: opt.id, name: opt.name }],
    }));
  };

  const handleAddNewTool = async (cardId: string, barId: string) => {
    if (addingTool) return;
    const name = (newToolNames[barId] ?? "").trim();
    if (!name) return;
    setAddingTool(true);
    try {
      let opt: { id: string; name: string } | undefined = toolVocab.find(
        (t) => t.name.trim().toLowerCase() === name.toLowerCase(),
      );
      if (!opt) {
        const res = await addToolNameFromWorks(name);
        if (res.error || !res.id) {
          setGlobalError(res.error ?? "ツールの追加に失敗しました");
          return;
        }
        const newId = res.id;
        opt = { id: newId, name };
        setToolVocab((prev) =>
          prev.some((t) => t.id === newId)
            ? prev
            : [...prev, { id: newId, name, icon_url: null, slug: null, category: null }].sort((a, b) => a.name.localeCompare(b.name)),
        );
      }
      const chosen = opt;
      updateBarField(cardId, barId, (b) =>
        b.tools.some((t) => t.id === chosen.id) ? b : { ...b, tools: [...b.tools, { id: chosen.id, name: chosen.name }] },
      );
      setNewToolNames((p) => ({ ...p, [barId]: "" }));
    } finally {
      setAddingTool(false);
    }
  };

  const handleMoveBar = async (cardId: string, index: number, dir: -1 | 1) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const target = index + dir;
    if (target < 0 || target >= card.bars.length) return;
    const prevBars = card.bars;
    const nextBars = moveItem(prevBars, index, target).map((b, i) => ({ ...b, sort_order: i }));
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, bars: nextBars } : c)));
    setMovingBars(true);
    try {
      const { error } = await moveSkillBars(nextBars.map(({ id, sort_order }) => ({ id, sort_order })));
      if (error) {
        setGlobalError(`並び順の保存に失敗しました: ${error}`);
        setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, bars: prevBars } : c)));
      }
    } finally {
      setMovingBars(false);
    }
  };

  if (fetching) return <div className="h-64 animate-pulse rounded-[12px] bg-[#1a1a1a]" />;

  const toolById = new Map(toolVocab.map((t) => [t.id, t]));

  return (
    <section id="skills-experience" className="scroll-mt-8">
      <SectionTitle label="Skills Experience" title="スキルカルーセル" />
      {globalError && <p className="mb-4 text-[13px] text-danger-300">{globalError}</p>}
      {anyDirty && (
        <p className="mb-3 text-[11px] text-[#f4c248]">
          未保存の変更があります
        </p>
      )}

      <div className="mb-6 flex flex-col gap-4">
        {cards.map((card, idx) => {
          const isOpen = expandedId === card.id;
          return (
            <div key={card.id} className="rounded-[12px] border border-border-light bg-surface">
              {/* ヘッダー行 */}
              <div
                className="flex cursor-pointer items-center justify-between px-5 py-4"
                onClick={() => setExpandedId(isOpen ? null : card.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-system-700">#{idx + 1}</span>
                  <span className="text-[14px] font-medium text-primary">{card.title}</span>
                  <span className="text-[12px] text-fg-muted">{card.title_jp}</span>
                  {dirtyCards[card.id] && <span className="text-[11px] text-[#f4c248]">未保存</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleMoveCard(idx, -1); }}
                    disabled={idx === 0 || savingId === card.id}
                    className="rounded px-2 py-1 text-[12px] text-system-700 hover:text-white disabled:opacity-30"
                  >↑</button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleMoveCard(idx, 1); }}
                    disabled={idx === cards.length - 1 || savingId === card.id}
                    className="rounded px-2 py-1 text-[12px] text-system-700 hover:text-white disabled:opacity-30"
                  >↓</button>
                  <span className="text-[12px] text-system-700">{isOpen ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* 編集フォーム（展開時） */}
              {isOpen && (
                <div className="border-t border-border-light p-5">

                  <div className="mb-6">
                    <p className="mb-2 text-[11px] font-semibold tracking-[0.5px] text-fg-muted">公開ページでの見え方（未保存の内容を反映）</p>
                    <div className="rounded-[12px] border border-border-light bg-surface">
                      <PublicSkillCard card={toPreviewCard(card, toolById)} />
                    </div>
                  </div>

                  <fieldset disabled={savingId === card.id} className="min-w-0">
                  {/* カード基本情報 */}
                  <div className="mb-6 grid grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>タイトル（EN）</FieldLabel>
                      <Input value={card.title} onChange={(v) => updateCard(card.id, "title", v)} placeholder="Execution" />
                    </div>
                    <div>
                      <FieldLabel>タイトル（JP）</FieldLabel>
                      <Input value={card.title_jp} onChange={(v) => updateCard(card.id, "title_jp", v)} placeholder="制作・実行" />
                    </div>
                    <div className="col-span-2">
                      <FieldLabel>アイコン</FieldLabel>
                      <IconPickerField
                        catalog={iconCatalog}
                        value={{ set: card.icon_set, name: card.icon_name }}
                        onChange={(v) => {
                          if (v) updateCardIcon(card.id, v);
                        }}
                      />
                    </div>
                  </div>

                  {/* スキルバー */}
                  <div className="mb-6">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[12px] font-semibold tracking-[0.6px] text-fg-muted">スキルバー</p>
                      <button
                        type="button"
                        onClick={() => handleAddBar(card.id)}
                        className="rounded-[6px] border border-border-light px-3 py-1 text-[12px] text-fg-muted hover:border-primary hover:text-white"
                      >
                        ＋ 追加
                      </button>
                    </div>
                    <div className="flex flex-col gap-3">
                      {card.bars.map((bar, bi) => (
                        <div key={bar.id} className="rounded-[8px] border border-[#363636] bg-[#1a1a1a] p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[11px] text-system-700">#{bi + 1}</span>
                            <MoveButtons
                              index={bi}
                              length={card.bars.length}
                              disabled={movingBars}
                              label={bar.label || "スキルバー"}
                              onMove={(d) => void handleMoveBar(card.id, bi, d)}
                            />
                          </div>
                          <div className="grid grid-cols-[1fr_200px] gap-3 mb-3">
                            <div>
                              <FieldLabel>ラベル</FieldLabel>
                              <Input value={bar.label} onChange={(v) => updateBar(card.id, bar.id, "label", v)} placeholder="UIデザイン" />
                            </div>
                            <div>
                              <FieldLabel>習熟度</FieldLabel>
                              <select
                                value={String(segmentsToLevel(bar.segments))}
                                onChange={(e) => { const n = Number(e.target.value); updateBarField(card.id, bar.id, (b) => ({ ...b, segments: LEVEL_SEGMENTS[n], level: SKILL_LEVELS[n - 1].en })); }}
                                className="w-full rounded-[8px] border border-border-light bg-[#1a1a1a] px-3 py-2 text-[14px] text-white outline-none focus:border-primary"
                              >
                                {SKILL_LEVELS.map((l) => <option key={l.n} value={l.n}>{l.n}. {l.en}（{LEVEL_JA[l.n]}）</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="col-span-2">
                              <FieldLabel>アイコン（空なら Base/system）</FieldLabel>
                              <IconPickerField
                                catalog={iconCatalog}
                                allowEmpty
                                value={bar.icon_set || bar.icon_name ? { set: bar.icon_set ?? "", name: bar.icon_name ?? "" } : null}
                                onChange={(v) =>
                                  updateBarField(card.id, bar.id, (b) => ({
                                    ...b,
                                    icon_set: v?.set ?? null,
                                    icon_name: v?.name ?? null,
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <FieldLabel>ラベルノート（JP短）</FieldLabel>
                              <Input value={bar.label_note ?? ""} onChange={(v) => updateBar(card.id, bar.id, "label_note", v || null)} placeholder="UIデザイン" />
                            </div>
                          </div>
                          <div className="mb-3">
                            <FieldLabel>説明（任意・改行と「・」箇条書き可）</FieldLabel>
                            <Textarea
                              value={bar.description ?? ""}
                              onChange={(v) => updateBar(card.id, bar.id, "description", v || null)}
                              rows={2}
                              placeholder="スキルの詳細説明（展開時に表示）"
                            />
                          </div>

                          {/* スキル行ツール（skill_experience_tools） */}
                          <div className="mb-3 rounded-[8px] border border-[#2e2e2e] bg-[#161616] p-3">
                            <p className="mb-2 text-[11px] font-semibold tracking-[0.5px] text-fg-muted">ツール（行単位）</p>
                            <div className="flex flex-wrap gap-2">
                              {toolVocab.map((opt) => {
                                const selected = bar.tools.some((t) => t.id === opt.id);
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => toggleBarTool(card.id, bar.id, opt)}
                                    className={`flex items-center gap-1.5 rounded-[999px] border px-3 py-1 text-[12px] transition-colors ${selected ? "border-primary bg-primary/10 text-primary" : "border-border-light bg-[#1a1a1a] text-fg-muted hover:text-white"}`}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    {opt.icon_url && <img src={opt.icon_url} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />}
                                    {opt.name}
                                  </button>
                                );
                              })}
                              {toolVocab.length === 0 && <span className="text-[12px] text-system-700">ツール定義がありません</span>}
                            </div>
                            {bar.tools.length > 0 && (
                              <p className="mt-2 text-[11px] text-fg-muted">表示順: {bar.tools.map((t) => t.name).join(" → ")}</p>
                            )}
                            <div
                              className="mt-2 flex items-center gap-2"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
                                  e.preventDefault();
                                  void handleAddNewTool(card.id, bar.id);
                                }
                              }}
                            >
                              <Input
                                value={newToolNames[bar.id] ?? ""}
                                onChange={(v) => setNewToolNames((p) => ({ ...p, [bar.id]: v }))}
                                placeholder="新しいツール名"
                                className="!w-56"
                              />
                              <button
                                type="button"
                                onClick={() => void handleAddNewTool(card.id, bar.id)}
                                disabled={addingTool}
                                className="rounded-[6px] border border-border-light px-2 py-1 text-[11px] text-fg-muted transition-colors hover:border-primary hover:text-white"
                              >
                                追加
                              </button>
                            </div>
                            <p className="mt-2 text-[10px] leading-[1.5] text-system-700">
                              選んだ順に表示されます。ロゴ（slug）とカテゴリーは「マスタ管理」で設定します。保存はカード下部の「このカードを保存」でまとめて行われます。
                            </p>
                          </div>

                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => handleDeleteBar(card.id, bar.id)}
                              className="rounded-[6px] px-2 py-1 text-[12px] text-system-700 hover:bg-danger-300/10 hover:text-danger-300"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  </fieldset>

                  <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-2 flex flex-wrap items-center gap-3 rounded-b-[12px] border-t border-border-light bg-surface px-5 py-3">
                    <button type="button" onClick={() => void handleSaveCardAll(card)} disabled={!dirtyCards[card.id] || savingId !== null}
                      className="rounded-[8px] bg-primary px-4 py-1.5 text-[13px] font-semibold text-[#0a0a0a] hover:opacity-80 disabled:opacity-40">
                      {savingId === card.id ? "保存中…" : "このカードを保存"}
                    </button>
                    {savedId === card.id && <span className="text-[12px] text-primary">✓ 保存しました</span>}
                    {cardErrors[card.id] && <span className="text-[12px] text-danger-300">{cardErrors[card.id]}</span>}
                    <button type="button" onClick={() => handleDeleteCard(card.id)} disabled={deletingId === card.id || savingId === card.id}
                      className="ml-auto rounded-[8px] px-3 py-1.5 text-[13px] text-system-700 hover:bg-danger-300/10 hover:text-danger-300 disabled:opacity-40">
                      {deletingId === card.id ? "削除中…" : "カードを削除"}
                    </button>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleAddCard}
        className="w-full rounded-[12px] border border-dashed border-border-light py-4 text-[14px] text-system-700 transition-colors hover:border-primary hover:text-white"
      >
        ＋ カードを追加
      </button>
    </section>
  );
}

// ─── 共通シェル ─────────────────────────────────────

/**
 * admin 共通シェル（サイドバー + main）。
 * /admin/<section> 各ページと /admin/works/edit の全画面エディタページで共用する。
 */
export function AdminShell({
  section,
  hasUnsavedChanges = false,
  wide = false,
  children,
}: {
  /** サイドバーでハイライトするセクション */
  section: AdminSectionId;
  hasUnsavedChanges?: boolean;
  /** true で main の最大幅制限（max-w-main = Device/desktop Main.Max）を外し全幅・全高レイアウトにする（全画面エディタ用） */
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // 未保存の変更があるときはページ遷移前に確認する（Link 共通）
  const confirmLeave = (e: React.MouseEvent) => {
    if (
      hasUnsavedChanges &&
      !window.confirm("未保存の変更があります。破棄してページを移動しますか？")
    ) {
      e.preventDefault();
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      {/* サイドバー */}
      <aside className="sticky top-0 flex h-screen w-[220px] shrink-0 flex-col border-r border-[#2a2a2a] bg-[#0a0a0a] px-4 py-8">
        <div className="mb-8 px-2">
          <Link
            href="/"
            className="mb-1 block text-[12px] tracking-[0.6px] text-primary hover:underline"
            onClick={confirmLeave}
          >
            ← Portfolio
          </Link>
          <p className="text-[20px] font-semibold text-white">Admin</p>
          <p className="text-[11px] text-system-700">コンテンツ管理</p>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_SECTIONS.map(({ id, label, labelJa }) => {
            const isActive = section === id;
            return (
              <Link
                key={id}
                href={`/admin/${id}`}
                onClick={confirmLeave}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left transition-colors",
                  isActive
                    ? "bg-[rgba(72,244,190,0.08)] text-white"
                    : "text-fg-muted hover:bg-[#1a1a1a] hover:text-white",
                ].join(" ")}
              >
                {isActive && <span className="h-4 w-[2px] shrink-0 rounded-full bg-primary" />}
                <span className={["flex flex-col", isActive ? "" : "pl-[10px]"].join(" ")}>
                  <span className="text-[14px] leading-[1.4]">{label}</span>
                  <span className="text-[11px] text-system-700">{labelJa}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Style Guide リンク */}
        <div className="mt-auto">
          <Link
            href="/styleguide"
            className="block rounded-[8px] px-3 py-2 text-[12px] text-system-700 hover:bg-[#1a1a1a] hover:text-fg-muted"
            onClick={confirmLeave}
          >
            Style Guide →
          </Link>
        </div>
      </aside>

      {/* メインコンテンツ（通常はサイトの最大表示幅 max-w-main、wide は全幅・全高） */}
      <main className="flex-1 overflow-y-auto">
        <div
          className={
            wide
              ? "flex h-full min-h-0 w-full flex-col px-8 py-8 lg:px-10"
              : "mx-auto w-full max-w-main px-8 py-12 lg:px-12"
          }
        >
          {children}
        </div>
      </main>
    </div>
  );
}

// ─── メインレイアウト ───────────────────────────────────
// 各設定セクションは /admin/<section> の専用ページとして 1 画面 1 セクションで表示する。

export function AdminLayout({
  section,
  logoSlugs,
  iconCatalog,
}: {
  section: AdminSectionId;
  logoSlugs: string[];
  iconCatalog: IconCatalog;
}) {
  const [dirtySections, setDirtySections] = useState<Record<string, boolean>>({});

  const hasUnsavedChanges = Object.values(dirtySections).some(Boolean);

  const setSectionDirty = (sectionId: string, dirty: boolean) => {
    setDirtySections((prev) => ({
      ...prev,
      [sectionId]: dirty,
    }));
  };

  return (
    <AdminShell section={section} hasUnsavedChanges={hasUnsavedChanges}>
      <div className="mb-16">
        <p className="text-[12px] tracking-[0.6px] text-primary">Content Management</p>
        <p className="mt-1 font-mplus text-[40px] font-bold tracking-[2px] text-white">Admin</p>
        <p className="mt-3 text-[14px] text-fg-muted">
          ポートフォリオのコンテンツを編集・管理します。変更は保存ボタンを押すと即時反映されます。
        </p>
      </div>

      {/* 1画面1セクション（/admin/<section> ごとに該当セクションのみ表示） */}
      {section === "profile" && (
        <ProfileSection onDirtyChange={(dirty) => setSectionDirty("profile", dirty)} />
      )}
      {section === "career" && (
        <CareerSection onDirtyChange={(dirty) => setSectionDirty("career", dirty)} />
      )}
      {section === "works" && <WorksSection />}
      {section === "flowcharts" && (
        <FlowchartsSection
          onDirtyChange={(dirty) =>
            setSectionDirty("flowcharts", dirty)
          }
        />
      )}
      {section === "skills-experience" && (
        <SkillsExperienceSection
          iconCatalog={iconCatalog}
          onDirtyChange={(dirty) => setSectionDirty("skills-experience", dirty)}
        />
      )}
      {section === "masters" && <MastersSection logoSlugs={logoSlugs} />}

      <div className="mt-24 border-t border-[#2a2a2a] pt-8">
        <p className="text-[12px] text-system-800">Portfolio Admin</p>
      </div>
    </AdminShell>
  );
}
