"use client";

import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import ProtectedImage from "@/components/ProtectedImage";
import {
  saveSkillCard,
  deleteSkillCard,
  moveSkillCards,
  saveSkillBar,
  deleteSkillBar,
  saveCareerItem,
  deleteCareerItem,
  saveExperienceToolIds,
  moveSkillBars,
  addToolNameFromWorks,
  listStorageImages,
  uploadStorageImage,
  listFlowcharts,
  deleteFlowchart,
  duplicateFlowchart,
  listNameMaster,
  addNameMaster,
} from "@/app/admin/actions";
import type {
  FlowchartRow,
  NameMaster,
  StorageImage,
} from "@/app/admin/actions";
import type { Tables } from "@/src/types/supabase";
import { type ProofreadIssue, runProofread } from "@/lib/proofread-client";
import { parseFlowchart } from "@/lib/flowchart";
import SectionTitle from "./SectionTitle";
import WorksSection from "./WorksSection";
import { compressImage } from "@/lib/compress-image";
import { SkillCard as PublicSkillCard, SKILL_LEVELS, segmentsToLevel, type SkillCardConfig } from "@/src/components/SkillsCardGrid";
import MastersSection from "./masters/MastersSection";
import MasterSelect from "./MasterSelect";
import IconPickerField, { type IconValue } from "./IconPickerField";
import type { IconCatalog } from "./iconCatalogTypes";
import {
  periodInputsOf,
  periodColumnsForSave,
  isLegacyPeriod,
  validatePeriod,
  isSamePeriod,
  EMPTY_PERIOD,
  type PeriodInputs,
} from "./period";
import { NAV_SECTIONS, type AdminSectionId } from "./sections";

// ─── 型 ───────────────────────────────────────────────
type Profile    = Tables<"profile">;
type CareerItem = Tables<"career_items">;
type CareerRow  = CareerItem & { isNew?: true };
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
  const [listError, setListError] = useState("");
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
      setListError("");
      listStorageImages().then(({ data, error }) => {
        setImages(data);
        setListError(error ?? "");
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
    setListError("");
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
          ) : listError ? (
            <p className="py-8 text-center text-[12px] text-danger-300" role="alert">{listError}</p>
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
                  <ProtectedImage src={img.url} alt={img.name} className="h-20 w-full object-cover" />
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
        <ProtectedImage src={value} alt="preview" className={previewClassName} />
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
      className={`w-full rounded-[8px] border border-border-light bg-[#1a1a1a] px-3 py-2 text-[14px] text-white outline-none transition-colors focus:border-primary placeholder:text-system-750 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
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

/** 期間（開始年月〜終了年月 / 現在）の入力欄 */
export function PeriodFields({
  value, onChange, disabled = false,
}: { value: PeriodInputs; onChange: (next: PeriodInputs) => void; disabled?: boolean }) {
  const set = (patch: Partial<PeriodInputs>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input type="number" min={1900} max={2100} className="!w-24" value={value.startYear} onChange={(v) => set({ startYear: v })} placeholder="YYYY" disabled={disabled} />
      <span className="text-[12px] text-fg-muted">年</span>
      <Input type="number" min={1} max={12} className="!w-16" value={value.startMonth} onChange={(v) => set({ startMonth: v })} placeholder="M" disabled={disabled} />
      <span className="text-[12px] text-fg-muted">月 〜</span>
      <Input type="number" min={1900} max={2100} className="!w-24" value={value.isCurrent ? "" : value.endYear} onChange={(v) => set({ endYear: v })} placeholder="YYYY" disabled={disabled || value.isCurrent} />
      <span className="text-[12px] text-fg-muted">年</span>
      <Input type="number" min={1} max={12} className="!w-16" value={value.isCurrent ? "" : value.endMonth} onChange={(v) => set({ endMonth: v })} placeholder="M" disabled={disabled || value.isCurrent} />
      <span className="text-[12px] text-fg-muted">月</span>
      <label className="ml-2 inline-flex items-center gap-2 text-[12px] text-fg-muted">
        <input
          type="checkbox"
          className="h-3 w-3 accent-primary"
          checked={value.isCurrent}
          disabled={disabled}
          onChange={(e) => set({ isCurrent: e.target.checked })}
        />
        現在
      </label>
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
  const [loadError, setLoadError] = useState("");
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
      const { issues, error } = await runProofread(text);
      if (error) setProofError(error);
      else setProofIssues(issues);
    } catch {
      setProofError("チェックに失敗しました");
    } finally {
      setProofChecking(false);
    }
  };

  useEffect(() => {
    supabase.from("profile").select("*").eq("id", 1).single().then(({ data, error }) => {
      if (error || !data) setLoadError(error?.message ?? "プロフィールが見つかりません");
      else setForm({ ...data, introduction: Array.isArray(data.introduction) ? data.introduction as string[] : [] });
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
  if (loadError) return <p className="text-[13px] text-danger-300" role="alert">プロフィールを読み込めませんでした: {loadError}</p>;

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
  const [items, setItems] = useState<CareerRow[]>([]);
  const [originalItems, setOriginalItems] = useState<CareerItem[]>([]);
  const [companies, setCompanies] = useState<NameMaster[]>([]);
  const [roles, setRoles] = useState<NameMaster[]>([]);
  const [periods, setPeriods] = useState<Record<string, PeriodInputs>>({});
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  // 文章チェック（アイテムごと）
  const [proofCheckingId, setProofCheckingId] = useState<string | null>(null);
  const [proofResultsMap, setProofResultsMap] = useState<
    Record<string, { issues: ProofreadIssue[] | null; error: string }>
  >({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from("career_items").select("*").order("sort_order", { ascending: true }),
      listNameMaster("companies"),
      listNameMaster("roles"),
    ]).then(([career, co, ro]) => {
        if (cancelled) return;
        const failure = career.error?.message ?? co.error ?? ro.error;
        if (failure) setLoadError(`読み込みに失敗しました: ${failure}`);
        const rows = career.data ?? [];
        setItems(rows);
        setOriginalItems(rows);
        setCompanies(co.data);
        setRoles(ro.data);
        setPeriods(Object.fromEntries(rows.map((r) => [r.id, periodInputsOf(r)])));
        setFetching(false);
      });
    return () => { cancelled = true; };
  }, []);

  // 未保存判定は描画中に導出する（早期 return より前に置く）
  const baseById = new Map(originalItems.map((o) => [o.id, o]));
  const periodOf = (id: string) => periods[id] ?? EMPTY_PERIOD;
  const periodChanged = (it: CareerRow) =>
    !isSamePeriod(periodOf(it.id), periodInputsOf(baseById.get(it.id)));
  const isRowDirty = (it: CareerRow) => {
    const b = baseById.get(it.id);
    return (
      !!it.isNew || !b ||
      b.role !== it.role || b.company !== it.company ||
      b.role_id !== it.role_id || b.company_id !== it.company_id ||
      b.description !== it.description || b.sort_order !== it.sort_order ||
      periodChanged(it)
    );
  };
  const dirty = items.some(isRowDirty);
  useEffect(() => {
    onDirtyChange(dirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  const handleProofread = async (item: CareerItem) => {
    const text = item.description;
    setProofCheckingId(item.id);
    setProofResultsMap((prev) => ({ ...prev, [item.id]: { issues: null, error: "" } }));
    try {
      const { issues, error } = await runProofread(text);
      setProofResultsMap((prev) => ({ ...prev, [item.id]: { issues: error ? null : issues, error: error ?? "" } }));
    } catch {
      setProofResultsMap((prev) => ({ ...prev, [item.id]: { issues: null, error: "チェックに失敗しました" } }));
    } finally {
      setProofCheckingId(null);
    }
  };

  const clearErr = (id: string) => {
    setRowErrors((p) => {
      if (!p[id]) return p;
      const n = { ...p };
      delete n[id];
      return n;
    });
    setSaveError("");
  };

  const updateItem = (id: string, key: "description", val: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [key]: val } : it)));
    clearErr(id);
  };

  const selectMaster = (id: string, kind: "company" | "role", item: NameMaster | null) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        return kind === "company"
          ? { ...it, company_id: item?.id ?? null, company: item?.name ?? "" }
          : { ...it, role_id: item?.id ?? null, role: item?.name ?? "" };
      }),
    );
    clearErr(id);
  };

  const addMaster = async (kind: "company" | "role", name: string) => {
    const res = await addNameMaster(kind === "company" ? "companies" : "roles", name);
    const item = res.item;
    if (item) {
      const setList = kind === "company" ? setCompanies : setRoles;
      setList((prev) => (prev.some((o) => o.id === item.id) ? prev : [...prev, item]));
    }
    return res;
  };

  const updatePeriod = (id: string, p: PeriodInputs) => {
    setPeriods((prev) => ({ ...prev, [id]: p }));
    clearErr(id);
  };

  const handleAdd = () => {
    const id = crypto.randomUUID();
    const sort_order = items.reduce((m, it) => Math.max(m, it.sort_order), -1) + 1;
    setItems((prev) => [
      ...prev,
      { id, role: "", role_id: null, company: "", company_id: null, period: "", start_date: null, end_date: null, is_current: false, description: "", sort_order, created_at: null, isNew: true },
    ]);
    setPeriods((prev) => ({ ...prev, [id]: { ...EMPTY_PERIOD } }));
  };

  // 並び替えは画面上だけ。保存ボタンでまとめて反映する
  const handleMove = (index: number, dir: -1 | 1) =>
    setItems((prev) => moveItem(prev, index, index + dir).map((it, i) => ({ ...it, sort_order: i })));

  const handleDelete = async (item: CareerRow) => {
    if (item.isNew) {
      if (!window.confirm("未保存の経歴を破棄します。よろしいですか？")) return;
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      clearErr(item.id);
      return;
    }
    if (!window.confirm("この経歴を削除します。よろしいですか？\nこの操作は取り消せません。")) return;
    setDeletingId(item.id);
    clearErr(item.id);
    const { error } = await deleteCareerItem(item.id);
    setDeletingId(null);
    if (error) {
      setRowErrors((p) => ({ ...p, [item.id]: `削除に失敗しました: ${error}` }));
      return;
    }
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    setOriginalItems((prev) => prev.filter((o) => o.id !== item.id));
  };

  const scrollToRow = (id: string) =>
    document.getElementById(`career-row-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });

  const handleSave = async () => {
    if (saving) return;
    setSaveError("");
    setSaved(false);
    const errs: Record<string, string> = {};
    for (const it of items) {
      if (!isRowDirty(it)) continue; // 触っていない既存行は検証しない（DB 上の空行で全体が止まらないように）
      if (!it.role_id) errs[it.id] = "役職を選んでください";
      else if (!it.company_id) errs[it.id] = "会社名を選んでください";
      else if (periodChanged(it)) {
        const pe = validatePeriod(periodOf(it.id));
        if (pe) errs[it.id] = pe;
      }
    }
    const bad = items.filter((it) => errs[it.id]);
    if (bad.length) {
      const i = items.indexOf(bad[0]);
      setRowErrors(errs);
      setSaveError(`#${i + 1}: ${errs[bad[0].id]}${bad.length > 1 ? `（ほか ${bad.length - 1} 件）` : ""}`);
      scrollToRow(bad[0].id);
      return;
    }
    setRowErrors({});
    setSaving(true);
    const companiesById = new Map(companies.map((c) => [c.id, c]));
    const rolesById = new Map(roles.map((r) => [r.id, r]));
    const savedRows: CareerItem[] = [];
    let failure: { id: string; msg: string } | null = null;
    for (const it of items) {
      if (!isRowDirty(it)) continue;
      const { period: periodText, ...cols } = periodColumnsForSave(baseById.get(it.id) ?? it, periodOf(it.id), periodChanged(it));
      const period = periodText ?? "";
      const role = (it.role_id ? rolesById.get(it.role_id)?.name : undefined) ?? it.role;
      const company = (it.company_id ? companiesById.get(it.company_id)?.name : undefined) ?? it.company;
      const row: CareerItem = {
        id: it.id, role, role_id: it.role_id, company, company_id: it.company_id, period, ...cols,
        description: it.description, sort_order: it.sort_order, created_at: it.created_at,
      };
      const res = await saveCareerItem({
        id: row.id, role: row.role, role_id: row.role_id, company: row.company, company_id: row.company_id,
        period: row.period, start_date: row.start_date, end_date: row.end_date, is_current: row.is_current,
        description: row.description, sort_order: row.sort_order,
      });
      if (res.error) { failure = { id: it.id, msg: res.error }; break; }
      savedRows.push({ ...row, company: res.company ?? row.company, role: res.role ?? row.role, period: res.period ?? row.period });
    }
    setSaving(false);
    if (savedRows.length) {
      const byId = new Map(savedRows.map((r) => [r.id, r]));
      setItems((prev) => prev.map((it) => byId.get(it.id) ?? it));
      setOriginalItems((prev) => [...prev.filter((o) => !byId.has(o.id)), ...savedRows]);
      setPeriods((prev) => {
        const n = { ...prev };
        for (const r of savedRows) n[r.id] = periodInputsOf(r);
        return n;
      });
    }
    if (failure) {
      const i = items.findIndex((it) => it.id === failure.id);
      const it = items[i];
      setRowErrors({ [failure.id]: `保存に失敗しました: ${failure.msg}` });
      setSaveError(
        `#${i + 1}（${it.company || it.role || "無題"}）の保存に失敗しました: ${failure.msg}${
          savedRows.length ? `。それより前の ${savedRows.length} 行は保存済みです` : ""
        }`,
      );
      scrollToRow(failure.id);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (fetching) return <div className="h-64 animate-pulse rounded-[12px] bg-[#1a1a1a]" />;
  if (loadError && items.length === 0) return <p className="text-[13px] text-danger-300" role="alert">経歴を読み込めませんでした: {loadError}</p>;

  return (
    <section id="career" className="scroll-mt-8">
      <SectionTitle label="Career" title="経歴" />
      <Link
        href="/admin/masters"
        className="mb-3 inline-block text-[11px] text-primary hover:underline"
        onClick={(e) => {
          if (dirty && !window.confirm("未保存の変更があります。破棄してマスタ管理へ移動しますか？")) e.preventDefault();
        }}
      >
        会社・役職の改名・削除は「マスタ管理」で
      </Link>
      {loadError && <p className="mb-4 text-[13px] text-danger-300">{loadError}</p>}
      {dirty && <p className="mb-3 text-[11px] text-[#f4c248]">未保存の変更があります</p>}

      <fieldset disabled={saving || deletingId !== null} className="min-w-0">
      <div className="mb-6 flex flex-col gap-4">
        {items.map((item, idx) => (
          <div
            key={item.id}
            id={`career-row-${item.id}`}
            className="scroll-mt-8 rounded-[12px] border border-border-light bg-surface p-5"
          >
            {(() => {
              const base = baseById.get(item.id);
              const dirtyRole = base && (base.role_id !== item.role_id || base.role !== item.role);
              const dirtyCompany = base && (base.company_id !== item.company_id || base.company !== item.company);
              const dirtyPeriod = base && periodChanged(item);
              const dirtyDescription = base && base.description !== item.description;
              return (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] text-system-700">#{idx + 1}</span>
                      {item.isNew && <span className="text-[11px] text-[#f4c248]">新規（未保存）</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <MoveButtons
                        index={idx}
                        length={items.length}
                        label={item.company || `経歴${idx + 1}`}
                        onMove={(d) => handleMove(idx, d)}
                      />
                      <button
                        type="button"
                        onClick={() => void handleDelete(item)}
                        disabled={deletingId === item.id}
                        className="rounded px-2 py-1 text-[12px] text-system-700 hover:bg-danger-300/10 hover:text-danger-300 disabled:opacity-40"
                      >
                        {deletingId === item.id ? "…" : "削除"}
                      </button>
                    </div>
                  </div>
                  {rowErrors[item.id] && (
                    <p className="mb-3 text-[12px] text-danger-300">{rowErrors[item.id]}</p>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>役職</FieldLabel>
                      <MasterSelect
                        value={item.role_id}
                        legacyText={item.role}
                        options={roles}
                        onSelect={(m) => selectMaster(item.id, "role", m)}
                        onAdd={(name) => addMaster("role", name)}
                        placeholder="（役職を選択）"
                        addPlaceholder="新しい役職"
                      />
                      {dirtyRole && (
                        <p className="mt-1 text-[11px] text-[#f4c248]">
                          未保存の変更があります
                        </p>
                      )}
                    </div>
                    <div>
                      <FieldLabel>会社名</FieldLabel>
                      <MasterSelect
                        value={item.company_id}
                        legacyText={item.company}
                        options={companies}
                        onSelect={(m) => selectMaster(item.id, "company", m)}
                        onAdd={(name) => addMaster("company", name)}
                        placeholder="（会社を選択）"
                        addPlaceholder="新しい会社名"
                      />
                      {dirtyCompany && (
                        <p className="mt-1 text-[11px] text-[#f4c248]">
                          未保存の変更があります
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <FieldLabel>期間</FieldLabel>
                      <PeriodFields
                        value={periodOf(item.id)}
                        disabled={saving}
                        onChange={(p) => updatePeriod(item.id, p)}
                      />
                      {base && isLegacyPeriod(base) && !periodChanged(item) && (
                        <p className="mt-1 text-[11px] text-[#f4c248]">
                          現在の値「{base.period}」は年月の入力欄で読み取れない形式です。入力して保存すると置き換わります。
                        </p>
                      )}
                      {dirtyPeriod && (
                        <p className="mt-1 text-[11px] text-[#f4c248]">
                          未保存の変更があります
                        </p>
                      )}
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
      <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center gap-3 border-t border-border-light bg-[#0a0a0a] py-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!dirty || saving || deletingId !== null}
          className="rounded-[8px] bg-primary px-4 py-1.5 text-[13px] font-semibold text-[#0a0a0a] hover:opacity-80 disabled:opacity-40"
        >
          {saving ? "保存中…" : "保存"}
        </button>
        {saved && <span className="text-[12px] text-primary">✓ 保存しました</span>}
        {saveError && <span className="text-[12px] text-danger-300">{saveError}</span>}
      </div>
      </fieldset>
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
type BarWithTools = SkillExperience & { tools: BarTool[]; isNew?: true };
type CardWithRelations = SkillCard & {
  bars: BarWithTools[];
  isNew?: true;
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
  const [loadError, setLoadError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId]   = useState<string | null>(null);
  const [savedId, setSavedId]     = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toolVocab, setToolVocab] = useState<ToolChip[]>([]);
  const [newToolNames, setNewToolNames] = useState<Record<string, string>>({});
  const [addingTool, setAddingTool] = useState(false);
  const [movingBars, setMovingBars] = useState(false);
  const [movingCards, setMovingCards] = useState(false);

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
      const [cardResult, barResult, linkResult, toolResult] = await Promise.all([
        supabase.from("skill_cards").select("*").order("sort_order", { ascending: true }),
        supabase.from("skill_experience").select("*").order("sort_order",  { ascending: true }),
        supabase
          .from("skill_experience_tools")
          .select("experience_id, sort_order, tools_vocab(id, name)")
          .order("sort_order", { ascending: true }),
        supabase.from("tools_vocab").select("id, name, icon_url, slug, category").order("name"),
      ]);
      const failure = [cardResult, barResult, linkResult, toolResult].find((result) => result.error);
      if (failure?.error || !cardResult.data) {
        setLoadError(failure?.error?.message ?? "スキルカードを取得できませんでした");
        setFetching(false);
        return;
      }
      const cardRows = cardResult.data;
      const barRows = barResult.data;
      const linkRows = linkResult.data;
      const toolRows = toolResult.data;

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
    let cardPersisted = false;
    const persistedBarIds = new Set<string>();
    try {
      const c = await saveSkillCard({ id: card.id, title: card.title, title_jp: card.title_jp, icon_set: card.icon_set, icon_name: card.icon_name, sort_order: card.sort_order });
      if (c.error) { fail(`カード情報: ${c.error}`); return; }
      cardPersisted = true;
      for (const [i, bar] of card.bars.entries()) {
        const name = `スキルバー #${i + 1}（${bar.label || "無題"}）`;
        const b = await saveSkillBar({ id: bar.id, card_id: card.id, label: bar.label, label_short: bar.label_short, segments: bar.segments, level: bar.level, description: bar.description, sort_order: bar.sort_order, icon_set: bar.icon_set, icon_name: bar.icon_name, label_note: bar.label_note });
        if (b.error) { fail(`${name}: ${b.error}`); return; }
        persistedBarIds.add(bar.id);
        const t = await saveExperienceToolIds(bar.id, bar.tools.map((x) => x.id));
        if (t.error) { fail(`${name} のツール: ${t.error}`); return; }
      }
      markCardSaved(card.id);
      setSavedId(card.id); setTimeout(() => setSavedId(null), 2000);
    } finally {
      if (cardPersisted) {
        setCards((prev) => prev.map((c) => c.id !== card.id ? c : {
          ...c,
          isNew: undefined,
          bars: c.bars.map((b) => (persistedBarIds.has(b.id) ? { ...b, isNew: undefined } : b)),
        }));
      }
      setSavingId(null);
    }
  };

  const handleDeleteCard = async (id: string) => {
    const target = cards.find((c) => c.id === id);
    if (target?.isNew) {
      if (!window.confirm("未保存のカードを破棄します。よろしいですか？")) return;
      setCards((prev) => prev.filter((c) => c.id !== id));
      markCardSaved(id);
      if (expandedId === id) setExpandedId(null);
      return;
    }
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

  const handleAddCard = () => {
    const id = crypto.randomUUID();
    const sort_order = cards.reduce((m, c) => Math.max(m, c.sort_order), -1) + 1;
    setCards((prev) => [...prev, {
      id, title: "New Card", title_jp: "新しいカード",
      icon_set: "Edit", icon_name: "writing-fluently",
      sort_order, created_at: null, bars: [], isNew: true,
    }]);
    setExpandedId(id);
    markCardDirty(id);
  };

  const handleMoveCard = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= cards.length) return;
    const prevCards = cards;
    const movedId = cards[index].id;
    const next = [...cards];
    [next[index], next[target]] = [next[target], next[index]];
    const updated = next.map((c, i) => ({ ...c, sort_order: i }));
    const persisted = updated.filter((c) => !c.isNew).map(({ id, sort_order }) => ({ id, sort_order }));
    setCards(updated);
    if (persisted.length === 0) return;
    setMovingCards(true);
    try {
      const { error } = await moveSkillCards(persisted);
      if (error) {
        // 並び順だけ元に戻す（待ち時間中の編集や下書きは残す）
        const order = new Map(prevCards.map((c, i) => [c.id, i]));
        setCards((prev) =>
          [...prev]
            .sort((a, b) => (order.get(a.id) ?? prev.length) - (order.get(b.id) ?? prev.length))
            .map((c, i) => ({ ...c, sort_order: i })),
        );
        setCardErrors((p) => ({ ...p, [movedId]: `並び順を保存できませんでした: ${error}` }));
      }
    } finally {
      setMovingCards(false);
    }
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
    const targetBar = cards.find((c) => c.id === cardId)?.bars.find((b) => b.id === barId);
    if (targetBar?.isNew) {
      if (!window.confirm("未保存のスキルバーを破棄します。よろしいですか？")) return;
      setCards((prev) => prev.map((c) =>
        c.id !== cardId ? c : { ...c, bars: c.bars.filter((b) => b.id !== barId) }
      ));
      return;
    }
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

  const handleAddBar = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const sort_order = card.bars.reduce((m, b) => Math.max(m, b.sort_order), -1) + 1;
    const bar: BarWithTools = {
      id: crypto.randomUUID(), card_id: cardId, label: "", label_short: null,
      segments: LEVEL_SEGMENTS[2], level: SKILL_LEVELS[1].en, description: null, sort_order,
      icon_set: "Base", icon_name: "system", label_note: null, tools: [], isNew: true,
    };
    setCards((prev) => prev.map((c) => (c.id !== cardId ? c : { ...c, bars: [...c.bars, bar] })));
    markCardDirty(cardId);
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
          setCardErrors((p) => ({ ...p, [cardId]: res.error ?? "ツールの追加に失敗しました" }));
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
    const persistedBars = nextBars.filter((b) => !b.isNew).map(({ id, sort_order }) => ({ id, sort_order }));
    if (persistedBars.length === 0) return;
    setMovingBars(true);
    try {
      const { error } = await moveSkillBars(persistedBars);
      if (error) {
        setCardErrors((p) => ({ ...p, [cardId]: `並び順の保存に失敗しました: ${error}` }));
        // 並び順だけ元に戻す（待ち時間中の編集や下書きは残す）
        const order = new Map(prevBars.map((b, i) => [b.id, i]));
        setCards((prev) =>
          prev.map((c) =>
            c.id !== cardId
              ? c
              : {
                  ...c,
                  bars: [...c.bars]
                    .sort((a, b) => (order.get(a.id) ?? c.bars.length) - (order.get(b.id) ?? c.bars.length))
                    .map((b, i) => ({ ...b, sort_order: i })),
                },
          ),
        );
      }
    } finally {
      setMovingBars(false);
    }
  };

  if (fetching) return <div className="h-64 animate-pulse rounded-[12px] bg-[#1a1a1a]" />;
  if (loadError) return <p className="text-[13px] text-danger-300" role="alert">スキルを読み込めませんでした: {loadError}</p>;

  const toolById = new Map(toolVocab.map((t) => [t.id, t]));

  return (
    <section id="skills-experience" className="scroll-mt-8">
      <SectionTitle label="Skills Experience" title="スキルカルーセル" />
      {loadError && <p className="mb-4 text-[13px] text-danger-300">{loadError}</p>}
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
                  {cardErrors[card.id] && !isOpen && (
                    <span title={cardErrors[card.id]} className="max-w-[320px] truncate text-[11px] text-danger-300">{cardErrors[card.id]}</span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleMoveCard(idx, -1); }}
                    disabled={idx === 0 || savingId !== null || movingCards}
                    className="rounded px-2 py-1 text-[12px] text-system-700 hover:text-white disabled:opacity-30"
                  >↑</button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleMoveCard(idx, 1); }}
                    disabled={idx === cards.length - 1 || savingId !== null || movingCards}
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
                                    {opt.icon_url && <ProtectedImage src={opt.icon_url} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />}
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
                      {deletingId === card.id ? "削除中…" : card.isNew ? "カードを破棄" : "カードを削除"}
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
    <div className="admin-root flex h-screen bg-[#0a0a0a]">
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
