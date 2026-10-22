"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AdminShell,
  FieldLabel,
  FormGroupHeader,
  HeroScreenshotsEditor,
  FlowchartPickerModal,
  ImagePickerField,
  ImagePickerModal,
  Input,
  MoveButtons,
  moveItem,
} from "../../AdminLayout";
import RichMarkdownEditor, { UPLOAD_PLACEHOLDER } from "@/components/RichMarkdownEditor";
import { compressImage } from "@/lib/compress-image";
import {
  parseTimeline,
  parseStakeholders,
  type TimelineData,
} from "@/components/WorkViz";
import { sectionsToMarkdown, markdownToSections } from "@/lib/work-sections";
import {
  saveWork,
  deleteWork,
  addToolNameFromWorks,
  addSkillLabelFromWorks,
  setWorkPublished,
  uploadStorageImage,
} from "@/app/admin/actions";
import PublishToggle from "@/app/admin/PublishToggle";
import WorkCategoryField from "./WorkCategoryField";
import NumberField from "./NumberField";
import TimelineGanttEditor from "./TimelineGanttEditor";
import StakeholdersDiagramEditor from "./StakeholdersDiagramEditor";
import WorkVizModal from "@/components/WorkVizModal";
import type { IconCatalog } from "@/app/admin/iconCatalogTypes";
import Tag from "@/components/Tag";
import { parseStakeholderBreakdown } from "@/components/WorkDetailHeader";
import { supabase } from "@/src/lib/supabase";
import ProtectedImage from "@/components/ProtectedImage";
import type { Json, Tables } from "@/src/types/supabase";

type Work = Tables<"works">;

/**
 * Work 1件の全画面エディタ（/admin/works/edit?id=xxx、id 省略 or "new" で新規作成）。
 * 「本文」タブ = メインエリア全体のリッチ Markdown エディタ、「設定」タブ = メタ情報フォーム。
 */

function emptyWork(id: string): Work {
  return {
    id,
    is_published: true,
    title: "新しいプロジェクト",
    category: null,
    thumbnail_url: null,
    role: null,
    period: null,
    timeline: null,
    stakeholders: null,
    hero_brand: null,
    hero_screenshots: [] as unknown as Json,
    hero_bg_color: null,
    sections: [] as unknown as Json,
    stakeholder_breakdown: null,
    career_item_id: null,
    sort_order: 0,
    created_at: null,
  };
}

/**
 * 新規作成時に本文へ既定で入る Overview テンプレート。
 * Overview は専用設定ではなく本文 markdown で管理する
 * （見出しは 見出し02=###、2カラムは ::: grid 指定）。
 */
const DEFAULT_BODY_MD = `# Overview

プロジェクトの概要を入力します。

::: grid cols=2 gap=10
### Problem
解決したい課題を入力します。
---
### Goal
目指すゴールを入力します。
:::
`;

type PeriodInputs = { startYear: string; startMonth: string; endYear: string; endMonth: string; isCurrent: boolean };

function parsePeriod(period: string | null): PeriodInputs {
  const m = (period ?? "").match(/^(\d{4})年(\d{1,2})月\s*-\s*(現在|(\d{4})年(\d{1,2})月)?$/);
  if (!m) return { startYear: "", startMonth: "", endYear: "", endMonth: "", isCurrent: false };
  return {
    startYear: m[1] ?? "",
    startMonth: m[2] ?? "",
    endYear: m[4] ?? "",
    endMonth: m[5] ?? "",
    isCurrent: m[3] === "現在",
  };
}

function formatPeriod(p: PeriodInputs): string | null {
  const sy = p.startYear.trim();
  const sm = p.startMonth.trim();
  if (!sy || !sm) return null;
  const start = `${sy}年${sm}月`;
  const end = p.isCurrent ? "現在" : p.endYear.trim() && p.endMonth.trim() ? `${p.endYear.trim()}年${p.endMonth.trim()}月` : "";
  return end ? `${start} - ${end}` : `${start} - `;
}

function toHalfWidthDigits(v: string): string {
  return v.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

function normalizePeriod(p: PeriodInputs): PeriodInputs {
  return {
    ...p,
    startYear: toHalfWidthDigits(p.startYear.trim()),
    startMonth: toHalfWidthDigits(p.startMonth.trim()),
    endYear: toHalfWidthDigits(p.endYear.trim()),
    endMonth: toHalfWidthDigits(p.endMonth.trim()),
  };
}

function validatePeriod(p: PeriodInputs): string | null {
  const inRange = (v: string, min: number, max: number) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max;
  const fields: { label: string; year: string; month: string }[] = [{ label: "開始", year: p.startYear, month: p.startMonth }];
  if (!p.isCurrent) fields.push({ label: "終了", year: p.endYear, month: p.endMonth });
  for (const f of fields) {
    if (f.year && !inRange(f.year, 1900, 2100)) return `${f.label}年は 1900〜2100 の西暦で入力してください`;
    if (f.month && !inRange(f.month, 1, 12)) return `${f.label}月は 1〜12 で入力してください`;
    if (f.month && !f.year) return `${f.label}月を入力する場合は${f.label}年も入力してください`;
    if (f.year && !f.month) return `${f.label}年を入力する場合は${f.label}月も入力してください`;
  }
  return null;
}

type CareerOption = Pick<Tables<"career_items">, "id" | "role" | "company" | "period">;
type ToolOption = { id: string; name: string; icon_url: string | null };

export default function WorkEditor({ workId, iconCatalog }: { workId: string; iconCatalog: IconCatalog }) {
  const router = useRouter();
  const isNew = workId === "new";
  const id = useMemo(() => (isNew ? crypto.randomUUID() : workId), [isNew, workId]);

  const [work, setWork] = useState<Work | null>(isNew ? emptyWork(id) : null);
  const [markdown, setMarkdown] = useState(isNew ? DEFAULT_BODY_MD : "");
  const [vizPreview, setVizPreview] = useState<"timeline" | "stakeholders" | null>(null);
  const [period, setPeriod] = useState<PeriodInputs>(parsePeriod(null));
  const [skills, setSkills] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [skillOptions, setSkillOptions] = useState<string[]>([]);
  const [newSkillLabel, setNewSkillLabel] = useState("");
  const [addingSkill, setAddingSkill] = useState(false);
  const [toolOptions, setToolOptions] = useState<ToolOption[]>([]);
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [newToolName, setNewToolName] = useState("");
  const [careerOptions, setCareerOptions] = useState<CareerOption[]>([]);
  const [tab, setTab] = useState<"content" | "settings">("content");
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishPending, setPublishPending] = useState(false);

  // 画像ピッカー（RichMarkdownEditor からは Promise で URL を受け取る）
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerResolve = useRef<((v: { url: string; alt?: string } | null) => void) | null>(null);
  const pickImage = () =>
    new Promise<{ url: string; alt?: string } | null>((resolve) => {
      pickerResolve.current = resolve;
      setPickerOpen(true);
    });
  const closePicker = (result: { url: string; alt?: string } | null) => {
    pickerResolve.current?.(result);
    pickerResolve.current = null;
    setPickerOpen(false);
  };

  // フローチャートピッカー（RichMarkdownEditor から Promise で選択結果を受け取る）
  const [flowchartPickerOpen, setFlowchartPickerOpen] = useState(false);
  const flowchartResolve = useRef<
    ((v: { id: string; title: string } | null) => void) | null
  >(null);
  const pickFlowchart = () =>
    new Promise<{ id: string; title: string } | null>((resolve) => {
      flowchartResolve.current = resolve;
      setFlowchartPickerOpen(true);
    });
  const closeFlowchartPicker = (
    result: { id: string; title: string } | null,
  ) => {
    flowchartResolve.current?.(result);
    flowchartResolve.current = null;
    setFlowchartPickerOpen(false);
  };

  useEffect(() => {
    const fetchAll = async () => {
      const [workRes, skillsRes, toolsRes, careerRes, skillVocabRes, toolVocabRes, breakdownRes] = await Promise.all([
        isNew
          ? Promise.resolve({ data: null })
          : supabase.from("works").select("*").eq("id", workId).maybeSingle(),
        isNew
          ? Promise.resolve({ data: [] })
          : supabase.from("work_skills").select("sort_order, skills_vocab(label)").eq("work_id", workId).order("sort_order"),
        isNew
          ? Promise.resolve({ data: [] })
          : supabase.from("work_tools").select("sort_order, tools_vocab(name)").eq("work_id", workId).order("sort_order"),
        supabase.from("career_items").select("id, role, company, period").order("sort_order"),
        // Work タグ用のスキル語彙は専用マスタ skills_vocab を単一ソースとする
        // （スキルセクションの skill_experience とは疎結合）
        supabase.from("skills_vocab").select("label").order("label"),
        supabase.from("tools_vocab").select("id, name, icon_url").order("name"),
        supabase.from("works").select("stakeholder_breakdown"),
      ]);

      const failure = [
        "error" in workRes ? workRes.error : null,
        "error" in skillsRes ? skillsRes.error : null,
        "error" in toolsRes ? toolsRes.error : null,
        careerRes.error,
        skillVocabRes.error,
        toolVocabRes.error,
      ].find((error) => error);
      if (failure) {
        setLoadError(failure.message);
        return;
      }

      if (!isNew) {
        const row = (workRes.data as Work | null) ?? null;
        if (!row) {
          setMissing(true);
          return;
        }
        setWork(row);
        setMarkdown(sectionsToMarkdown(row.sections));
        setPeriod(parsePeriod(row.period));
        setSkills(
          ((skillsRes.data ?? []) as unknown as { skills_vocab: { label: string } | null }[])
            .map((r) => r.skills_vocab?.label)
            .filter((v): v is string => Boolean(v))
        );
        setTools(
          ((toolsRes.data ?? []) as unknown as { tools_vocab: { name: string } | null }[])
            .map((r) => r.tools_vocab?.name)
            .filter((v): v is string => Boolean(v))
        );
      }
      setCareerOptions((careerRes.data ?? []) as CareerOption[]);
      setSkillOptions(
        ((skillVocabRes.data ?? []) as { label: string }[]).map((r) => r.label)
      );
      setToolOptions(
        ((toolVocabRes.data ?? []) as { id: string; name: string; icon_url: string | null }[]).map(
          (r) => ({ id: r.id, name: r.name, icon_url: r.icon_url })
        )
      );
      const roleSet = new Set<string>();
      for (const r of (breakdownRes.data ?? []) as { stakeholder_breakdown: string | null }[])
        for (const s of parseStakeholderBreakdown(r.stakeholder_breakdown) ?? []) roleSet.add(s.name);
      setRoleOptions([...roleSet].sort((a, b) => a.localeCompare(b, "ja")));
    };
    fetchAll().catch((error: unknown) => {
      setLoadError(error instanceof Error ? error.message : "作品を読み込めませんでした");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workId]);

  const setField = <K extends keyof Work>(key: K, val: Work[K]) => {
    setWork((prev) => (prev ? { ...prev, [key]: val } : prev));
    setDirty(true);
  };
  const markDirty = () => setDirty(true);

  // jsonb のパースは work の該当カラムが変わったときだけ（毎レンダー・毎キーストロークの再パースを防ぐ）
  const parsedTimeline = useMemo(() => parseTimeline(work?.timeline), [work?.timeline]);
  const parsedStakeholders = useMemo(() => parseStakeholders(work?.stakeholders), [work?.stakeholders]);

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.some((s) => s.toLowerCase() === value.toLowerCase())
      ? list.filter((s) => s.toLowerCase() !== value.toLowerCase())
      : [...list, value]);
    markDirty();
  };

  const handleAddSkill = async () => {
    const label = newSkillLabel.trim();
    if (!label || addingSkill) return;
    setAddingSkill(true);
    try {
      let chosen = skillOptions.find((s) => s.toLowerCase() === label.toLowerCase());
      if (!chosen) {
        const res = await addSkillLabelFromWorks(label);
        if (res.error || !res.id) {
          setSaveError(res.error ?? "スキルの追加に失敗しました");
          return;
        }
        chosen = label;
        setSkillOptions((prev) =>
          prev.some((s) => s.toLowerCase() === label.toLowerCase())
            ? prev
            : [...prev, label].sort((a, b) => a.localeCompare(b))
        );
      }
      const c = chosen;
      if (!skills.some((s) => s.toLowerCase() === c.toLowerCase())) {
        setSkills((prev) => [...prev, c]);
        markDirty();
      }
      setNewSkillLabel("");
    } finally {
      setAddingSkill(false);
    }
  };

  // 公開状態は本文の保存とは独立に即時反映する。
  // 未保存の新規作品はまだ DB に行が無いので、フォームの値として「保存」時に一緒に送る。
  const handleTogglePublished = async (next: boolean) => {
    if (isNew) {
      setField("is_published", next);
      return;
    }
    if (!work || saving) return;
    const prev = work.is_published;
    setWork((p) => (p ? { ...p, is_published: next } : p));
    setPublishPending(true);
    setSaveError(null);
    const { error } = await setWorkPublished(id, next);
    if (error) {
      setWork((p) => (p ? { ...p, is_published: prev } : p));
      setSaveError(error);
    }
    setPublishPending(false);
  };

  const handleSave = async () => {
    if (!work) return;
    const normalized = normalizePeriod(period);
    const periodError = validatePeriod(normalized);
    if (periodError) {
      setSaveError(periodError);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const payload: Work = {
      ...work,
      id,
      period: formatPeriod(normalized),
      // 画像アップロード中の仮の行が万一残っていても DB には入れない
      sections: markdownToSections(
        markdown
          .split("\n")
          .filter((l) => l.trim() !== UPLOAD_PLACEHOLDER)
          .join("\n")
      ),
    };
    const saveRes = await saveWork(payload, skills, tools);
    if (saveRes.error) {
      setSaving(false);
      setSaveError(saveRes.error);
      return;
    }
    setSaving(false);
    setPeriod(normalized);
    setDirty(false);
    setSavedAt(true);
    setTimeout(() => setSavedAt(false), 2000);
    if (isNew) router.replace(`/admin/works/edit?id=${id}`);
  };

  const handleDelete = async () => {
    if (!window.confirm("このプロジェクトを削除します。よろしいですか？\nこの操作は取り消せません。")) return;
    if (!isNew) {
      const { error } = await deleteWork(id);
      if (error) {
        setSaveError(error);
        return;
      }
    }
    router.push("/admin/works");
  };

  if (loadError) {
    return (
      <AdminShell section="works">
        <p className="text-[14px] text-danger-300" role="alert">作品を読み込めませんでした: {loadError}</p>
        <Link href="/admin/works" className="mt-4 inline-block text-[13px] text-primary hover:underline">
          ← Works 一覧へ戻る
        </Link>
      </AdminShell>
    );
  }

  if (missing) {
    return (
      <AdminShell section="works">
        <p className="text-[14px] text-fg-muted">プロジェクトが見つかりませんでした。</p>
        <Link href="/admin/works" className="mt-4 inline-block text-[13px] text-primary hover:underline">
          ← Works 一覧へ戻る
        </Link>
      </AdminShell>
    );
  }

  if (!work) {
    return (
      <AdminShell section="works" wide>
        <div className="h-64 animate-pulse rounded-[12px] bg-[#1a1a1a]" />
      </AdminShell>
    );
  }

  const tabBtn = (key: "content" | "settings", label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`rounded-[8px] px-3 py-1.5 text-[13px] transition-colors ${
        tab === key ? "bg-primary/10 text-primary" : "text-fg-muted hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <AdminShell section="works" wide hasUnsavedChanges={dirty}>
      {/* ヘッダー（戻る / タイトル / 保存・削除） */}
      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
        <Link
          href="/admin/works"
          className="shrink-0 text-[12px] tracking-[0.6px] text-primary hover:underline"
          onClick={(e) => {
            if (dirty && !window.confirm("未保存の変更があります。破棄して一覧へ戻りますか？")) e.preventDefault();
          }}
        >
          ← Works
        </Link>
        <input
          value={work.title}
          onChange={(e) => setField("title", e.target.value)}
          placeholder="プロジェクトタイトル"
          className="min-w-0 flex-1 rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-[20px] font-semibold text-white outline-none transition-colors hover:border-border-light focus:border-primary"
        />
        <PublishToggle
          checked={work.is_published}
          disabled={saving || publishPending}
          onChange={handleTogglePublished}
          title={isNew ? "新規作品は「保存」を押すと公開状態も保存されます" : "オフにすると公開サイトの一覧・詳細・経歴リンクに出ません（すぐに反映されます）"}
        />
        <span className="h-5 w-px shrink-0 bg-border-light" aria-hidden />
        {dirty && <span className="shrink-0 text-[11px] text-[#f4c248]">未保存の変更があります</span>}
        {savedAt && <span className="shrink-0 text-[12px] text-primary">✓ 保存しました</span>}
        {saveError && (
          <span className="shrink-0 text-[12px] text-danger-300" title={saveError}>
            保存に失敗しました
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || publishPending}
          className="shrink-0 rounded-[8px] bg-primary px-4 py-1.5 text-[13px] font-semibold text-[#0a0a0a] hover:opacity-80 disabled:opacity-40"
        >
          {saving ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="shrink-0 rounded-[8px] px-3 py-1.5 text-[13px] text-system-700 hover:bg-danger-300/10 hover:text-danger-300"
        >
          削除
        </button>
      </div>

      {/* タブ */}
      <div className="mb-4 flex shrink-0 items-center gap-1 rounded-[10px] border border-[#2a2a2a] bg-[#141414] p-1 self-start">
        {tabBtn("content", "本文")}
        {tabBtn("settings", "設定")}
      </div>

      {/* 本文タブ: メインエリア全体をエディタとして使用 */}
      {tab === "content" && (
        <>
          {/^:::\s*(timeline|stakeholders)\b/m.test(markdown) && (
            <p className="mb-2 shrink-0 text-[11px] text-fg-muted">本文に「::: timeline」「::: stakeholders」の行があります。この行は現在は表示に使われません（Timeline / Stakeholders は「設定」タブで編集）。</p>
          )}
          <RichMarkdownEditor
            value={markdown}
            onChange={(md) => {
              setMarkdown(md);
              markDirty();
            }}
            onPickImage={pickImage}
            onPickFlowchart={pickFlowchart}
            onUploadImage={async (file) => {
              const fd = new FormData();
              fd.append("file", await compressImage(file));
              const { url, error } = await uploadStorageImage(fd, "projects/sections");
              return { url, error };
            }}
            className="min-h-0 flex-1"
          />
        </>
      )}

      {/* 設定タブ */}
      {tab === "settings" && (
        <div className="min-h-0 flex-1 overflow-y-auto pb-12">
          <div className="grid max-w-main grid-cols-2 gap-4">
            <div>
              <FieldLabel>カテゴリ</FieldLabel>
              <WorkCategoryField value={work.category} onChange={(v) => setField("category", v)} dirty={dirty} />
            </div>
            <div className="col-span-2">
              <FieldLabel>担当役割</FieldLabel>
              <Input value={work.role ?? ""} onChange={(v) => setField("role", v || null)} placeholder="UI/UX Designer" />
            </div>
            <div className="col-span-2">
              <FieldLabel>担当経歴（Career）</FieldLabel>
              <select
                value={work.career_item_id ?? ""}
                onChange={(e) => setField("career_item_id", e.target.value || null)}
                className="w-full rounded-[8px] border border-border-light bg-[#1a1a1a] px-3 py-2 text-[14px] text-white outline-none transition-colors focus:border-primary"
              >
                <option value="">（紐付けなし）</option>
                {careerOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.role}｜{c.company}（{c.period}）
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <FieldLabel>期間</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="number" min={1900} max={2100} className="!w-24" value={period.startYear} onChange={(v) => { setPeriod((p) => ({ ...p, startYear: v })); markDirty(); }} placeholder="2023" />
                <span className="text-[12px] text-fg-muted">年</span>
                <Input type="number" min={1} max={12} className="!w-16" value={period.startMonth} onChange={(v) => { setPeriod((p) => ({ ...p, startMonth: v })); markDirty(); }} placeholder="4" />
                <span className="text-[12px] text-fg-muted">月 〜</span>
                <Input type="number" min={1900} max={2100} className="!w-24" value={period.isCurrent ? "" : period.endYear} onChange={(v) => { setPeriod((p) => ({ ...p, endYear: v })); markDirty(); }} placeholder="2024" disabled={period.isCurrent} />
                <span className="text-[12px] text-fg-muted">年</span>
                <Input type="number" min={1} max={12} className="!w-16" value={period.isCurrent ? "" : period.endMonth} onChange={(v) => { setPeriod((p) => ({ ...p, endMonth: v })); markDirty(); }} placeholder="3" disabled={period.isCurrent} />
                <span className="text-[12px] text-fg-muted">月</span>
                <label className="ml-2 inline-flex items-center gap-2 text-[12px] text-fg-muted">
                  <input
                    type="checkbox"
                    className="h-3 w-3 accent-primary"
                    checked={period.isCurrent}
                    onChange={(e) => { setPeriod((p) => ({ ...p, isCurrent: e.target.checked })); markDirty(); }}
                  />
                  現在
                </label>
              </div>
            </div>

            <FormGroupHeader>デバイスモックアップ</FormGroupHeader>
            {/* 旧 Hero の hero_brand / hero_bg_color は新詳細ページ（/works）で未使用のため入力を撤去。
                カラムは互換のため残置（破壊的 DROP は別途要承認）。 */}
            <div className="col-span-2">
              <FieldLabel>スクリーンショット（左パネルのデバイスモックアップ・先頭2枚を表示）</FieldLabel>
              <HeroScreenshotsEditor
                value={(work.hero_screenshots ?? []) as string[]}
                onChange={(v) => setField("hero_screenshots", v as unknown as Json)}
              />
            </div>

            <FormGroupHeader>一覧・タグ設定（一覧サムネ / スキル / ツール）</FormGroupHeader>
            <div className="col-span-2">
              <FieldLabel>サムネイル（一覧カード用）</FieldLabel>
              <ImagePickerField
                value={work.thumbnail_url ?? ""}
                onChange={(v) => setField("thumbnail_url", v || null)}
                folder="projects/thumbnails"
                previewClassName="mt-2 h-16 w-28 rounded-[6px] object-cover"
              />
            </div>
            <div className="col-span-2">
              <FieldLabel>スキル</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {skillOptions.map((label) => {
                  const selected = skills.some((s) => s.toLowerCase() === label.toLowerCase());
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggle(skills, setSkills, label)}
                      className={`rounded-[999px] border px-3 py-1 text-[12px] transition-colors ${
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border-light bg-[#1a1a1a] text-fg-muted hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                {skillOptions.length === 0 && <span className="text-[12px] text-system-700">スキルがまだありません。下の入力欄から追加できます</span>}
              </div>
              <div
                className="mt-2 flex items-center gap-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
                    e.preventDefault();
                    void handleAddSkill();
                  }
                }}
              >
                <Input value={newSkillLabel} onChange={setNewSkillLabel} placeholder="新しいスキル名" className="!w-56" />
                <button
                  type="button"
                  onClick={() => void handleAddSkill()}
                  disabled={addingSkill}
                  className="rounded-[6px] border border-border-light px-2 py-1 text-[11px] text-fg-muted transition-colors hover:border-primary hover:text-white"
                >
                  追加
                </button>
              </div>
            </div>
            <div className="col-span-2">
              <FieldLabel>ツール</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {toolOptions.map((opt) => {
                  const selected = tools.some((t) => t.toLowerCase() === opt.name.toLowerCase());
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggle(tools, setTools, opt.name)}
                      className={`flex items-center gap-1.5 rounded-[999px] border px-3 py-1 text-[12px] transition-colors ${
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border-light bg-[#1a1a1a] text-fg-muted hover:text-white"
                      }`}
                    >
                      {opt.icon_url && (
                        <ProtectedImage src={opt.icon_url} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                      )}
                      {opt.name}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input value={newToolName} onChange={setNewToolName} placeholder="新しいツール名" className="!w-56" />
                <button
                  type="button"
                  onClick={async () => {
                    const name = newToolName.trim();
                    if (!name) return;
                    if (!toolOptions.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
                      // 即時に tools_vocab へ登録して id を得る
                      const res = await addToolNameFromWorks(name);
                      if (res.error || !res.id) {
                        setSaveError(res.error ?? "ツールの追加に失敗しました");
                        return;
                      }
                      setToolOptions((prev) => [...prev, { id: res.id!, name, icon_url: null }]);
                    }
                    toggle(tools, setTools, name);
                    setNewToolName("");
                  }}
                  className="rounded-[6px] border border-border-light px-2 py-1 text-[11px] text-fg-muted transition-colors hover:border-primary hover:text-white"
                >
                  追加
                </button>
              </div>
              <p className="mt-2 text-[11px] text-fg-muted">アイコン画像は「マスタ管理」で設定します</p>
            </div>

            <FormGroupHeader>詳細ページ・左パネル設定</FormGroupHeader>
            <div className="col-span-2">
              <FieldLabel>体制内訳（役割と人数。公開ページでは人数付きタグで表示）</FieldLabel>
              <StakeholderBreakdownField
                value={work.stakeholder_breakdown}
                onChange={(v) => setField("stakeholder_breakdown", v)}
                roleOptions={roleOptions}
              />
            </div>

            <FormGroupHeader>
              <span className="flex items-center gap-3">
                Timeline
                <button
                  type="button"
                  className={`${vizBtn} font-normal tracking-normal disabled:cursor-not-allowed disabled:opacity-40`}
                  disabled={!parsedTimeline}
                  title={parsedTimeline ? undefined : "工程が 0 件のため、公開ページにはアイコンが出ません"}
                  onClick={() => setVizPreview("timeline")}
                >
                  公開ページでの見え方を確認
                </button>
              </span>
            </FormGroupHeader>
            <div className="col-span-2">
              <p className="mb-3 text-[11px] text-fg-muted">公開ページの作品詳細・左パネル（期間の行）の全画面アイコンからモーダルで表示されます。工程が 0 件ならアイコンは出ません。右上の「保存」で反映。</p>
              <TimelineGanttEditor
                value={parsedTimeline ?? EMPTY_TIMELINE}
                onChange={(v) => {
                  setField("timeline", (v.phases.length ? v : null) as unknown as Work["timeline"]);
                }}
                onInsertTemplate={() => setField("timeline", DEFAULT_TIMELINE as unknown as Work["timeline"])}
              />
            </div>

            <FormGroupHeader>
              <span className="flex items-center gap-3">
                Stakeholders
                <button
                  type="button"
                  className={`${vizBtn} font-normal tracking-normal disabled:cursor-not-allowed disabled:opacity-40`}
                  disabled={!parsedStakeholders}
                  title={parsedStakeholders ? undefined : "グループが 0 件のため、公開ページにはアイコンが出ません"}
                  onClick={() => setVizPreview("stakeholders")}
                >
                  公開ページでの見え方を確認
                </button>
              </span>
            </FormGroupHeader>
            <div className="col-span-2">
              <p className="mb-3 text-[11px] text-fg-muted">公開ページの作品詳細・左パネル（体制の行）の全画面アイコンからモーダルで表示されます。グループが 0 件ならアイコンは出ません。右上の「保存」で反映。</p>
              <StakeholdersDiagramEditor
                iconCatalog={iconCatalog}
                value={parsedStakeholders ?? { groups: [] }}
                onChange={(v) => setField("stakeholders", (v.groups.length ? v : null) as unknown as Work["stakeholders"])}
              />
            </div>
          </div>
        </div>
      )}

      {/* 画像ピッカー（本文エディタの画像ダイアログから Promise で呼ばれる） */}
      <ImagePickerModal
        open={pickerOpen}
        onClose={() => closePicker(null)}
        onSelect={(url, alt) => closePicker({ url, alt })}
        folder="projects/sections"
        showAlt
      />
      <FlowchartPickerModal
        open={flowchartPickerOpen}
        onClose={() => closeFlowchartPicker(null)}
        onSelect={closeFlowchartPicker}
      />
      {vizPreview && (
        <WorkVizModal kind={vizPreview} timeline={parsedTimeline} stakeholders={parsedStakeholders} onClose={() => setVizPreview(null)} />
      )}
    </AdminShell>
  );
}

/* ─── Timeline / Stakeholders 構造化フォーム ───────────── */

const vizBtn =
  "rounded-[6px] border border-border-light px-2 py-1 text-[11px] text-fg-muted transition-colors hover:border-primary hover:text-white";
const vizDel = "rounded px-2 py-1 text-[11px] text-system-700 hover:text-danger-300";

/**
 * 新規タイムラインの既定フェーズ一式。
 * ラベル・週数・バー位置は Figma マスター（Master / _Process, W1〜W12）のデフォルト構成に準拠。
 * start/span は各 _ProcessBar の位置・幅（週幅 = 694/12px）から算出。
 * raci は編集前提の中立値（既存「＋フェーズを追加」と同じ）で投入する。
 */
const DEFAULT_TIMELINE: TimelineData = {
  totalUnits: 12,
  phases: [
    { label: "UX Research", start: 1, span: 4, raci: ["R"] },
    { label: "Ideation", start: 1, span: 2, raci: ["R"] },
    { label: "UI Design", start: 3, span: 5, raci: ["R"] },
    { label: "Development / FE", start: 7, span: 4, raci: ["R"] },
    { label: "QA / Launch", start: 9, span: 3, raci: ["R"] },
    { label: "Optimization", start: 11, span: 2, raci: ["R"] },
  ],
};
const EMPTY_TIMELINE: TimelineData = { totalUnits: DEFAULT_TIMELINE.totalUnits, phases: [] };

type BreakdownRow = { role: string; count: number };
const ROLE_LIST_ID = "stakeholder-role-options";
const BREAKDOWN_INVALID = /[0-9・、,]/; // parseStakeholderBreakdown が役割名に使えない文字
function serializeBreakdown(rows: BreakdownRow[]): string | null {
  const s = rows.filter((r) => r.role.trim()).map((r) => `${r.role.trim()}${r.count}`).join("・");
  return s || null;
}
function StakeholderBreakdownField({ value, onChange, roleOptions }: { value: string | null; onChange: (v: string | null) => void; roleOptions: string[] }) {
  const [rows, setRows] = useState<BreakdownRow[] | null>(() => {
    if (!value?.trim()) return [];
    const p = parseStakeholderBreakdown(value);
    return p ? p.map((x) => ({ role: x.name, count: x.count })) : null; // null = 旧形式（文字のまま編集）
  });
  const commit = (next: BreakdownRow[]) => { setRows(next); onChange(serializeBreakdown(next)); };
  const tags = parseStakeholderBreakdown(value);
  return (
    <div className="flex flex-col gap-2">
      {rows === null ? (
        <div>
          <Input value={value ?? ""} onChange={(v) => onChange(v || null)} />
          <p className="mt-1 text-[11px] text-[#f4c248]">この内容は「役割＋人数」の形で読み取れないため、文字のまま保存・表示されます。</p>
          <button
            type="button"
            className={`${vizBtn} mt-2`}
            disabled={!(!value?.trim() || tags)}
            onClick={() => setRows(tags ? tags.map((t) => ({ role: t.name, count: t.count })) : [])}
          >
            行形式で入力し直す
          </button>
        </div>
      ) : (
        <>
          {rows.map((r, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Input className="!w-56" list={ROLE_LIST_ID} value={r.role} placeholder="役割（例: デザイナー）" onChange={(v) => commit(rows.map((x, j) => (j === i ? { ...x, role: v } : x)))} />
                <NumberField className="w-16" value={r.count} min={1} max={999} onCommit={(n) => commit(rows.map((x, j) => (j === i ? { ...x, count: n } : x)))} />
                <span className="text-[11px] text-fg-muted">名</span>
                <span className="ml-auto flex items-center gap-1">
                  <MoveButtons index={i} length={rows.length} label={r.role || `行${i + 1}`} onMove={(d) => commit(moveItem(rows, i, i + d))} />
                  <button type="button" className={vizDel} onClick={() => commit(rows.filter((_, j) => j !== i))}>削除</button>
                </span>
              </div>
              {BREAKDOWN_INVALID.test(r.role) && (
                <p className="text-[11px] text-[#f4c248]">役割名に半角数字や「・、,」があると、公開ページで人数タグにならず文字のまま表示されます</p>
              )}
            </div>
          ))}
          <button type="button" className={`${vizBtn} self-start`} onClick={() => setRows([...rows, { role: "", count: 1 }])}>
            ＋ 行を追加
          </button>
        </>
      )}
      <datalist id={ROLE_LIST_ID}>{roleOptions.map((r) => <option key={r} value={r} />)}</datalist>
      <div>
        <p className="mb-1.5 mt-1 text-[11px] text-fg-muted">公開ページでの見え方</p>
        <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-[8px] border border-border-light bg-[#161616] px-4 py-[6px]">
          {tags ? (
            tags.map((s, i) => <Tag key={`${i}-${s.name}`} variant="tool" filled label={s.name} count={s.count} />)
          ) : (
            <span className="min-w-0 truncate text-body-03-jp text-fg-muted" title={value ?? undefined}>{value || "—"}</span>
          )}
        </div>
      </div>
    </div>
  );
}
