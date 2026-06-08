"use client";

import React from "react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Headline from "@/components/Headline";
import MarkdownEditor, { type MarkdownEditorHandle } from "@/components/MarkdownEditor";
import { supabase } from "@/src/lib/supabase";
import {
  saveWork,
  deleteWork,
  addSkillLabelFromWorks,
  addToolNameFromWorks,
  saveSkillCard,
  deleteSkillCard,
  addSkillCard,
  moveSkillCards,
  saveSkillBar,
  deleteSkillBar,
  addSkillBar,
  saveExperienceTools,
  listAllWorkSkillLabels,
  listAllWorkToolNames,
  saveWorkSkillsByLabels,
  saveWorkToolsByNames,
  listStorageImages,
  uploadStorageImage,
} from "@/app/admin/actions";
import type { SkillVocab, ToolVocab, StorageImage } from "@/app/admin/actions";
import type { Tables } from "@/src/types/supabase";
import type { Json } from "@/src/types/supabase";
import { type ProofreadIssue, runProofread } from "@/lib/proofread-client";

// ─── 型 ───────────────────────────────────────────────
type Profile    = Tables<"profile">;
type CareerItem = Tables<"career_items">;
type SkillCard       = Tables<"skill_cards">;
type SkillExperience = Tables<"skill_experience">;

// project_skills / project_tools はDB正規化テーブルで管理するため、
// ローカル状態では skills/tools をフロントエンド専用フィールドとして保持する
type WorkLocal = Tables<"works"> & { skills: string[]; tools: string[] };



// ─── ナビゲーション ────────────────────────────────────
const NAV_SECTIONS = [
  { id: "profile",          label: "Profile",          labelJa: "プロフィール・自己紹介" },
  { id: "career",           label: "Career",           labelJa: "経歴" },
  { id: "works",         label: "Works",            labelJa: "制作・企画" },
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

// Overview 情報カード（DB: works.overview_cards）のローカル編集型
type OverviewCardLocal = { icon: string; heading: string; body: string };

/** Overview 情報カード（Problem / Goal 等）の追加・削除・編集エディタ */
function OverviewCardsEditor({
  value, onChange,
}: { value: OverviewCardLocal[]; onChange: (v: OverviewCardLocal[]) => void }) {
  const cards = Array.isArray(value) ? value : [];
  const update = (i: number, patch: Partial<OverviewCardLocal>) =>
    onChange(cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => onChange(cards.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([...cards, { icon: "Others/thinking-problem", heading: "", body: "" }]);

  return (
    <div className="flex flex-col gap-3">
      {cards.map((card, i) => (
        <div key={i} className="rounded-[8px] border border-[#424242] bg-[#161616] p-3">
          <div className="mb-2 flex items-center gap-2">
            <Input
              value={card.icon}
              onChange={(v) => update(i, { icon: v })}
              placeholder="アイコン（例: Others/thinking-problem）"
              className="flex-1"
            />
            <Input
              value={card.heading}
              onChange={(v) => update(i, { heading: v })}
              placeholder="見出し（例: Problem）"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="shrink-0 rounded-[6px] px-2 py-1 text-[11px] text-[#616161] hover:bg-[#f4487e]/10 hover:text-[#f4487e]"
            >
              削除
            </button>
          </div>
          <Textarea
            value={card.body}
            onChange={(v) => update(i, { body: v })}
            rows={2}
            placeholder="本文"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start rounded-[6px] border border-[#424242] px-3 py-1 text-[11px] text-[#9e9e9e] transition-colors hover:border-[#48f4be] hover:text-white"
      >
        ＋ カードを追加
      </button>
    </div>
  );
}

/** Hero スクリーンショット（複数画像URL）の追加・削除エディタ */
function HeroScreenshotsEditor({
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
          <button
            type="button"
            onClick={() => remove(i)}
            className="shrink-0 rounded-[6px] px-2 py-1 text-[11px] text-[#616161] hover:bg-[#f4487e]/10 hover:text-[#f4487e]"
          >
            削除
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start rounded-[6px] border border-[#424242] px-3 py-1 text-[11px] text-[#9e9e9e] transition-colors hover:border-[#48f4be] hover:text-white"
      >
        ＋ 画像を追加
      </button>
    </div>
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

/**
 * Markdown 本文を全タイポレベルで描画（公開側 `MarkdownBody` と同等のプレビュー）。
 *  `## `→見出し01(24白) / `### `→見出し02(20mint) / `#### `→見出し03(17gray)
 *  `> `→Body02(13) / 通常→Body01(15) / `![](url)`→画像
 */
function SectionBodyRenderer({ body }: { body: string }) {
  const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const renderInline = (text: string, key: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    text.split("\n").forEach((line, li) => {
      if (li > 0) nodes.push(<br key={`br-${key}-${li}`} />);
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
    });
    return nodes;
  };

  const out: React.ReactNode[] = [];
  let para: string[] = [];
  const flush = () => {
    const text = para.join("\n").trim();
    if (text) {
      out.push(
        <p key={`p-${out.length}`} className="mb-4 text-[15px] leading-[1.5] tracking-[0.45px] text-white/90">
          {renderInline(text, `p-${out.length}`)}
        </p>,
      );
    }
    para = [];
  };
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith("##### ")) {
      // Body02（13px 白）: heading level 5 で表現
      flush();
      out.push(
        <p key={`b2-${out.length}`} className="mb-3 text-[13px] leading-[1.5] tracking-[0.39px] text-white/90">
          {renderInline(line.slice(6).trim(), `b2-${out.length}`)}
        </p>,
      );
    } else if (line.startsWith("#### ")) {
      flush();
      out.push(
        <p key={`h-${out.length}`} className="mb-3 text-[17px] font-extrabold leading-normal tracking-[0.85px] text-[#9e9e9e]">
          {line.slice(5).trim()}
        </p>,
      );
    } else if (line.startsWith("### ")) {
      flush();
      out.push(
        <p key={`h-${out.length}`} className="mb-3 text-[20px] font-bold leading-[1.5] tracking-[1px] text-[#b3ffe7]">
          {line.slice(4).trim()}
        </p>,
      );
    } else if (line.startsWith("## ")) {
      flush();
      out.push(
        <p key={`h-${out.length}`} className="mb-4 text-[24px] font-bold leading-[1.5] tracking-[1.2px] text-white">
          {line.slice(3).trim()}
        </p>,
      );
    } else if (line.startsWith("> ")) {
      // blockquote（引用）: テキスト色 system-400(#BDBDBD) ＋ 左ボーダー
      flush();
      out.push(
        <p key={`q-${out.length}`} className="mb-3 border-l-2 border-[#424242] pl-3 text-[13px] leading-[1.5] tracking-[0.39px] text-[#bdbdbd]">
          {renderInline(line.slice(2).trim(), `q-${out.length}`)}
        </p>,
      );
    } else if (line.trim() === "") {
      flush();
    } else if (line.startsWith("# ")) {
      para.push(line.slice(2).trim());
    } else {
      para.push(line);
    }
  }
  flush();
  return <div>{out}</div>;
}

// ブロック型セクション（{heading, blocks:[{type:'text',md}|{type:'image',url,caption}]}）も
// markdown へ可逆的に直列化する。旧 {heading, body} 形式も透過。
// ※ 画像の size/scale/align は markdown では表現できないため、編集時は `![](url)` に正規化される。
function blocksToMarkdown(blocks: unknown[]): string {
  return blocks
    .map((b) => {
      const blk = (b ?? {}) as Record<string, unknown>;
      if (blk.type === "image" && typeof blk.url === "string") {
        return `![${typeof blk.caption === "string" ? blk.caption : ""}](${blk.url})`;
      }
      if (typeof blk.md === "string") return blk.md;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function sectionsToMarkdown(sections: unknown[]): string {
  return sections
    .map((raw) => {
      const s = (raw ?? {}) as Record<string, unknown>;
      const heading = typeof s.heading === "string" ? s.heading : "";
      const body = Array.isArray(s.blocks)
        ? blocksToMarkdown(s.blocks as unknown[])
        : typeof s.body === "string"
          ? s.body
          : "";
      return `# ${heading}\n\n${body}`;
    })
    .join("\n\n");
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
    sectionsToMarkdown((value ?? []) as unknown[])
  );
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const [imgModalOpen, setImgModalOpen] = useState(false);

  const handleChange = (md: string) => {
    setMarkdown(md);
    onChange(markdownToSections(md) as unknown as Json);
  };

  const preview = markdownToSections(markdown);

  return (
    <>
      <ImagePickerModal
        open={imgModalOpen}
        onClose={() => setImgModalOpen(false)}
        onSelect={(url, alt) => { editorRef.current?.insertImage(url, alt); setImgModalOpen(false); }}
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
            {t === "edit" ? "エディタ" : "プレビュー"}
          </button>
        ))}
        <p className="ml-auto px-4 text-[11px] text-[#3a3a3a]">
          # でセクション分割 / ## 見出し01 / ### 見出し02 / #### 見出し03 / ＞ 小本文
        </p>
      </div>

      {/* 編集エリア（Tiptap WYSIWYG） */}
      {tab === "edit" && (
        <MarkdownEditor
          ref={editorRef}
          value={markdown}
          onChange={handleChange}
          onRequestImage={() => setImgModalOpen(true)}
          placeholder={`# プロジェクト概要\n\n本文テキストをここに入力します。\n\n## 小見出し\n\n補足テキスト。`}
        />
      )}

      {/* プレビューエリア（WorkModalContent のスタイルに合わせる） */}
      {tab === "preview" && (
        <div className="min-h-[160px] bg-[#1a1a1a] px-6 py-6">
          {preview.length === 0 ? (
            <p className="text-[13px] text-[#424242]">セクションがありません</p>
          ) : (
            <div className="flex flex-col gap-8">
              {preview.map((sec, i) => (
                <div key={i} className="flex flex-col gap-6">
                  <Headline title={sec.heading} variant="section" />
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

function WorksSection({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [projects, setProjects] = useState<WorkLocal[]>([]);
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
  // 紐付け用の経歴一覧（career_item_id の選択肢）
  const [careerOptions, setCareerOptions] = useState<
    Pick<CareerItem, "id" | "role" | "company" | "period">[]
  >([]);
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

  const handleProofread = async (project: WorkLocal) => {
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
      { data: careerRows },
    ] = await Promise.all([
      supabase
        .from("works")
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
      listAllWorkSkillLabels(),
      listAllWorkToolNames(),
      // 紐付け用の経歴一覧
      supabase
        .from("career_items")
        .select("id, role, company, period")
        .order("sort_order", { ascending: true }),
    ]);

    if (projectRows) {
      const withLocal: WorkLocal[] = projectRows.map((p) => ({
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
    setCareerOptions(careerRows ?? []);
    setFetching(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const updateProject = (id: string, key: keyof WorkLocal, val: unknown) => {
    markDirty();
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, [key]: val } : p)));
  };

  const handleSave = async (project: WorkLocal) => {
    setSaveError(null);
    setSavingId(project.id);

    // WorkLocal の skills/tools フィールドは DB カラムではないため除いて渡す
    const { skills, tools, ...rest } = project;
    const periodInputs =
      projectPeriodInputs[project.id] ?? parseProjectPeriod(project.period);
    const formattedPeriod = formatProjectPeriod(periodInputs);
    const projectRow = {
      ...rest,
      period: formattedPeriod,
    };
    const [{ error }, skillsResult, toolsResult] = await Promise.all([
      saveWork(projectRow, {}),
      saveWorkSkillsByLabels(project.id, skills),
      saveWorkToolsByNames(project.id, tools),
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
    const { error } = await deleteWork(id);
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

    const newProject: WorkLocal = {
      id,
      title: "新しいプロジェクト",
      category: null,
      thumbnail_url: null,
      role: null,
      period: null,
      overview: null,
      overview_cards: [
        { icon: "Others/thinking-problem", heading: "Problem", body: "" },
        { icon: "Travels/flag", heading: "Goal", body: "" },
      ],
      hero_screenshots: [],
      hero_bg_color: null,
      career_item_id: null,
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
    <section id="works" className="scroll-mt-8">
      <SectionTitle label="Works" title="制作・企画" />
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
                      <FieldLabel>担当経歴（Career）</FieldLabel>
                      <select
                        value={project.career_item_id ?? ""}
                        onChange={(e) =>
                          updateProject(
                            project.id,
                            "career_item_id",
                            e.target.value || null,
                          )
                        }
                        className="w-full rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-3 py-2 text-[14px] text-white outline-none transition-colors focus:border-[#48f4be]"
                      >
                        <option value="">（紐付けなし）</option>
                        {careerOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.role}｜{c.company}（{c.period}）
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-[#757575]">
                        この制作・企画を担当した経歴。Career カードの Works リンクに表示されます。
                      </p>
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
                      <FieldLabel>Overview（リード本文）</FieldLabel>
                      <Textarea
                        value={project.overview ?? ""}
                        onChange={(v) => updateProject(project.id, "overview", v || null)}
                        rows={4}
                        placeholder="このプロジェクトの概要…"
                      />
                    </div>

                    {/* Overview 情報カード（Problem / Goal 等。2カラムグリッドで表示・増減/非表示可） */}
                    <div className="col-span-2">
                      <FieldLabel>Overview 情報カード（アイコン付き見出し）</FieldLabel>
                      <OverviewCardsEditor
                        value={(project.overview_cards ?? []) as OverviewCardLocal[]}
                        onChange={(v) => updateProject(project.id, "overview_cards", v as unknown as Json)}
                      />
                    </div>

                    <div>
                      <FieldLabel>Hero 背景色（空欄でデフォルト緑）</FieldLabel>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={project.hero_bg_color ?? "#48f4be"}
                          onChange={(e) => updateProject(project.id, "hero_bg_color", e.target.value)}
                          className="h-9 w-12 shrink-0 rounded-[6px] border border-[#424242] bg-[#1a1a1a]"
                        />
                        <Input
                          value={project.hero_bg_color ?? ""}
                          onChange={(v) => updateProject(project.id, "hero_bg_color", v || null)}
                          placeholder="#48f4be"
                        />
                      </div>
                    </div>

                    <div className="col-span-2">
                      <FieldLabel>Hero スクリーンショット（デバイスモックアップ）</FieldLabel>
                      <HeroScreenshotsEditor
                        value={(project.hero_screenshots ?? []) as string[]}
                        onChange={(v) => updateProject(project.id, "hero_screenshots", v as unknown as Json)}
                      />
                    </div>

                    <div className="col-span-2">
                      <FieldLabel>サムネイル（一覧カード用）</FieldLabel>
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
                                  const result = await addSkillLabelFromWorks(name);
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
                                  const result = await addToolNameFromWorks(name);
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

// ─── SkillsExperience セクション ───────────────────────

// スキル行（skill_experience）に紐づくツール（skill_experience_tools → tools_vocab）。
// key はローカル編集用の安定キー（既存は tool_id、新規は randomUUID）。
type BarTool = {
  key: string;
  tool_id: string | null;
  name: string;
  slug: string;
  category: string;
};
type BarWithTools = SkillExperience & { tools: BarTool[] };
type CardWithRelations = SkillCard & {
  bars: BarWithTools[];
};

type ExperienceToolLink = {
  experience_id: string;
  sort_order: number;
  tools_vocab: { id: string; name: string; slug: string | null; category: string | null } | null;
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
      const [{ data: cardRows }, { data: barRows }, { data: linkRows }] = await Promise.all([
        supabase.from("skill_cards").select("*").order("sort_order", { ascending: true }),
        supabase.from("skill_experience").select("*").order("sort_order",  { ascending: true }),
        supabase
          .from("skill_experience_tools")
          .select("experience_id, sort_order, tools_vocab(id, name, slug, category)")
          .order("sort_order", { ascending: true }),
      ]);
      if (!cardRows) { setFetching(false); return; }

      // skill_experience_tools → スキル行 ID ごとのツール配列に整形
      const toolsByExp = new Map<string, BarTool[]>();
      for (const link of (linkRows ?? []) as unknown as ExperienceToolLink[]) {
        const tv = link.tools_vocab;
        if (!tv) continue;
        const arr = toolsByExp.get(link.experience_id) ?? [];
        arr.push({ key: tv.id, tool_id: tv.id, name: tv.name, slug: tv.slug ?? "", category: tv.category ?? "" });
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

  const handleSaveBar = async (cardId: string, bar: BarWithTools) => {
    // アイコンは「セット」「名前」を両方入力するか両方空（＝Base/system フォールバック）に。
    // 片方だけだと公開側で存在しないパス（例 Edit/system.svg）を読み壊れるため弾く。
    const hasSet = !!bar.icon_set?.trim();
    const hasName = !!bar.icon_name?.trim();
    if (hasSet !== hasName) {
      setGlobalError("アイコンは「セット」と「名前」を両方入力するか、両方空にしてください。");
      return;
    }
    setGlobalError("");
    const { error } = await saveSkillBar({
      id: bar.id, card_id: cardId, label: bar.label, label_short: bar.label_short,
      segments: bar.segments, level: bar.level,
      description: bar.description, sort_order: bar.sort_order,
      icon_set: bar.icon_set, icon_name: bar.icon_name, label_note: bar.label_note,
    });
    if (error) { setGlobalError(error); return; }
    // スキル行のツール（skill_experience_tools）も同時に保存
    const toolsRes = await saveExperienceTools(
      bar.id,
      bar.tools.map((t) => ({
        name: t.name,
        slug: t.slug.trim() || null,
        category: t.category.trim() || null,
      })),
    );
    if (toolsRes.error) setGlobalError(toolsRes.error);
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
          c.id !== cardId ? c : { ...c, bars: [...c.bars, { ...data, tools: [] }] },
        ),
      );
      markDirty();
    }
  };

  // ── スキル行ツール操作（skill_experience_tools）─────────
  const updateBarField = (
    cardId: string,
    barId: string,
    update: (bar: BarWithTools) => BarWithTools,
  ) => {
    markDirty();
    setCards((prev) =>
      prev.map((c) =>
        c.id !== cardId
          ? c
          : { ...c, bars: c.bars.map((b) => (b.id === barId ? update(b) : b)) },
      ),
    );
  };

  const addBarTool = (cardId: string, barId: string) => {
    updateBarField(cardId, barId, (b) => ({
      ...b,
      tools: [
        ...b.tools,
        { key: crypto.randomUUID(), tool_id: null, name: "", slug: "", category: "" },
      ],
    }));
  };

  const updateBarTool = (
    cardId: string,
    barId: string,
    toolKey: string,
    field: "name" | "slug" | "category",
    val: string,
  ) => {
    updateBarField(cardId, barId, (b) => ({
      ...b,
      tools: b.tools.map((t) => (t.key === toolKey ? { ...t, [field]: val } : t)),
    }));
  };

  const removeBarTool = (cardId: string, barId: string, toolKey: string) => {
    updateBarField(cardId, barId, (b) => ({
      ...b,
      tools: b.tools.filter((t) => t.key !== toolKey),
    }));
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
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div>
                              <FieldLabel>アイコンセット</FieldLabel>
                              <Input value={bar.icon_set ?? ""} onChange={(v) => updateBar(card.id, bar.id, "icon_set", v || null)} placeholder="Edit" />
                            </div>
                            <div>
                              <FieldLabel>アイコン名</FieldLabel>
                              <Input value={bar.icon_name ?? ""} onChange={(v) => updateBar(card.id, bar.id, "icon_name", v || null)} placeholder="writing-fluently" />
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
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-[11px] font-semibold tracking-[0.5px] text-[#9e9e9e]">ツール（行単位）</p>
                              <button
                                type="button"
                                onClick={() => addBarTool(card.id, bar.id)}
                                className="rounded-[6px] border border-[#424242] px-2.5 py-0.5 text-[11px] text-[#9e9e9e] hover:border-[#48f4be] hover:text-white"
                              >
                                ＋ ツール
                              </button>
                            </div>
                            {bar.tools.length === 0 && (
                              <p className="text-[11px] text-[#616161]">ツール未設定</p>
                            )}
                            <div className="flex flex-col gap-2">
                              {bar.tools.map((tool) => (
                                <div key={tool.key} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                                  <Input value={tool.name} onChange={(v) => updateBarTool(card.id, bar.id, tool.key, "name", v)} placeholder="Figma" />
                                  <Input value={tool.slug} onChange={(v) => updateBarTool(card.id, bar.id, tool.key, "slug", v)} placeholder="slug（例: figma）" />
                                  <Input value={tool.category} onChange={(v) => updateBarTool(card.id, bar.id, tool.key, "category", v)} placeholder="カテゴリー（フォールバック）" />
                                  <button
                                    type="button"
                                    onClick={() => removeBarTool(card.id, bar.id, tool.key)}
                                    className="shrink-0 rounded-[6px] px-2 py-2 text-[12px] text-[#616161] hover:bg-[#f4487e]/10 hover:text-[#f4487e]"
                                    aria-label="ツールを削除"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                            <p className="mt-2 text-[10px] leading-[1.5] text-[#616161]">
                              slug が public/logos/&lt;slug&gt;.svg と一致するとロゴ表示。無ければカテゴリーアイコンにフォールバック。保存は下の「保存」ボタンでスキル行とまとめて行われます。
                            </p>
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
            <WorksSection onDirtyChange={(dirty) => setSectionDirty("works", dirty)} />
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
