"use client";

import React from "react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Headline from "@/components/Headline";
import { supabase } from "@/src/lib/supabase";
import {
  saveProject,
  deleteProject,
  addSkillLabelFromProjects,
  addToolNameFromProjects,
  saveSkillCard,
  deleteSkillCard,
  addSkillCard,
  moveSkillCards,
  saveSkillBar,
  deleteSkillBar,
  addSkillBar,
  saveSkillTool,
  deleteSkillTool,
  addSkillTool,
  listAllProjectSkillLabels,
  listAllProjectToolNames,
  saveProjectSkillsByLabels,
  saveProjectToolsByNames,
  saveUserSkills,
  listStorageImages,
  uploadStorageImage,
} from "@/app/admin/actions";
import type { SkillVocab, ToolVocab, StorageImage } from "@/app/admin/actions";
import type { Tables } from "@/src/types/supabase";
import type { Json } from "@/src/types/supabase";

// ─── 文章チェック ─────────────────────────────────────
type ProofreadIssue = {
  line: number;
  column: number;
  message: string;
  ruleId: string;
  severity: "error" | "warning";
};

async function runProofread(
  text: string,
): Promise<{ issues: ProofreadIssue[]; error?: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { issues: [] };
  const res = await fetch("/api/proofread", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: trimmed }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── 型 ───────────────────────────────────────────────
type Profile    = Tables<"profile">;
type CareerItem = Tables<"career_items">;
type Project    = Tables<"projects">;
type SkillCard       = Tables<"skill_cards">;
type SkillExperience = Tables<"skill_experience">;
type SkillTool       = Tables<"skill_tools">;

// project_skills / project_tools はDB正規化テーブルで管理するため、
// ローカル状態では skills/tools をフロントエンド専用フィールドとして保持する
type ProjectLocal = Tables<"projects"> & { skills: string[]; tools: string[] };

type SkillKey =
  | "prototype" | "visual" | "implementation" | "interaction"
  | "accessibility" | "writing" | "ia" | "qualitative_research"
  | "quantitative_research" | "strategy" | "facilitation" | "presentation";

const SKILL_LABELS: Record<SkillKey, string> = {
  prototype: "プロトタイプ",
  visual: "ビジュアル",
  implementation: "実装",
  interaction: "インタラクション",
  accessibility: "アクセシビリティ",
  writing: "ライティング",
  ia: "情報設計 (IA)",
  qualitative_research: "定性調査",
  quantitative_research: "定量調査",
  strategy: "戦略",
  facilitation: "ファシリテーション",
  presentation: "プレゼンテーション",
};
const SKILL_KEYS = Object.keys(SKILL_LABELS) as SkillKey[];

// ─── ナビゲーション ────────────────────────────────────
const NAV_SECTIONS = [
  { id: "profile",          label: "Profile",          labelJa: "プロフィール・自己紹介" },
  { id: "career",           label: "Career",           labelJa: "経歴" },
  { id: "projects",         label: "Projects",         labelJa: "プロジェクト" },
  { id: "skills",           label: "Skills",           labelJa: "スキル" },
  { id: "skills-experience", label: "Skills Experience", labelJa: "スキルカルーセル" },
] as const;

// ─── 共通 UI ──────────────────────────────────────────

function SectionTitle({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-8">
      <p className="mb-1 text-[12px] tracking-[0.6px] text-[#48f4be]">{label}</p>
      <p className="font-mplus text-[32px] leading-[1.5] tracking-[1.6px] text-white">{title}</p>
      <div className="mt-3 h-[2px] w-10 rounded bg-[#424242]" />
    </div>
  );
}

// ─── 画像ピッカー モーダル ────────────────────────────────────────────────────

function ImagePickerModal({
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
    setLoading(true);
    setSelected(null);
    setQuery("");
    setAlt("");
    setUploadError("");
    listStorageImages().then(({ data }) => {
      setImages(data);
      setLoading(false);
    });
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
    fd.append("file", file);
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
        className="flex max-h-[82vh] w-[660px] flex-col overflow-hidden rounded-[12px] border border-[#424242] bg-[#1a1a1a]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-5 py-4">
          <p className="text-[14px] font-semibold text-white">🖼 画像を選択</p>
          <button
            type="button"
            onClick={onClose}
            className="text-[18px] text-[#616161] hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* アップロードゾーン */}
        <div className="px-5 pt-4">
          <div
            className={`cursor-pointer rounded-[8px] border-2 border-dashed p-4 text-center transition-colors ${
              dragging
                ? "border-[#48f4be] bg-[#48f4be]/10"
                : "border-[#424242] hover:border-[#616161]"
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
              <p className="text-[12px] text-[#9e9e9e]">アップロード中…</p>
            ) : (
              <p className="text-[12px] text-[#9e9e9e]">
                クリック / ドラッグ&amp;ドロップでアップロード
                <span className="ml-2 text-[#616161]">→ {folder}/</span>
              </p>
            )}
            {uploadError && (
              <p className="mt-1 text-[11px] text-[#f4487e]">{uploadError}</p>
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
            className="w-full rounded-[8px] border border-[#424242] bg-[#212121] px-3 py-2 text-[13px] text-white placeholder-[#616161] outline-none focus:border-[#48f4be]"
          />
        </div>

        {/* 画像グリッド */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <p className="py-8 text-center text-[12px] text-[#616161]">読み込み中…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-[#616161]">
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
                      ? "border-[#48f4be]"
                      : "border-[#424242] hover:border-[#616161]"
                  }`}
                >
                  <img src={img.url} alt={img.name} className="h-20 w-full object-cover" />
                  <p className="truncate bg-[#121212] px-1 py-1 text-left text-[9px] text-[#9e9e9e]">
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
            <p className="mb-1 text-[11px] text-[#9e9e9e]">代替テキスト（alt）</p>
            <input
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="画像の説明（任意）"
              className="w-full rounded-[8px] border border-[#424242] bg-[#212121] px-3 py-2 text-[13px] text-white placeholder-[#616161] outline-none focus:border-[#48f4be]"
            />
          </div>
        )}

        {/* フッター */}
        <div className="flex items-center justify-between border-t border-[#2a2a2a] px-5 py-3">
          <p className="text-[11px] text-[#616161]">
            {selected ? `選択中: ${selected.path}` : "画像をクリックして選択"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[8px] border border-[#424242] px-4 py-2 text-[13px] text-[#9e9e9e] transition-colors hover:border-[#616161] hover:text-white"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selected}
              className="rounded-[8px] bg-[#48f4be] px-4 py-2 text-[13px] font-semibold text-black transition-opacity disabled:opacity-40"
            >
              {showAlt ? "挿入" : "選択"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 画像ピッカー フィールド（URL入力欄の置き換え）────────────────────────────

function ImagePickerField({
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
          className="w-full rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-3 py-2 text-[14px] text-white placeholder-[#616161] outline-none transition-colors focus:border-[#48f4be]"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-[8px] border border-[#424242] px-3 py-2 text-[12px] text-[#9e9e9e] transition-colors hover:border-[#48f4be] hover:text-white"
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[12px] tracking-[0.6px] text-[#9e9e9e]">{children}</p>;
}

function Input({
  value, onChange, placeholder, className = "", list,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  list?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      list={list}
      className={`w-full rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-3 py-2 text-[14px] text-white placeholder-[#616161] outline-none transition-colors focus:border-[#48f4be] ${className}`}
    />
  );
}

function Textarea({
  value, onChange, rows = 4, placeholder,
}: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full resize-y rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-3 py-2 text-[14px] leading-relaxed text-white placeholder-[#616161] outline-none transition-colors focus:border-[#48f4be]"
    />
  );
}

function SaveButton({
  onClick, loading, saved, error,
}: { onClick: () => void; loading: boolean; saved: boolean; error: string }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="rounded-[8px] bg-[#48f4be] px-5 py-2 text-[14px] font-semibold text-[#0a0a0a] transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        {loading ? "保存中…" : "保存"}
      </button>
      {saved && <span className="text-[13px] text-[#48f4be]">✓ 保存しました</span>}
      {error && <span className="text-[13px] text-[#f4487e]">{error}</span>}
    </div>
  );
}

function ProofreadPanel({
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
      <div className="mt-3 flex items-center gap-2 text-[13px] text-[#9e9e9e]">
        <span className="inline-block animate-spin">↻</span> チェック中…
      </div>
    );
  }
  if (error) return <p className="mt-3 text-[13px] text-[#f4487e]">{error}</p>;
  if (issues === null) return null;
  if (issues.length === 0) {
    return (
      <div className="mt-3 rounded-[8px] border border-[#48f4be]/20 bg-[#0a2a1e] px-4 py-3">
        <p className="text-[13px] text-[#48f4be]">✓ 問題は見つかりませんでした</p>
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
              <p className="mt-0.5 text-[11px] text-[#616161]">{issue.ruleId}</p>
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
    career_lead: null,
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
      if (data) setForm(data as ProfileForm);
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
            className="rounded-[6px] border border-[#424242] px-3 py-1 text-[12px] text-[#9e9e9e] hover:border-[#48f4be] hover:text-white"
          >
            ＋ 段落追加
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {form.introduction.map((para, i) => (
            <div key={i} className="relative">
              <Textarea
                value={para}
                onChange={(v) => {
                  const arr = [...form.introduction];
                  arr[i] = v;
                  set("introduction", arr);
                }}
                rows={3}
              />
              <button
                type="button"
                onClick={() => set("introduction", form.introduction.filter((_, j) => j !== i))}
                className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-[11px] text-[#616161] hover:bg-[#f4487e]/10 hover:text-[#f4487e]"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 経歴リード文 */}
      <div className="mb-8">
        <FieldLabel>経歴セクション・リード文</FieldLabel>
        <Textarea
          value={form.career_lead ?? ""}
          onChange={(v) => set("career_lead", v || null)}
          rows={3}
          placeholder="こんにちは。UI/UXデザイナーの〇〇です。東京を拠点に…"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SaveButton onClick={handleSave} loading={loading} saved={saved} error={error} />
        <button
          type="button"
          onClick={handleProofread}
          disabled={proofChecking}
          className="rounded-[8px] border border-[#424242] px-5 py-2 text-[14px] text-[#9e9e9e] transition-colors hover:border-[#48f4be] hover:text-white disabled:opacity-40"
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
    setOriginalItems((prev) => {
      const nextOriginal = (() => {
        const existing = prev.find((o) => o.id === item.id);
        if (!existing) return [...prev, item];
        return prev.map((o) => (o.id === item.id ? item : o));
      })();
      recomputeDirty(items, nextOriginal);
      return nextOriginal;
    });
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
      setItems((prev) => {
        const next = [...prev, data];
        // 追加直後は DB の値と一致しているので dirty にはしない
        setOriginalItems((base) => {
          const nextOriginal = [...base, data];
          recomputeDirty(next, nextOriginal);
          return nextOriginal;
        });
        return next;
      });
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
      {globalError && <p className="mb-4 text-[13px] text-[#f4487e]">{globalError}</p>}

      <div className="mb-6 flex flex-col gap-4">
        {items.map((item, idx) => (
          <div key={item.id} className="rounded-[12px] border border-[#424242] bg-[#212121] p-5">
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
                    <span className="text-[12px] text-[#616161]">#{idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleMove(idx, -1)}
                        disabled={idx === 0}
                        className="rounded px-2 py-1 text-[12px] text-[#616161] hover:text-white disabled:opacity-30"
                      >↑</button>
                      <button
                        type="button"
                        onClick={() => handleMove(idx, 1)}
                        disabled={idx === items.length - 1}
                        className="rounded px-2 py-1 text-[12px] text-[#616161] hover:text-white disabled:opacity-30"
                      >↓</button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="rounded px-2 py-1 text-[12px] text-[#616161] hover:bg-[#f4487e]/10 hover:text-[#f4487e] disabled:opacity-40"
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
                                <p className="mb-1 text-[11px] text-[#9e9e9e]">
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
                                    className="w-24 rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-2 py-1 text-[13px] text-white outline-none"
                                  />
                                  <span className="text-[12px] text-[#9e9e9e]">
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
                                    className="w-16 rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-2 py-1 text-[13px] text-white outline-none"
                                  />
                                  <span className="text-[12px] text-[#9e9e9e]">
                                    月
                                  </span>
                                </div>
                              </div>
                              <div>
                                <p className="mb-1 text-[11px] text-[#9e9e9e]">
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
                                      className="w-24 rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-2 py-1 text-[13px] text-white outline-none disabled:opacity-40"
                                    />
                                    <span className="text-[12px] text-[#9e9e9e]">
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
                                      className="w-16 rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-2 py-1 text-[13px] text-white outline-none disabled:opacity-40"
                                    />
                                    <span className="text-[12px] text-[#9e9e9e]">
                                      月
                                    </span>
                                  </div>
                                  <label className="inline-flex items-center gap-2 text-[12px] text-[#9e9e9e]">
                                    <input
                                      type="checkbox"
                                      className="h-3 w-3 accent-[#48f4be]"
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
                className="rounded-[8px] bg-[#48f4be] px-4 py-1.5 text-[13px] font-semibold text-[#0a0a0a] hover:opacity-80 disabled:opacity-40"
              >
                {savingId === item.id ? "保存中…" : "保存"}
              </button>
              {savedId === item.id && <span className="text-[12px] text-[#48f4be]">✓ 保存しました</span>}
              <button
                type="button"
                onClick={() => handleProofread(item)}
                disabled={proofCheckingId === item.id}
                className="rounded-[8px] border border-[#424242] px-3 py-1.5 text-[13px] text-[#9e9e9e] transition-colors hover:border-[#48f4be] hover:text-white disabled:opacity-40"
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
        className="w-full rounded-[12px] border border-dashed border-[#424242] py-4 text-[14px] text-[#616161] transition-colors hover:border-[#48f4be] hover:text-white"
      >
        ＋ 経歴を追加
      </button>
    </section>
  );
}

// ─── SectionsEditor ───────────────────────────────────
// sections JSON ↔ Markdown 変換ユーティリティ
type SectionItem = { heading: string; body: string };

/** Markdown の見出し（# / ##）・画像・段落をレンダリングして表示するコンポーネント */
function SectionBodyRenderer({ body }: { body: string }) {
  const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const renderParagraph = (para: string, key: string) => {
    const lines = para.split("\n");
    return (
      <p key={key} className="text-[15px] leading-[1.5] tracking-[0.45px] text-white/80">
        {lines.map((line, li) => {
          const nodes: React.ReactNode[] = [];
          let last = 0;
          let m: RegExpExecArray | null;
          IMG_RE.lastIndex = 0;
          while ((m = IMG_RE.exec(line)) !== null) {
            if (m.index > last) nodes.push(line.slice(last, m.index));
            nodes.push(
              <img
                key={`img-${key}-${li}-${m.index}`}
                src={m[2]}
                alt={m[1]}
                className="my-2 max-w-full rounded-[8px] block"
              />,
            );
            last = IMG_RE.lastIndex;
          }
          if (last < line.length) nodes.push(line.slice(last));
          return (
            <React.Fragment key={li}>
              {li > 0 && <br />}
              {nodes}
            </React.Fragment>
          );
        })}
      </p>
    );
  };

  type RawBlock = { t: "para"; node: React.ReactNode } | { t: "h2"; text: string };
  const lines = body.split("\n");
  const rawBlocks: RawBlock[] = [];
  let paragraphLines: string[] = [];
  const flushParagraph = () => {
    const paragraph = paragraphLines.join("\n").trim();
    if (paragraph) rawBlocks.push({ t: "para", node: renderParagraph(paragraph, `p-${rawBlocks.length}`) });
    paragraphLines = [];
  };
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith("# ")) {
      flushParagraph();
      paragraphLines.push(line.slice(2).trim());
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      rawBlocks.push({ t: "h2", text: line.slice(3).trim() });
      continue;
    }
    if (line.trim() === "") {
      flushParagraph();
      continue;
    }
    paragraphLines.push(line);
  }
  flushParagraph();

  type Segment =
    | { type: "paras"; nodes: React.ReactNode[] }
    | { type: "section02"; h2: string; nodes: React.ReactNode[] };
  const segments: Segment[] = [];
  let topParas: React.ReactNode[] = [];
  for (const block of rawBlocks) {
    if (block.t === "h2") {
      if (topParas.length > 0) { segments.push({ type: "paras", nodes: topParas }); topParas = []; }
      segments.push({ type: "section02", h2: block.text, nodes: [] });
    } else {
      const last = segments[segments.length - 1];
      if (last?.type === "section02") last.nodes.push(block.node);
      else topParas.push(block.node);
    }
  }
  if (topParas.length > 0) segments.push({ type: "paras", nodes: topParas });

  return (
    <div className="flex flex-col gap-6">
      {segments.map((seg, i) =>
        seg.type === "paras" ? (
          <React.Fragment key={i}>{seg.nodes}</React.Fragment>
        ) : (
          <div key={i} className="flex flex-col gap-2">
            <p className="text-[20px] font-bold leading-[1.5] tracking-[1px] text-white w-full">
              {seg.h2}
            </p>
            <div className="flex flex-col gap-4">{seg.nodes}</div>
          </div>
        )
      )}
    </div>
  );
}

function sectionsToMarkdown(sections: SectionItem[]): string {
  return sections.map((s) => `# ${s.heading}\n\n${s.body}`).join("\n\n");
}

function markdownToSections(md: string): SectionItem[] {
  const result: SectionItem[] = [];
  let heading = "";
  const bodyLines: string[] = [];

  const flush = () => {
    if (heading) {
      result.push({ heading, body: bodyLines.join("\n").trim() });
    }
  };
  for (const line of md.split("\n")) {
    if (line.startsWith("# ")) {
      flush();
      heading = line.slice(2).trim();
      bodyLines.length = 0;
    } else {
      bodyLines.push(line);
    }
  }
  flush();
  return result;
}

function SectionsEditor({
  value,
  onChange,
}: {
  value: Json | null;
  onChange: (v: Json) => void;
}) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [markdown, setMarkdown] = useState(() =>
    sectionsToMarkdown((value ?? []) as SectionItem[])
  );
  const prevValue = useRef(value);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [imgModalOpen, setImgModalOpen] = useState(false);
  // カーソル位置を保存してモーダルを開く前に退避する
  const savedCaret = useRef<{ start: number; end: number } | null>(null);

  const handleChange = (md: string) => {
    setMarkdown(md);
    onChange(markdownToSections(md) as unknown as Json);
  };

  const insertImageSyntax = (url: string, alt = "") => {
    const syntax = `![${alt.trim()}](${url.trim()})`;
    const el = textareaRef.current;
    const caret = savedCaret.current;

    if (!el || !caret) {
      handleChange(markdown + `\n\n${syntax}\n`);
      return;
    }
    const before = markdown.slice(0, caret.start);
    const after = markdown.slice(caret.end);
    const needsNewline = before.length > 0 && !before.endsWith("\n\n");
    const insert = (needsNewline ? "\n\n" : "") + syntax + "\n";
    handleChange(before + insert + after);

    const caretPos = before.length + insert.length;
    requestAnimationFrame(() => {
      const el2 = textareaRef.current;
      if (!el2) return;
      el2.focus();
      el2.selectionStart = el2.selectionEnd = caretPos;
    });
  };

  const openImgModal = () => {
    // モーダルを開く前にカーソル位置を保存
    const el = textareaRef.current;
    savedCaret.current = el
      ? { start: el.selectionStart, end: el.selectionEnd }
      : null;
    setImgModalOpen(true);
  };

  const preview = markdownToSections(markdown);

  return (
    <>
      <ImagePickerModal
        open={imgModalOpen}
        onClose={() => setImgModalOpen(false)}
        onSelect={(url, alt) => { insertImageSyntax(url, alt); setImgModalOpen(false); }}
        folder="projects/sections"
        showAlt
      />
    <div className="overflow-hidden rounded-[8px] border border-[#424242]">
      {/* タブヘッダー */}
      <div className="flex items-center border-b border-[#424242] bg-[#141414]">
        {(["edit", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              "px-4 py-2 text-[12px] font-medium transition-colors",
              tab === t
                ? "border-b-2 border-[#48f4be] text-white"
                : "text-[#616161] hover:text-white",
            ].join(" ")}
          >
            {t === "edit" ? "Markdown" : "プレビュー"}
          </button>
        ))}
        <p className="ml-auto px-4 text-[11px] text-[#3a3a3a]">
          # 見出し で新しいセクション（本文内の ## 見出し も可）
        </p>
      </div>

      {/* 編集エリア */}
      {tab === "edit" && (
        <>
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <p className="text-[11px] text-[#3a3a3a]">カーソル位置に挿入されます</p>
            <button
              type="button"
              onClick={openImgModal}
              className="flex items-center gap-1.5 rounded-[6px] border border-[#424242] px-2 py-1 text-[11px] text-[#9e9e9e] transition-colors hover:border-[#48f4be] hover:text-white"
            >
              <span>🖼</span>
              <span>画像を挿入</span>
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={markdown}
            onChange={(e) => handleChange(e.target.value)}
            rows={12}
            placeholder={`# プロジェクト概要\n\n本文テキストをここに入力します。\n\n## 小見出し\n\n補足テキスト。\n\n# 課題・背景\n\n2つ目のセクションの本文。`}
            className="w-full resize-y bg-[#1a1a1a] px-4 py-3 font-mono text-[13px] leading-relaxed text-white placeholder-[#3a3a3a] outline-none"
          />
        </>
      )}

      {/* プレビューエリア（ProjectModalContent のスタイルに合わせる） */}
      {tab === "preview" && (
        <div className="min-h-[160px] bg-[#1a1a1a] px-6 py-6">
          {preview.length === 0 ? (
            <p className="text-[13px] text-[#424242]">セクションがありません</p>
          ) : (
            <div className="flex flex-col gap-8">
              {preview.map((sec, i) => (
                <div key={i} className="flex flex-col gap-6">
                  <Headline title={sec.heading} variant="markdown-h1" />
                  <SectionBodyRenderer body={sec.body} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}

// ─── Projects セクション ───────────────────────────────

function ProjectsSection({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [projects, setProjects] = useState<ProjectLocal[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [skillVocabOptions, setSkillVocabOptions] = useState<SkillVocab[]>([]);
  const [toolVocabOptions, setToolVocabOptions] = useState<ToolVocab[]>([]);
  const [newSkillLabel, setNewSkillLabel] = useState("");
  const [newToolName, setNewToolName] = useState("");
  const [openSkillSelectorProjectId, setOpenSkillSelectorProjectId] = useState<string | null>(null);
  const [openToolSelectorProjectId, setOpenToolSelectorProjectId] = useState<string | null>(null);
  const [skillExperienceRows, setSkillExperienceRows] = useState<SkillExperience[]>([]);
  // 文章チェック（プロジェクトごと）
  const [proofCheckingId, setProofCheckingId] = useState<string | null>(null);
  const [proofResultsMap, setProofResultsMap] = useState<
    Record<string, { issues: ProofreadIssue[] | null; error: string }>
  >({});

  const [dirty, setDirty] = useState(false);
  const [projectPeriodInputs, setProjectPeriodInputs] = useState<
    Record<
      string,
      {
        startYear: string;
        startMonth: string;
        endYear: string;
        endMonth: string;
        isCurrent: boolean;
      }
    >
  >({});

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

  const parseProjectPeriod = (period: string | null) => {
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

  const formatProjectPeriod = (opts: {
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
    if (!sy || !sm) return null;
    const start = `${sy}年${sm}月`;
    const end = opts.isCurrent
      ? "現在"
      : ey && em
        ? `${ey}年${em}月`
        : "";
    return end ? `${start} - ${end}` : `${start} - `;
  };

  const handleProofread = async (project: ProjectLocal) => {
    // sections の本文テキストをすべて連結してチェック
    const sections = (project.sections ?? []) as { heading: string; body: string }[];
    const text = sections.map((s) => `${s.heading}\n${s.body}`).join("\n\n");
    setProofCheckingId(project.id);
    setProofResultsMap((prev) => ({ ...prev, [project.id]: { issues: null, error: "" } }));
    try {
      const { issues } = await runProofread(text || project.title);
      setProofResultsMap((prev) => ({ ...prev, [project.id]: { issues, error: "" } }));
    } catch {
      setProofResultsMap((prev) => ({
        ...prev,
        [project.id]: { issues: null, error: "チェックに失敗しました" },
      }));
    } finally {
      setProofCheckingId(null);
    }
  };

  const fetchProjects = useCallback(async () => {
    setFetching(true);
    const [
      { data: projectRows },
      { data: skillVocabRows },
      { data: toolVocabRows },
      { data: skillExperience },
      skillLabelsMap,
      toolNamesMap,
    ] = await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .order("sort_order", { ascending: true }),
      // 語彙マスタから取得（skills_vocab / tools_vocab）
      supabase.from("skills_vocab").select("id, label").order("label"),
      supabase.from("tools_vocab").select("id, name").order("name"),
      // スキル経験（タグ表示用）
      supabase
        .from("skill_experience")
        .select("*")
        .order("sort_order", { ascending: true }),
      // project_skills / project_tools の一括取得
      listAllProjectSkillLabels(),
      listAllProjectToolNames(),
    ]);

    if (projectRows) {
      const withLocal: ProjectLocal[] = projectRows.map((p) => ({
        ...p,
        skills: skillLabelsMap[p.id] ?? [],
        tools: toolNamesMap[p.id] ?? [],
      }));
      setProjects(withLocal);
      // 期間入力用のローカル状態を初期化
      const periodState: typeof projectPeriodInputs = {};
      for (const p of withLocal) {
        periodState[p.id] = parseProjectPeriod(p.period ?? null);
      }
      setProjectPeriodInputs(periodState);
    }
    setSkillVocabOptions((skillVocabRows ?? []) as SkillVocab[]);
    setToolVocabOptions((toolVocabRows ?? []) as ToolVocab[]);
    setSkillExperienceRows((skillExperience ?? []) as SkillExperience[]);
    setFetching(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const updateProject = (id: string, key: keyof ProjectLocal, val: unknown) => {
    markDirty();
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, [key]: val } : p)));
  };

  const handleSave = async (project: ProjectLocal) => {
    setSaveError(null);
    setSavingId(project.id);

    // ProjectLocal の skills/tools フィールドは DB カラムではないため除いて渡す
    const { skills, tools, ...rest } = project;
    const periodInputs =
      projectPeriodInputs[project.id] ?? parseProjectPeriod(project.period);
    const formattedPeriod = formatProjectPeriod(periodInputs);
    const projectRow = {
      ...rest,
      period: formattedPeriod,
    };
    const [{ error }, skillsResult, toolsResult] = await Promise.all([
      saveProject(projectRow, {}),
      saveProjectSkillsByLabels(project.id, skills),
      saveProjectToolsByNames(project.id, tools),
    ]);
    setSavingId(null);
    const saveErr = error ?? skillsResult.error ?? toolsResult.error ?? null;
    if (saveErr) {
      setSaveError(saveErr);
      return;
    }
    setSavedId(project.id);
    setTimeout(() => setSavedId(null), 2000);
    markSaved();
    await fetchProjects();
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        "このプロジェクトを削除します。よろしいですか？\nこの操作は取り消せません。"
      )
    ) {
      return;
    }
    setDeletingId(id);
    const { error } = await deleteProject(id);
    setDeletingId(null);
    if (error) {
      console.error("Failed to delete project:", error);
      return;
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleAdd = () => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const newProject: ProjectLocal = {
      id,
      title: "新しいプロジェクト",
      category: null,
      thumbnail_url: null,
      role: null,
      period: null,
      skills: [],
      tools: [],
      sections: [],
      sort_order: projects.length,
      created_at: now,
    };

    setProjects((prev) => [...prev, newProject]);
    setExpandedId(id);
  };

  if (fetching) return <div className="h-64 animate-pulse rounded-[12px] bg-[#1a1a1a]" />;

  return (
    <section id="projects" className="scroll-mt-8">
      <SectionTitle label="Projects" title="プロジェクト" />
      {dirty && (
        <p className="mb-3 text-[11px] text-[#f4c248]">
          未保存の変更があります
        </p>
      )}

      <div className="mb-6 flex flex-col gap-3">
        {projects.map((project) => {
          const isOpen = expandedId === project.id;
          return (
            <div key={project.id} className="rounded-[12px] border border-[#424242] bg-[#212121]">
              {/* ヘッダー行 */}
              <div
                className="flex cursor-pointer items-center justify-between px-5 py-4"
                onClick={() => setExpandedId(isOpen ? null : project.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-medium text-[#48f4be]">{project.category ?? "—"}</span>
                  <span className="text-[14px] text-white">{project.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-[#616161]">{isOpen ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* 編集フォーム（展開時） */}
              {isOpen && (
                <div className="border-t border-[#424242] p-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <FieldLabel>タイトル</FieldLabel>
                      <Input
                        value={project.title}
                        onChange={(v) => updateProject(project.id, "title", v)}
                      />
                    </div>
                    <div>
                      <FieldLabel>カテゴリ</FieldLabel>
                      <Input
                        value={project.category ?? ""}
                        onChange={(v) => updateProject(project.id, "category", v || null)}
                        placeholder="プラットフォーム開発"
                      />
                    </div>
                    <div>
                      <FieldLabel>並び順 (sort_order)</FieldLabel>
                      <Input
                        value={String(project.sort_order)}
                        onChange={(v) => updateProject(project.id, "sort_order", Number(v) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <FieldLabel>担当役割</FieldLabel>
                      <Input
                        value={project.role ?? ""}
                        onChange={(v) => updateProject(project.id, "role", v || null)}
                        placeholder="UI/UX Designer"
                      />
                    </div>
                    <div className="col-span-2">
                      <FieldLabel>期間</FieldLabel>
                      {(() => {
                        const {
                          startYear,
                          startMonth,
                          endYear,
                          endMonth,
                          isCurrent,
                        } = projectPeriodInputs[project.id] ??
                          parseProjectPeriod(project.period);
                        const handleChange = (next: {
                          startYear?: string;
                          startMonth?: string;
                          endYear?: string;
                          endMonth?: string;
                          isCurrent?: boolean;
                        }) => {
                          const current = projectPeriodInputs[project.id] ??
                            parseProjectPeriod(project.period);
                          const updated = {
                            ...current,
                            ...next,
                          };
                          setProjectPeriodInputs((prev) => ({
                            ...prev,
                            [project.id]: updated,
                          }));
                          markDirty();
                        };
                        return (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="mb-1 text-[11px] text-[#9e9e9e]">
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
                                  placeholder="2023"
                                  className="w-24 rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-2 py-1 text-[13px] text-white outline-none"
                                />
                                <span className="text-[12px] text-[#9e9e9e]">
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
                                  className="w-16 rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-2 py-1 text-[13px] text-white outline-none"
                                />
                                <span className="text-[12px] text-[#9e9e9e]">
                                  月
                                </span>
                              </div>
                            </div>
                            <div>
                              <p className="mb-1 text-[11px] text-[#9e9e9e]">
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
                                    className="w-24 rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-2 py-1 text-[13px] text-white outline-none disabled:opacity-40"
                                  />
                                  <span className="text-[12px] text-[#9e9e9e]">
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
                                    className="w-16 rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-2 py-1 text-[13px] text-white outline-none disabled:opacity-40"
                                  />
                                  <span className="text-[12px] text-[#9e9e9e]">
                                    月
                                  </span>
                                </div>
                                <label className="inline-flex items-center gap-2 text-[12px] text-[#9e9e9e]">
                                  <input
                                    type="checkbox"
                                    className="h-3 w-3 accent-[#48f4be]"
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
                        );
                      })()}
                    </div>
                    <div className="col-span-2">
                      <FieldLabel>サムネイル</FieldLabel>
                      <ImagePickerField
                        value={project.thumbnail_url ?? ""}
                        onChange={(v) => updateProject(project.id, "thumbnail_url", v || null)}
                        folder="projects/thumbnails"
                        previewClassName="mt-2 h-16 w-28 rounded-[6px] object-cover"
                      />
                    </div>
                    <div className="col-span-2">
                      <FieldLabel>スキル</FieldLabel>
                      <div className="flex flex-col gap-2">
                        {/* 選択済みスキルの表示（常時） */}
                        <div className="flex flex-wrap gap-2">
                          {(project.skills ?? []).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                // ピルをクリックしたら選択解除
                                const current = new Set(project.skills ?? []);
                                for (const v of Array.from(current)) {
                                  if (v.toLowerCase() === s.toLowerCase()) {
                                    current.delete(v);
                                  }
                                }
                                updateProject(
                                  project.id,
                                  "skills",
                                  Array.from(current)
                                );
                              }}
                              className="rounded-[999px] bg-[#1a1a1a] px-3 py-1 text-[12px] text-white hover:bg-[#2a2a2a]"
                              title="クリックで削除"
                            >
                              {s}
                            </button>
                          ))}
                          {(project.skills ?? []).length === 0 && (
                            <span className="text-[12px] text-[#616161]">
                              未選択
                            </span>
                          )}
                        </div>
                        {/* 選択中のみ開くセレクタ */}
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSkillSelectorProjectId(
                              openSkillSelectorProjectId === project.id ? null : project.id
                            )
                          }
                          className="self-start rounded-[6px] border border-[#424242] px-3 py-1 text-[11px] text-[#9e9e9e] transition-colors hover:border-[#48f4be] hover:text-white"
                        >
                          スキルを選択
                        </button>
                        {openSkillSelectorProjectId === project.id && (
                          <div className="mt-2 flex flex-col gap-2">
                            <div className="flex flex-wrap gap-2">
                              {skillExperienceRows.map((row) => {
                                const label = row.label_short || row.label;
                                const selected = (project.skills ?? []).some(
                                  (s) => s.toLowerCase() === label.toLowerCase()
                                );
                                return (
                                  <label
                                    key={row.id}
                                    className="inline-flex items-center gap-1 rounded-[999px] border border-[#424242] bg-[#1a1a1a] px-3 py-1 text-[12px] text-white"
                                  >
                                    <input
                                      type="checkbox"
                                      className="h-3 w-3 accent-[#48f4be]"
                                      checked={selected}
                                      onChange={(e) => {
                                        const current = new Set(project.skills);
                                        if (e.target.checked) {
                                          current.add(label);
                                        } else {
                                          for (const s of Array.from(current)) {
                                            if (s.toLowerCase() === label.toLowerCase()) {
                                              current.delete(s);
                                            }
                                          }
                                        }
                                        updateProject(
                                          project.id,
                                          "skills",
                                          Array.from(current)
                                        );
                                      }}
                                    />
                                    <span>{label}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                value={newSkillLabel}
                                onChange={setNewSkillLabel}
                                placeholder="新しいスキル名を追加"
                                className="text-[12px] py-1"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  const name = newSkillLabel.trim();
                                  if (!name) return;
                                  // skills_vocab に登録して ID を取得
                                  const result = await addSkillLabelFromProjects(name);
                                  if (result.id) {
                                    setSkillVocabOptions((prev) => {
                                      if (prev.some((v) => v.label.toLowerCase() === name.toLowerCase())) return prev;
                                      return [...prev, { id: result.id!, label: name }];
                                    });
                                  }
                                  const current = new Set(project.skills ?? []);
                                  current.add(name);
                                  updateProject(
                                    project.id,
                                    "skills",
                                    Array.from(current)
                                  );
                                  setNewSkillLabel("");
                                }}
                                className="rounded-[6px] border border-[#424242] px-2 py-1 text-[11px] text-[#9e9e9e] transition-colors hover:border-[#48f4be] hover:text-white"
                              >
                                追加
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <FieldLabel>ツール</FieldLabel>
                      <div className="flex flex-col gap-2">
                        {/* 選択済みツールの表示（常時） */}
                        <div className="flex flex-wrap gap-2">
                          {(project.tools ?? []).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                // ピルをクリックしたら選択解除
                                const current = new Set(project.tools ?? []);
                                for (const v of Array.from(current)) {
                                  if (v.toLowerCase() === t.toLowerCase()) {
                                    current.delete(v);
                                  }
                                }
                                updateProject(
                                  project.id,
                                  "tools",
                                  Array.from(current)
                                );
                              }}
                              className="rounded-[999px] bg-[#1a1a1a] px-3 py-1 text-[12px] text-white hover:bg-[#2a2a2a]"
                              title="クリックで削除"
                            >
                              {t}
                            </button>
                          ))}
                          {(project.tools ?? []).length === 0 && (
                            <span className="text-[12px] text-[#616161]">
                              未選択
                            </span>
                          )}
                        </div>
                        {/* 選択中のみ開くセレクタ */}
                        <button
                          type="button"
                          onClick={() =>
                            setOpenToolSelectorProjectId(
                              openToolSelectorProjectId === project.id ? null : project.id
                            )
                          }
                          className="self-start rounded-[6px] border border-[#424242] px-3 py-1 text-[11px] text-[#9e9e9e] transition-colors hover:border-[#48f4be] hover:text-white"
                        >
                          ツールを選択
                        </button>
                        {openToolSelectorProjectId === project.id && (
                          <div className="mt-2 flex flex-col gap-2">
                            <div className="flex flex-wrap gap-2">
                              {toolVocabOptions.map((vocab) => {
                                const selected = (project.tools ?? []).some(
                                  (t) => t.toLowerCase() === vocab.name.toLowerCase()
                                );
                                return (
                                  <label
                                    key={vocab.id}
                                    className="inline-flex items-center gap-1 rounded-[999px] border border-[#424242] bg-[#1a1a1a] px-3 py-1 text-[12px] text-white"
                                  >
                                    <input
                                      type="checkbox"
                                      className="h-3 w-3 accent-[#48f4be]"
                                      checked={selected}
                                      onChange={(e) => {
                                        const current = new Set(project.tools ?? []);
                                        if (e.target.checked) {
                                          current.add(vocab.name);
                                        } else {
                                          for (const t of Array.from(current)) {
                                            if (t.toLowerCase() === vocab.name.toLowerCase()) {
                                              current.delete(t);
                                            }
                                          }
                                        }
                                        updateProject(
                                          project.id,
                                          "tools",
                                          Array.from(current)
                                        );
                                      }}
                                    />
                                    <span>{vocab.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                value={newToolName}
                                onChange={setNewToolName}
                                placeholder="新しいツール名を追加"
                                className="text-[12px] py-1"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  const name = newToolName.trim();
                                  if (!name) return;
                                  // tools_vocab に登録して ID を取得
                                  const result = await addToolNameFromProjects(name);
                                  if (result.id) {
                                    setToolVocabOptions((prev) => {
                                      if (prev.some((v) => v.name.toLowerCase() === name.toLowerCase())) return prev;
                                      return [...prev, { id: result.id!, name }];
                                    });
                                  }
                                  const current = new Set(project.tools ?? []);
                                  current.add(name);
                                  updateProject(
                                    project.id,
                                    "tools",
                                    Array.from(current)
                                  );
                                  setNewToolName("");
                                }}
                                className="rounded-[6px] border border-[#424242] px-2 py-1 text-[11px] text-[#9e9e9e] transition-colors hover:border-[#48f4be] hover:text-white"
                              >
                                追加
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <FieldLabel>セクション</FieldLabel>
                      <SectionsEditor
                        key={project.id}
                        value={project.sections}
                        onChange={(v) => updateProject(project.id, "sections", v)}
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleSave(project)}
                        disabled={savingId === project.id}
                        className="rounded-[8px] bg-[#48f4be] px-4 py-1.5 text-[13px] font-semibold text-[#0a0a0a] hover:opacity-80 disabled:opacity-40"
                      >
                        {savingId === project.id ? "保存中…" : "保存"}
                      </button>
                      {savedId === project.id && (
                        <span className="text-[12px] text-[#48f4be]">✓ 保存しました</span>
                      )}
                      {saveError && expandedId === project.id && (
                        <span className="text-[12px] text-[#f4487e]" title={saveError}>
                          保存に失敗しました
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleProofread(project)}
                        disabled={proofCheckingId === project.id}
                        className="rounded-[8px] border border-[#424242] px-3 py-1.5 text-[13px] text-[#9e9e9e] transition-colors hover:border-[#48f4be] hover:text-white disabled:opacity-40"
                      >
                        {proofCheckingId === project.id ? "チェック中…" : "文章をチェック"}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(project.id)}
                      disabled={deletingId === project.id}
                      className="rounded-[8px] px-3 py-1.5 text-[13px] text-[#616161] hover:bg-[#f4487e]/10 hover:text-[#f4487e] disabled:opacity-40"
                    >
                      {deletingId === project.id ? "削除中…" : "削除"}
                    </button>
                  </div>
                  <ProofreadPanel
                    checking={proofCheckingId === project.id}
                    issues={proofResultsMap[project.id]?.issues ?? null}
                    error={proofResultsMap[project.id]?.error ?? ""}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="w-full rounded-[12px] border border-dashed border-[#424242] py-4 text-[14px] text-[#616161] transition-colors hover:border-[#48f4be] hover:text-white"
      >
        ＋ プロジェクトを追加
      </button>
    </section>
  );
}

// ─── Skills セクション ─────────────────────────────────

type SkillRow = {
  id: string;
  user_id: string;
  is_target: boolean;
} & Record<SkillKey, number>;

function SkillsSection({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [current, setCurrent] = useState<SkillRow | null>(null);
  const [target, setTarget] = useState<SkillRow | null>(null);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [dirty, setDirty] = useState(false);

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

  useEffect(() => {
    supabase.from("user_skills").select("*").then(({ data }) => {
      if (data) {
        const c = data.find((r) => r.is_target === false);
        const t = data.find((r) => r.is_target === true);
        if (c) setCurrent(c as unknown as SkillRow);
        if (t) setTarget(t as unknown as SkillRow);
      }
      setFetching(false);
    });
  }, []);

  const updateSkill = (type: "current" | "target", key: SkillKey, val: number) => {
    markDirty();
    if (type === "current") setCurrent((r) => (r ? { ...r, [key]: val } : r));
    else setTarget((r) => (r ? { ...r, [key]: val } : r));
  };

  const handleSave = async () => {
    if (!current || !target) return;
    setLoading(true); setError(""); setSaved(false);
    const rows = [current, target].map((r) => ({
      id: r.id, user_id: r.user_id, is_target: r.is_target,
      updated_at: new Date().toISOString(),
      ...Object.fromEntries(SKILL_KEYS.map((k) => [k, r[k]])),
    }));
    const { error: err } = await saveUserSkills(rows);
    setLoading(false);
    if (err) { setError(err); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    markSaved();
  };

  if (fetching) return <div className="h-64 animate-pulse rounded-[12px] bg-[#1a1a1a]" />;
  if (!current || !target) return <p className="text-[14px] text-[#616161]">スキルデータが見つかりません。</p>;

  return (
    <section id="skills" className="scroll-mt-8">
      <SectionTitle label="Skills" title="スキル" />
      {dirty && (
        <p className="mb-3 text-[11px] text-[#f4c248]">
          未保存の変更があります
        </p>
      )}
      <div className="mb-2 grid grid-cols-2 gap-2 text-center">
        <p className="text-[12px] font-semibold tracking-[0.6px] text-[#9e9e9e]">CURRENT</p>
        <p className="text-[12px] font-semibold tracking-[0.6px] text-[#48f4be]">TARGET</p>
      </div>
      <div className="mb-8 flex flex-col divide-y divide-[#2a2a2a] rounded-[12px] border border-[#424242] bg-[#212121]">
        {SKILL_KEYS.map((key) => (
          <div key={key} className="grid grid-cols-[1fr_120px_1fr] items-center gap-4 px-5 py-3">
            {/* Current */}
            <div className="flex items-center gap-3">
              <input
                type="range" min={0} max={5} step={0.5}
                value={current[key]}
                onChange={(e) => updateSkill("current", key, Number(e.target.value))}
                className="w-full accent-[#9e9e9e]"
              />
              <span className="w-8 text-right font-mono text-[13px] text-white">
                {current[key].toFixed(1)}
              </span>
            </div>
            {/* Label */}
            <p className="text-center text-[12px] text-[#9e9e9e]">{SKILL_LABELS[key]}</p>
            {/* Target */}
            <div className="flex items-center gap-3">
              <span className="w-8 font-mono text-[13px] text-[#48f4be]">
                {target[key].toFixed(1)}
              </span>
              <input
                type="range" min={0} max={5} step={0.5}
                value={target[key]}
                onChange={(e) => updateSkill("target", key, Number(e.target.value))}
                className="w-full accent-[#48f4be]"
              />
            </div>
          </div>
        ))}
      </div>

      <SaveButton onClick={handleSave} loading={loading} saved={saved} error={error} />
    </section>
  );
}

// ─── SkillsExperience セクション ───────────────────────

type CardWithRelations = SkillCard & {
  bars:  SkillExperience[];
  tools: SkillTool[];
};

function SkillsExperienceSection({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [cards, setCards]         = useState<CardWithRelations[]>([]);
  const [fetching, setFetching]   = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId]   = useState<string | null>(null);
  const [savedId, setSavedId]     = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState("");

  const [dirty, setDirty] = useState(false);

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

  useEffect(() => {
    const fetchAll = async () => {
      const [{ data: cardRows }, { data: barRows }, { data: toolRows }] = await Promise.all([
        supabase.from("skill_cards").select("*").order("sort_order", { ascending: true }),
        supabase.from("skill_experience").select("*").order("sort_order",  { ascending: true }),
        supabase.from("skill_tools").select("*").order("sort_order", { ascending: true }),
      ]);
      if (!cardRows) { setFetching(false); return; }

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
        bars:  (barRows  ?? []).filter((b) => b.card_id === c.id),
        tools: (toolRows ?? []).filter((t) => t.card_id === c.id),
      }));
      setCards(merged);
      setFetching(false);
    };

    void fetchAll();
  }, []);

  // ── カード操作 ──────────────────────────────────────
  const updateCard = (id: string, key: keyof SkillCard, val: string | number) => {
    markDirty();
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: val } : c)));
  };

  const handleSaveCard = async (card: CardWithRelations) => {
    setSavingId(card.id); setGlobalError("");
    const { error } = await saveSkillCard({
      id: card.id, title: card.title, title_jp: card.title_jp,
      icon_set: card.icon_set, icon_name: card.icon_name, sort_order: card.sort_order,
    });
    setSavingId(null);
    if (error) { setGlobalError(error); return; }
    setSavedId(card.id);
    setTimeout(() => setSavedId(null), 2000);
    markSaved();
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
    await deleteSkillCard(id);
    setDeletingId(null);
    setCards((prev) => prev.filter((c) => c.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleAddCard = async () => {
    const { data } = await addSkillCard(cards.length);
    if (data) {
      setCards((prev) => [...prev, { ...data, bars: [], tools: [] }]);
      setExpandedId(data.id);
      markDirty();
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
    markDirty();
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

  const handleSaveBar = async (cardId: string, bar: SkillExperience) => {
    const { error } = await saveSkillBar({
      id: bar.id, card_id: cardId, label: bar.label, label_short: bar.label_short,
      segments: bar.segments, level: bar.level,
      description: bar.description, sort_order: bar.sort_order,
    });
    if (error) setGlobalError(error);
  };

  const handleDeleteBar = async (cardId: string, barId: string) => {
    if (
      !window.confirm(
        "このスキルバーを削除します。よろしいですか？\nこの操作は取り消せません。"
      )
    ) {
      return;
    }
    await deleteSkillBar(barId);
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
          c.id !== cardId ? c : { ...c, bars: [...c.bars, data] },
        ),
      );
      markDirty();
    }
  };

  // ── ツール操作 ────────────────────────────────────────
  const updateTool = (
    cardId: string,
    toolId: string,
    key: keyof SkillTool,
    val: string | number,
  ) => {
    markDirty();
    setCards((prev) =>
      prev.map((c) =>
        c.id !== cardId
          ? c
          : {
              ...c,
              tools: c.tools.map((t) => (t.id === toolId ? { ...t, [key]: val } : t)),
            },
      ),
    );
  };

  const handleSaveTool = async (cardId: string, tool: SkillTool) => {
    const { error } = await saveSkillTool({
      id: tool.id, card_id: cardId, name: tool.name,
      years: tool.years, sort_order: tool.sort_order,
    });
    if (error) setGlobalError(error);
  };

  const handleDeleteTool = async (cardId: string, toolId: string) => {
    if (
      !window.confirm(
        "このツールタグを削除します。よろしいですか？\nこの操作は取り消せません。"
      )
    ) {
      return;
    }
    await deleteSkillTool(toolId);
    setCards((prev) => prev.map((c) =>
      c.id !== cardId ? c : { ...c, tools: c.tools.filter((t) => t.id !== toolId) }
    ));
  };

  const handleAddTool = async (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const { data } = await addSkillTool(cardId, card.tools.length);
    if (data) {
      setCards((prev) =>
        prev.map((c) =>
          c.id !== cardId ? c : { ...c, tools: [...c.tools, data] },
        ),
      );
      markDirty();
    }
  };

  if (fetching) return <div className="h-64 animate-pulse rounded-[12px] bg-[#1a1a1a]" />;

  return (
    <section id="skills-experience" className="scroll-mt-8">
      <SectionTitle label="Skills Experience" title="スキルカルーセル" />
      {globalError && <p className="mb-4 text-[13px] text-[#f4487e]">{globalError}</p>}
      {dirty && (
        <p className="mb-3 text-[11px] text-[#f4c248]">
          未保存の変更があります
        </p>
      )}

      <div className="mb-6 flex flex-col gap-4">
        {cards.map((card, idx) => {
          const isOpen = expandedId === card.id;
          return (
            <div key={card.id} className="rounded-[12px] border border-[#424242] bg-[#212121]">
              {/* ヘッダー行 */}
              <div
                className="flex cursor-pointer items-center justify-between px-5 py-4"
                onClick={() => setExpandedId(isOpen ? null : card.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-[#616161]">#{idx + 1}</span>
                  <span className="text-[14px] font-medium text-[#48f4be]">{card.title}</span>
                  <span className="text-[12px] text-[#9e9e9e]">{card.title_jp}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleMoveCard(idx, -1); }}
                    disabled={idx === 0}
                    className="rounded px-2 py-1 text-[12px] text-[#616161] hover:text-white disabled:opacity-30"
                  >↑</button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleMoveCard(idx, 1); }}
                    disabled={idx === cards.length - 1}
                    className="rounded px-2 py-1 text-[12px] text-[#616161] hover:text-white disabled:opacity-30"
                  >↓</button>
                  <span className="text-[12px] text-[#616161]">{isOpen ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* 編集フォーム（展開時） */}
              {isOpen && (
                <div className="border-t border-[#424242] p-5">

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
                    <div>
                      <FieldLabel>アイコンセット</FieldLabel>
                      <Input value={card.icon_set} onChange={(v) => updateCard(card.id, "icon_set", v)} placeholder="Edit" />
                    </div>
                    <div>
                      <FieldLabel>アイコン名</FieldLabel>
                      <Input value={card.icon_name} onChange={(v) => updateCard(card.id, "icon_name", v)} placeholder="writing-fluently" />
                    </div>
                  </div>

                  <div className="mb-6 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleSaveCard(card)}
                      disabled={savingId === card.id}
                      className="rounded-[8px] bg-[#48f4be] px-4 py-1.5 text-[13px] font-semibold text-[#0a0a0a] hover:opacity-80 disabled:opacity-40"
                    >
                      {savingId === card.id ? "保存中…" : "カード情報を保存"}
                    </button>
                    {savedId === card.id && <span className="text-[12px] text-[#48f4be]">✓ 保存しました</span>}
                    <button
                      type="button"
                      onClick={() => handleDeleteCard(card.id)}
                      disabled={deletingId === card.id}
                      className="ml-auto rounded-[8px] px-3 py-1.5 text-[13px] text-[#616161] hover:bg-[#f4487e]/10 hover:text-[#f4487e] disabled:opacity-40"
                    >
                      {deletingId === card.id ? "削除中…" : "カードを削除"}
                    </button>
                  </div>

                  {/* スキルバー */}
                  <div className="mb-6">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[12px] font-semibold tracking-[0.6px] text-[#9e9e9e]">スキルバー</p>
                      <button
                        type="button"
                        onClick={() => handleAddBar(card.id)}
                        className="rounded-[6px] border border-[#424242] px-3 py-1 text-[12px] text-[#9e9e9e] hover:border-[#48f4be] hover:text-white"
                      >
                        ＋ 追加
                      </button>
                    </div>
                    <div className="flex flex-col gap-3">
                      {card.bars.map((bar) => (
                        <div key={bar.id} className="rounded-[8px] border border-[#363636] bg-[#1a1a1a] p-4">
                          <div className="grid grid-cols-[1fr_80px_120px] gap-3 mb-3">
                            <div>
                              <FieldLabel>ラベル</FieldLabel>
                              <Input value={bar.label} onChange={(v) => updateBar(card.id, bar.id, "label", v)} placeholder="UIデザイン" />
                            </div>
                            <div>
                              <FieldLabel>セグメント (1-10)</FieldLabel>
                              <input
                                type="number"
                                min={1}
                                max={10}
                                value={bar.segments}
                                onChange={(e) => updateBar(card.id, bar.id, "segments", Number(e.target.value))}
                                className="w-full rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-3 py-2 text-[14px] text-white outline-none focus:border-[#48f4be]"
                              />
                            </div>
                            <div>
                              <FieldLabel>レベル</FieldLabel>
                              <Input value={bar.level} onChange={(v) => updateBar(card.id, bar.id, "level", v)} placeholder="Lv.3 Senior" />
                            </div>
                          </div>
                          <div className="mb-3">
                            <FieldLabel>説明（任意）</FieldLabel>
                            <Textarea
                              value={bar.description ?? ""}
                              onChange={(v) => updateBar(card.id, bar.id, "description", v || null)}
                              rows={2}
                              placeholder="スキルの詳細説明（展開時に表示）"
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleSaveBar(card.id, bar)}
                              className="rounded-[6px] bg-[#48f4be] px-3 py-1 text-[12px] font-semibold text-[#0a0a0a] hover:opacity-80"
                            >
                              保存
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBar(card.id, bar.id)}
                              className="rounded-[6px] px-2 py-1 text-[12px] text-[#616161] hover:bg-[#f4487e]/10 hover:text-[#f4487e]"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ツールタグ */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[12px] font-semibold tracking-[0.6px] text-[#9e9e9e]">ツールタグ</p>
                      <button
                        type="button"
                        onClick={() => handleAddTool(card.id)}
                        className="rounded-[6px] border border-[#424242] px-3 py-1 text-[12px] text-[#9e9e9e] hover:border-[#48f4be] hover:text-white"
                      >
                        ＋ 追加
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {card.tools.map((tool) => (
                        <div key={tool.id} className="flex items-center gap-3">
                          <div className="flex-1">
                            <Input
                              value={tool.name}
                              onChange={(v) => updateTool(card.id, tool.id, "name", v)}
                              placeholder="Figma"
                            />
                          </div>
                          <div className="w-[120px]">
                            <Input
                              value={tool.years}
                              onChange={(v) => updateTool(card.id, tool.id, "years", v)}
                              placeholder="5年"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSaveTool(card.id, tool)}
                            className="shrink-0 rounded-[6px] bg-[#48f4be] px-3 py-2 text-[12px] font-semibold text-[#0a0a0a] hover:opacity-80"
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTool(card.id, tool.id)}
                            className="shrink-0 rounded-[6px] px-2 py-2 text-[12px] text-[#616161] hover:bg-[#f4487e]/10 hover:text-[#f4487e]"
                          >
                            削除
                          </button>
                        </div>
                      ))}
                    </div>
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
        className="w-full rounded-[12px] border border-dashed border-[#424242] py-4 text-[14px] text-[#616161] transition-colors hover:border-[#48f4be] hover:text-white"
      >
        ＋ カードを追加
      </button>
    </section>
  );
}

// ─── メインレイアウト ───────────────────────────────────

export function AdminLayout() {
  const [activeId, setActiveId] = useState<string>("profile");
  const mainRef = useRef<HTMLDivElement>(null);
  const [dirtySections, setDirtySections] = useState<Record<string, boolean>>({});

  const hasUnsavedChanges = Object.values(dirtySections).some(Boolean);

  const setSectionDirty = (sectionId: string, dirty: boolean) => {
    setDirtySections((prev) => ({
      ...prev,
      [sectionId]: dirty,
    }));
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );
    NAV_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      {/* サイドバー */}
      <aside className="sticky top-0 flex h-screen w-[220px] shrink-0 flex-col border-r border-[#2a2a2a] bg-[#0a0a0a] px-4 py-8">
        <div className="mb-8 px-2">
          <Link
            href="/"
            className="mb-1 block text-[12px] tracking-[0.6px] text-[#48f4be] hover:underline"
            onClick={(e) => {
              if (
                hasUnsavedChanges &&
                !window.confirm("未保存の変更があります。破棄してページを移動しますか？")
              ) {
                e.preventDefault();
              }
            }}
          >
            ← Portfolio
          </Link>
          <p className="text-[20px] font-semibold text-white">Admin</p>
          <p className="text-[11px] text-[#616161]">コンテンツ管理</p>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_SECTIONS.map(({ id, label, labelJa }) => {
            const isActive = activeId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => scrollTo(id)}
                className={[
                  "flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left transition-colors",
                  isActive
                    ? "bg-[rgba(72,244,190,0.08)] text-white"
                    : "text-[#9e9e9e] hover:bg-[#1a1a1a] hover:text-white",
                ].join(" ")}
              >
                {isActive && <span className="h-4 w-[2px] shrink-0 rounded-full bg-[#48f4be]" />}
                <span className={["flex flex-col", isActive ? "" : "pl-[10px]"].join(" ")}>
                  <span className="text-[14px] leading-[1.4]">{label}</span>
                  <span className="text-[11px] text-[#616161]">{labelJa}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Style Guide リンク */}
        <div className="mt-auto">
          <Link
            href="/styleguide"
            className="block rounded-[8px] px-3 py-2 text-[12px] text-[#616161] hover:bg-[#1a1a1a] hover:text-[#9e9e9e]"
            onClick={(e) => {
              if (
                hasUnsavedChanges &&
                !window.confirm("未保存の変更があります。破棄してページを移動しますか？")
              ) {
                e.preventDefault();
              }
            }}
          >
            Style Guide →
          </Link>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main ref={mainRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[800px] px-12 py-12">
          <div className="mb-16">
            <p className="text-[12px] tracking-[0.6px] text-[#48f4be]">Content Management</p>
            <p className="mt-1 font-mplus text-[40px] font-bold tracking-[2px] text-white">Admin</p>
            <p className="mt-3 text-[14px] text-[#9e9e9e]">
              ポートフォリオのコンテンツを編集・管理します。変更は保存ボタンを押すと即時反映されます。
            </p>
          </div>

          <div className="flex flex-col gap-24">
            <ProfileSection onDirtyChange={(dirty) => setSectionDirty("profile", dirty)} />
            <CareerSection onDirtyChange={(dirty) => setSectionDirty("career", dirty)} />
            <ProjectsSection onDirtyChange={(dirty) => setSectionDirty("projects", dirty)} />
            <SkillsSection onDirtyChange={(dirty) => setSectionDirty("skills", dirty)} />
            <SkillsExperienceSection
              onDirtyChange={(dirty) => setSectionDirty("skills-experience", dirty)}
            />
          </div>

          <div className="mt-24 border-t border-[#2a2a2a] pt-8">
            <p className="text-[12px] text-[#424242]">Portfolio Admin</p>
          </div>
        </div>
      </main>
    </div>
  );
}
