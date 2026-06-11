"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AdminShell,
  FieldLabel,
  FormGroupHeader,
  HeroScreenshotsEditor,
  ImagePickerField,
  ImagePickerModal,
  Input,
  OverviewCardsEditor,
  Textarea,
  type OverviewCardLocal,
} from "../../AdminLayout";
import RichMarkdownEditor from "@/components/RichMarkdownEditor";
import { sectionsToMarkdown, markdownToSections } from "@/lib/work-sections";
import {
  saveWork,
  deleteWork,
  saveWorkSkillsByLabels,
  saveWorkToolsByNames,
} from "@/app/admin/actions";
import { supabase } from "@/src/lib/supabase";
import type { Json, Tables } from "@/src/types/supabase";

type Work = Tables<"works">;

/**
 * Work 1件の全画面エディタ（/admin/works/[id]、id="new" で新規作成）。
 * 「本文」タブ = メインエリア全体のリッチ Markdown エディタ、「設定」タブ = メタ情報フォーム。
 */

function emptyWork(id: string): Work {
  return {
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
    ] as unknown as Json,
    hero_brand: null,
    hero_screenshots: [] as unknown as Json,
    hero_bg_color: null,
    sections: [] as unknown as Json,
    career_item_id: null,
    sort_order: 0,
    created_at: null,
  };
}

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

type CareerOption = Pick<Tables<"career_items">, "id" | "role" | "company" | "period">;

export default function WorkEditor({ workId }: { workId: string }) {
  const router = useRouter();
  const isNew = workId === "new";
  const id = useMemo(() => (isNew ? crypto.randomUUID() : workId), [isNew, workId]);

  const [work, setWork] = useState<Work | null>(isNew ? emptyWork(id) : null);
  const [markdown, setMarkdown] = useState("");
  const [period, setPeriod] = useState<PeriodInputs>(parsePeriod(null));
  const [skills, setSkills] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [skillOptions, setSkillOptions] = useState<string[]>([]);
  const [toolOptions, setToolOptions] = useState<string[]>([]);
  const [newToolName, setNewToolName] = useState("");
  const [careerOptions, setCareerOptions] = useState<CareerOption[]>([]);
  const [tab, setTab] = useState<"content" | "settings">("content");
  const [missing, setMissing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  useEffect(() => {
    const fetchAll = async () => {
      const [workRes, skillsRes, toolsRes, careerRes, skillVocabRes, toolVocabRes] = await Promise.all([
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
        supabase.from("skill_experience").select("label, label_short").order("sort_order"),
        supabase.from("tools_vocab").select("name").order("name"),
      ]);

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
        ((skillVocabRes.data ?? []) as { label: string; label_short: string | null }[]).map(
          (r) => r.label_short || r.label
        )
      );
      setToolOptions(((toolVocabRes.data ?? []) as { name: string }[]).map((r) => r.name));
    };
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workId]);

  const setField = <K extends keyof Work>(key: K, val: Work[K]) => {
    setWork((prev) => (prev ? { ...prev, [key]: val } : prev));
    setDirty(true);
  };
  const markDirty = () => setDirty(true);

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.some((s) => s.toLowerCase() === value.toLowerCase())
      ? list.filter((s) => s.toLowerCase() !== value.toLowerCase())
      : [...list, value]);
    markDirty();
  };

  const handleSave = async () => {
    if (!work) return;
    setSaving(true);
    setSaveError(null);
    const payload: Work = {
      ...work,
      id,
      period: formatPeriod(period),
      sections: markdownToSections(markdown),
    };
    const [saveRes, skillsRes, toolsRes] = await Promise.all([
      saveWork(payload, {}),
      saveWorkSkillsByLabels(id, skills),
      saveWorkToolsByNames(id, tools),
    ]);
    setSaving(false);
    const err = saveRes.error ?? skillsRes.error ?? toolsRes.error ?? null;
    if (err) {
      setSaveError(err);
      return;
    }
    setDirty(false);
    setSavedAt(true);
    setTimeout(() => setSavedAt(false), 2000);
    if (isNew) router.replace(`/admin/works/${id}`);
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

  if (missing) {
    return (
      <AdminShell section="works">
        <p className="text-[14px] text-[#9e9e9e]">プロジェクトが見つかりませんでした。</p>
        <Link href="/admin/works" className="mt-4 inline-block text-[13px] text-[#48f4be] hover:underline">
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
        tab === key ? "bg-[#48f4be]/10 text-[#48f4be]" : "text-[#9e9e9e] hover:text-white"
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
          className="shrink-0 text-[12px] tracking-[0.6px] text-[#48f4be] hover:underline"
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
          className="min-w-0 flex-1 rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-[20px] font-semibold text-white outline-none transition-colors placeholder-[#616161] hover:border-[#424242] focus:border-[#48f4be]"
        />
        {dirty && <span className="shrink-0 text-[11px] text-[#f4c248]">未保存の変更があります</span>}
        {savedAt && <span className="shrink-0 text-[12px] text-[#48f4be]">✓ 保存しました</span>}
        {saveError && (
          <span className="shrink-0 text-[12px] text-[#f4487e]" title={saveError}>
            保存に失敗しました
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="shrink-0 rounded-[8px] bg-[#48f4be] px-4 py-1.5 text-[13px] font-semibold text-[#0a0a0a] hover:opacity-80 disabled:opacity-40"
        >
          {saving ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="shrink-0 rounded-[8px] px-3 py-1.5 text-[13px] text-[#616161] hover:bg-[#f4487e]/10 hover:text-[#f4487e]"
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
        <RichMarkdownEditor
          value={markdown}
          onChange={(md) => {
            setMarkdown(md);
            markDirty();
          }}
          onPickImage={pickImage}
          className="min-h-0 flex-1"
        />
      )}

      {/* 設定タブ */}
      {tab === "settings" && (
        <div className="min-h-0 flex-1 overflow-y-auto pb-12">
          <div className="grid max-w-[916px] grid-cols-2 gap-4">
            <div>
              <FieldLabel>カテゴリ</FieldLabel>
              <Input value={work.category ?? ""} onChange={(v) => setField("category", v || null)} placeholder="プラットフォーム開発" />
            </div>
            <div>
              <FieldLabel>並び順 (sort_order)</FieldLabel>
              <Input value={String(work.sort_order ?? 0)} onChange={(v) => setField("sort_order", Number(v) || 0)} />
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
                className="w-full rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-3 py-2 text-[14px] text-white outline-none transition-colors focus:border-[#48f4be]"
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
                <Input className="!w-20" value={period.startYear} onChange={(v) => { setPeriod((p) => ({ ...p, startYear: v })); markDirty(); }} placeholder="2023" />
                <span className="text-[12px] text-[#9e9e9e]">年</span>
                <Input className="!w-14" value={period.startMonth} onChange={(v) => { setPeriod((p) => ({ ...p, startMonth: v })); markDirty(); }} placeholder="4" />
                <span className="text-[12px] text-[#9e9e9e]">月 〜</span>
                <Input className="!w-20" value={period.isCurrent ? "" : period.endYear} onChange={(v) => { setPeriod((p) => ({ ...p, endYear: v })); markDirty(); }} placeholder="2024" />
                <span className="text-[12px] text-[#9e9e9e]">年</span>
                <Input className="!w-14" value={period.isCurrent ? "" : period.endMonth} onChange={(v) => { setPeriod((p) => ({ ...p, endMonth: v })); markDirty(); }} placeholder="3" />
                <span className="text-[12px] text-[#9e9e9e]">月</span>
                <label className="ml-2 inline-flex items-center gap-2 text-[12px] text-[#9e9e9e]">
                  <input
                    type="checkbox"
                    className="h-3 w-3 accent-[#48f4be]"
                    checked={period.isCurrent}
                    onChange={(e) => { setPeriod((p) => ({ ...p, isCurrent: e.target.checked })); markDirty(); }}
                  />
                  現在
                </label>
              </div>
            </div>

            <FormGroupHeader>Hero エリア設定</FormGroupHeader>
            <div>
              <FieldLabel>ブランド名（Hero 左上のワードマーク）</FieldLabel>
              <Input value={work.hero_brand ?? ""} onChange={(v) => setField("hero_brand", v || null)} placeholder="Bistecca" />
            </div>
            <div>
              <FieldLabel>Hero 背景色（空欄でデフォルト緑）</FieldLabel>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={work.hero_bg_color ?? "#48f4be"}
                  onChange={(e) => setField("hero_bg_color", e.target.value)}
                  className="h-9 w-12 shrink-0 rounded-[6px] border border-[#424242] bg-[#1a1a1a]"
                />
                <Input value={work.hero_bg_color ?? ""} onChange={(v) => setField("hero_bg_color", v || null)} placeholder="#48f4be" />
              </div>
            </div>
            <div className="col-span-2">
              <FieldLabel>Hero スクリーンショット（デバイスモックアップ）</FieldLabel>
              <HeroScreenshotsEditor
                value={(work.hero_screenshots ?? []) as string[]}
                onChange={(v) => setField("hero_screenshots", v as unknown as Json)}
              />
            </div>

            <FormGroupHeader>Overview 設定</FormGroupHeader>
            <div className="col-span-2">
              <FieldLabel>Overview（リード本文）</FieldLabel>
              <Textarea value={work.overview ?? ""} onChange={(v) => setField("overview", v || null)} rows={4} placeholder="このプロジェクトの概要…" />
            </div>
            <div className="col-span-2">
              <FieldLabel>Overview 情報カード（アイコン付き見出し）</FieldLabel>
              <OverviewCardsEditor
                value={(work.overview_cards ?? []) as OverviewCardLocal[]}
                onChange={(v) => setField("overview_cards", v as unknown as Json)}
              />
            </div>

            <FormGroupHeader>公開・タグ設定（一覧サムネ / スキル / ツール）</FormGroupHeader>
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
                          ? "border-[#48f4be] bg-[#48f4be]/10 text-[#48f4be]"
                          : "border-[#424242] bg-[#1a1a1a] text-[#9e9e9e] hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                {skillOptions.length === 0 && <span className="text-[12px] text-[#616161]">スキル定義がありません</span>}
              </div>
            </div>
            <div className="col-span-2">
              <FieldLabel>ツール</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {toolOptions.map((name) => {
                  const selected = tools.some((t) => t.toLowerCase() === name.toLowerCase());
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggle(tools, setTools, name)}
                      className={`rounded-[999px] border px-3 py-1 text-[12px] transition-colors ${
                        selected
                          ? "border-[#48f4be] bg-[#48f4be]/10 text-[#48f4be]"
                          : "border-[#424242] bg-[#1a1a1a] text-[#9e9e9e] hover:text-white"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input value={newToolName} onChange={setNewToolName} placeholder="新しいツール名" className="!w-56" />
                <button
                  type="button"
                  onClick={() => {
                    const name = newToolName.trim();
                    if (!name) return;
                    if (!toolOptions.some((t) => t.toLowerCase() === name.toLowerCase())) {
                      setToolOptions((prev) => [...prev, name]);
                    }
                    toggle(tools, setTools, name);
                    setNewToolName("");
                  }}
                  className="rounded-[6px] border border-[#424242] px-2 py-1 text-[11px] text-[#9e9e9e] transition-colors hover:border-[#48f4be] hover:text-white"
                >
                  追加
                </button>
              </div>
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
    </AdminShell>
  );
}
