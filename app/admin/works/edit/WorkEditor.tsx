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
  PeriodFields,
  moveItem,
} from "../../AdminLayout";
import { parsePeriod, validatePeriod, isSamePeriod, periodInputsOf, periodColumnsForSave, isLegacyPeriod, type PeriodInputs } from "../../period";
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
  addNameMaster,
  type NameMaster,
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
    start_date: null,
    end_date: null,
    is_current: false,
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
 * 新規作成時に本文へ既定で入る構成テンプレート。
 * `# 見出し` がセクション区切り（markdownToSections）。
 */
const DEFAULT_BODY_MD = `# プロジェクト概要

プロジェクトの概要を入力します。

# 役割

# 背景と課題

## 背景

## 目的

## ゴール

# 取り組み

# 成果

# 学び
`;

/** 体制内訳の編集状態。rows = 役割 id と人数の行、legacy = 行の形に読めない旧形式の文字 */
type BreakdownState =
  | { mode: "rows"; rows: { role_id: string; headcount: number }[] }
  | { mode: "legacy" };

const ROLE_DELIMITER = /[・、,]/; // works.role は区切りで分割されるため、担当役割の役割名に使えない
const BREAKDOWN_INVALID = /[0-9・、,]/; // parseStakeholderBreakdown が役割名に使えない文字

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
  const [roles, setRoles] = useState<NameMaster[]>([]);
  const [phaseNames, setPhaseNames] = useState<NameMaster[]>([]);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownState>({ mode: "rows", rows: [] });
  const [roleNotice, setRoleNotice] = useState<string[]>([]);
  const [addingRole, setAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
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
      const [workRes, skillsRes, toolsRes, careerRes, skillVocabRes, toolVocabRes, rolesRes, phaseNamesRes, workRolesRes, countsRes] = await Promise.all([
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
        supabase.from("roles").select("id, name, sort_order").order("sort_order").order("name"),
        supabase.from("phase_names").select("id, name, sort_order").order("sort_order").order("name"),
        isNew
          ? Promise.resolve({ data: [] })
          : supabase.from("work_roles").select("role_id, sort_order").eq("work_id", workId).order("sort_order"),
        isNew
          ? Promise.resolve({ data: [] })
          : supabase
              .from("work_stakeholder_counts")
              .select("role_id, headcount, sort_order")
              .eq("work_id", workId)
              .order("sort_order"),
      ]);

      const failure = [
        "error" in workRes ? workRes.error : null,
        "error" in skillsRes ? skillsRes.error : null,
        "error" in toolsRes ? toolsRes.error : null,
        careerRes.error,
        skillVocabRes.error,
        toolVocabRes.error,
        rolesRes.error,
        phaseNamesRes.error,
        "error" in workRolesRes ? workRolesRes.error : null,
        "error" in countsRes ? countsRes.error : null,
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
        setPeriod(periodInputsOf(row));
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

        const roleList = (rolesRes.data ?? []) as NameMaster[];
        const linkedRoleIds = ((workRolesRes.data ?? []) as { role_id: string }[]).map((r) => r.role_id);
        if (linkedRoleIds.length > 0) {
          setRoleIds(linkedRoleIds);
        } else if (row.role?.trim()) {
          // 紐付けが無い作品は、文字の担当役割を名前の完全一致でマスタに照合する
          const matched: string[] = [];
          const unmatched: string[] = [];
          for (const name of row.role.split(ROLE_DELIMITER).map((n) => n.trim()).filter(Boolean)) {
            const found = roleList.find((r) => r.name === name);
            if (!found) unmatched.push(name);
            else if (!matched.includes(found.id)) matched.push(found.id);
          }
          setRoleIds(matched);
          setRoleNotice(unmatched);
        }
        const counts = (countsRes.data ?? []) as { role_id: string; headcount: number }[];
        if (counts.length > 0) {
          setBreakdown({ mode: "rows", rows: counts.map((c) => ({ role_id: c.role_id, headcount: c.headcount })) });
        } else if (row.stakeholder_breakdown?.trim()) {
          setBreakdown({ mode: "legacy" });
        }
      }
      setRoles((rolesRes.data ?? []) as NameMaster[]);
      setPhaseNames((phaseNamesRes.data ?? []) as NameMaster[]);
      setCareerOptions((careerRes.data ?? []) as CareerOption[]);
      setSkillOptions(
        ((skillVocabRes.data ?? []) as { label: string }[]).map((r) => r.label)
      );
      setToolOptions(
        ((toolVocabRes.data ?? []) as { id: string; name: string; icon_url: string | null }[]).map(
          (r) => ({ id: r.id, name: r.name, icon_url: r.icon_url })
        )
      );
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

  const addRoleToList = async (name: string) => {
    const res = await addNameMaster("roles", name);
    const item = res.item;
    if (item) setRoles((prev) => (prev.some((r) => r.id === item.id) ? prev : [...prev, item]));
    return res;
  };

  const toggleRole = (id: string) => {
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
    markDirty();
  };

  const handleAddRole = async () => {
    if (addingRole) return;
    const name = newRoleName.trim();
    if (!name) return;
    if (ROLE_DELIMITER.test(name)) {
      setSaveError("「・」「、」「,」を含む役割は作品には使えません");
      return;
    }
    setAddingRole(true);
    try {
      const res = await addRoleToList(name);
      if (res.error || !res.item) {
        setSaveError(res.error ?? "役割を追加できませんでした");
        return;
      }
      const item = res.item;
      if (!roleIds.includes(item.id)) {
        setRoleIds((prev) => [...prev, item.id]);
        markDirty();
      }
      setNewRoleName("");
      setSaveError(null);
    } finally {
      setAddingRole(false);
    }
  };

  const handleAddPhaseName = async (name: string) => {
    const res = await addNameMaster("phase_names", name);
    const item = res.item;
    if (item) setPhaseNames((prev) => (prev.some((p) => p.id === item.id) ? prev : [...prev, item]));
    return { error: res.error, name: item?.name };
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
    if (!work.title.trim()) {
      setSaveError("タイトルを入力してください");
      return;
    }
    const periodTouched = !isSamePeriod(period, periodInputsOf(work));
    const periodError = periodTouched ? validatePeriod(period) : null;
    if (periodError) {
      setSaveError(periodError);
      setTab("settings");
      return;
    }
    if (breakdown.mode === "rows" && breakdown.rows.some((r) => !r.role_id)) {
      setSaveError("体制内訳で役割が選ばれていない行があります");
      setTab("settings");
      return;
    }
    if (breakdown.mode === "rows") {
      const ids = breakdown.rows.map((r) => r.role_id);
      if (new Set(ids).size !== ids.length) {
        setSaveError("体制内訳に同じ役割が複数あります");
        setTab("settings");
        return;
      }
      if (breakdown.rows.some((r) => !Number.isInteger(r.headcount) || r.headcount < 1 || r.headcount > 999)) {
        setSaveError("体制内訳の人数は 1〜999 で入力してください");
        setTab("settings");
        return;
      }
    }
    setSaving(true);
    setSaveError(null);
    // 公開ページが読む文字の列は、選んだ役割から作り直す（DB 側も同じ規則で作り直す）
    const roleName = new Map(roles.map((r) => [r.id, r.name]));
    const derivedRole =
      roleIds.map((rid) => roleName.get(rid)).filter(Boolean).join("・") || null;
    const derivedBreakdown =
      breakdown.mode === "rows"
        ? breakdown.rows.map((r) => `${roleName.get(r.role_id)}${r.headcount}`).join("・") || null
        : work.stakeholder_breakdown;
    const payload: Work = {
      ...work,
      id,
      role: derivedRole,
      stakeholder_breakdown: derivedBreakdown,
      ...periodColumnsForSave(work, period, periodTouched),
      // 画像アップロード中の仮の行が万一残っていても DB には入れない
      sections: markdownToSections(
        markdown
          .split("\n")
          .filter((l) => l.trim() !== UPLOAD_PLACEHOLDER)
          .join("\n")
      ),
    };
    const saveRes = await saveWork(
      payload,
      skills,
      tools,
      roleIds,
      breakdown.mode === "rows"
        ? breakdown.rows.map((r) => ({ role_id: r.role_id, headcount: r.headcount }))
        : null,
    );
    if (saveRes.error) {
      setSaving(false);
      setSaveError(saveRes.error);
      return;
    }
    setWork((p) =>
      p
        ? {
            ...p,
            period: payload.period,
            start_date: payload.start_date,
            end_date: payload.end_date,
            is_current: payload.is_current,
            role: payload.role,
            stakeholder_breakdown: payload.stakeholder_breakdown,
          }
        : p,
    );
    setRoleNotice([]);
    setPeriod(periodInputsOf(payload));
    setSaving(false);
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
          <span role="alert" title={saveError} className="min-w-0 max-w-[480px] truncate text-[12px] text-danger-300">
            {saveError}
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
              <div className="flex flex-wrap gap-2">
                {roles.map((r) => {
                  const selected = roleIds.includes(r.id);
                  const invalid = ROLE_DELIMITER.test(r.name);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={invalid}
                      title={invalid ? "「・」「、」「,」を含む役割は作品には使えません" : undefined}
                      onClick={() => toggleRole(r.id)}
                      className={`rounded-[999px] border px-3 py-1 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border-light bg-[#1a1a1a] text-fg-muted hover:text-white"
                      }`}
                    >
                      {r.name}
                    </button>
                  );
                })}
                {roles.length === 0 && <span className="text-[12px] text-system-700">役割がまだありません。下の入力欄から追加できます</span>}
              </div>
              <p className="mt-2 text-[11px] text-fg-muted">
                選んだ順に「・」でつないで公開ページに表示：
                {roleIds.map((rid) => roles.find((r) => r.id === rid)?.name).filter(Boolean).join("・") || "—"}
              </p>
              {roleNotice.map((n) => (
                <p key={n} className="mt-1 text-[11px] text-[#f4c248]">
                  未登録の役割「{n}」は保存すると外れます。マスタに追加して選び直してください
                </p>
              ))}
              <div
                className="mt-2 flex items-center gap-2"
                onKeyDown={(e) => {
                  if ((e.target as HTMLElement).tagName !== "INPUT") return;
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
                    e.preventDefault();
                    if (!addingRole) void handleAddRole();
                  }
                }}
              >
                <Input value={newRoleName} onChange={setNewRoleName} placeholder="新しい役割" className="!w-56" />
                <button
                  type="button"
                  onClick={() => void handleAddRole()}
                  disabled={!newRoleName.trim() || addingRole}
                  className="rounded-[6px] border border-border-light px-2 py-1 text-[11px] text-fg-muted transition-colors hover:border-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  追加
                </button>
              </div>
            </div>
            <div className="col-span-2">
              <FieldLabel>担当経歴（Career）</FieldLabel>
              <select
                value={work.career_item_id ?? ""}
                onChange={(e) => setField("career_item_id", e.target.value || null)}
                className={`w-full rounded-[8px] border border-border-light bg-[#1a1a1a] px-3 py-2 text-[14px] outline-none transition-colors focus:border-primary ${work.career_item_id ? "text-white" : "text-system-750"}`}
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
              <PeriodFields value={period} disabled={saving} onChange={(p) => { setPeriod(p); markDirty(); }} />
              {isLegacyPeriod(work) && isSamePeriod(period, periodInputsOf(work)) && (
                <p className="mt-1 text-[11px] text-[#f4c248]">現在の値「{work.period}」は年月の入力欄で読み取れない形式です。入力して保存すると置き換わります。</p>
              )}
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
                roles={roles}
                value={breakdown}
                legacyText={work.stakeholder_breakdown}
                onChange={(v) => {
                  setBreakdown(v);
                  markDirty();
                }}
                onLegacyTextChange={(v) => setField("stakeholder_breakdown", v)}
                onAddRole={addRoleToList}
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
                phaseNames={phaseNames.map((p) => p.name)}
                onAddPhaseName={handleAddPhaseName}
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

function StakeholderBreakdownField({
  roles,
  value,
  legacyText,
  onChange,
  onLegacyTextChange,
  onAddRole,
}: {
  roles: NameMaster[];
  value: BreakdownState;
  legacyText: string | null;
  onChange: (v: BreakdownState) => void;
  onLegacyTextChange: (v: string | null) => void;
  onAddRole: (name: string) => Promise<{ error: string | null; item?: NameMaster }>;
}) {
  const [newRoleName, setNewRoleName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const legacyTags = parseStakeholderBreakdown(legacyText);
  const roleName = new Map(roles.map((r) => [r.id, r.name]));

  const setRows = (rows: { role_id: string; headcount: number }[]) => onChange({ mode: "rows", rows });

  const handleAdd = async () => {
    if (value.mode !== "rows" || adding) return;
    const name = newRoleName.trim();
    if (!name) return;
    if (BREAKDOWN_INVALID.test(name)) {
      setAddError("役割名に半角数字や「・、,」は使えません（公開ページで人数タグにならないため）");
      return;
    }
    setAdding(true);
    setAddError(null);
    const res = await onAddRole(name);
    if (res.error || !res.item) {
      setAddError(res.error ?? "役割を追加できませんでした");
    } else {
      const item = res.item;
      if (value.rows.some((r) => r.role_id === item.id)) {
        setAddError("この役割はすでに選ばれています");
      } else {
        setRows([...value.rows, { role_id: item.id, headcount: 1 }]);
        setNewRoleName("");
        setUnmatched([]);
      }
    }
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {value.mode === "legacy" ? (
        <div>
          <Input value={legacyText ?? ""} onChange={(v) => onLegacyTextChange(v || null)} />
          <p className="mt-1 text-[11px] text-[#f4c248]">この内容は「役割＋人数」の形で読み取れないため、文字のまま保存・表示されます。</p>
          <button
            type="button"
            className={`${vizBtn} mt-2`}
            disabled={!(!legacyText?.trim() || legacyTags)}
            onClick={() => {
              const rows: { role_id: string; headcount: number }[] = [];
              const missing: string[] = [];
              for (const t of legacyTags ?? []) {
                const name = t.name.trim();
                const role = roles.find((r) => r.name.trim() === name);
                if (!role) {
                  if (!missing.includes(name)) missing.push(name);
                  continue;
                }
                if (rows.some((r) => r.role_id === role.id)) continue;
                rows.push({ role_id: role.id, headcount: Math.min(999, Math.max(1, t.count)) });
              }
              setUnmatched(missing);
              setRows(rows);
            }}
          >
            行形式で入力し直す
          </button>
        </div>
      ) : (
        <>
          {unmatched.length > 0 && (
            <p className="text-[11px] text-[#f4c248]">
              未登録の役割{unmatched.map((n) => `「${n}」`).join("")}は行に入りませんでした。「新しい役割」で追加して選んでください。
            </p>
          )}
          {value.rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={r.role_id}
                onChange={(e) => setRows(value.rows.map((x, j) => (j === i ? { ...x, role_id: e.target.value } : x)))}
                className={`!w-56 rounded-[8px] border border-border-light bg-[#1a1a1a] px-3 py-2 text-[14px] outline-none transition-colors focus:border-primary ${r.role_id ? "text-white" : "text-system-750"}`}
              >
                <option value="">（役割を選択）</option>
                {roles.map((o) => {
                  const invalid = BREAKDOWN_INVALID.test(o.name);
                  const usedElsewhere = value.rows.some((x, j) => j !== i && x.role_id === o.id);
                  return (
                    <option key={o.id} value={o.id} disabled={invalid || usedElsewhere}>
                      {o.name}
                      {invalid ? "（体制内訳に使えない文字を含む）" : ""}
                    </option>
                  );
                })}
              </select>
              <NumberField className="w-16" value={r.headcount} min={1} max={999} onCommit={(n) => setRows(value.rows.map((x, j) => (j === i ? { ...x, headcount: n } : x)))} />
              <span className="text-[11px] text-fg-muted">名</span>
              <span className="ml-auto flex items-center gap-1">
                <MoveButtons index={i} length={value.rows.length} label={roleName.get(r.role_id) || `行${i + 1}`} onMove={(d) => setRows(moveItem(value.rows, i, i + d))} />
                <button type="button" className={vizDel} onClick={() => setRows(value.rows.filter((_, j) => j !== i))}>削除</button>
              </span>
            </div>
          ))}
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
            <Input value={newRoleName} onChange={setNewRoleName} placeholder="新しい役割" className="!w-56" />
            <button type="button" className={vizBtn} disabled={adding || !newRoleName.trim()} onClick={() => void handleAdd()}>
              追加
            </button>
          </div>
          {addError && <p className="text-[12px] text-danger-300">{addError}</p>}
        </>
      )}
      <div>
        <p className="mb-1.5 mt-1 text-[11px] text-fg-muted">公開ページでの見え方</p>
        <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-[8px] border border-border-light bg-[#161616] px-4 py-[6px]">
          {value.mode === "rows" ? (
            value.rows.some((r) => r.role_id && roleName.has(r.role_id)) ? (
              value.rows
                .filter((r) => r.role_id && roleName.has(r.role_id))
                .map((r) => <Tag key={r.role_id} variant="tool" filled label={roleName.get(r.role_id) ?? ""} count={r.headcount} />)
            ) : (
              <span className="min-w-0 truncate text-body-03-jp text-fg-muted">—</span>
            )
          ) : legacyTags ? (
            legacyTags.map((s, i) => <Tag key={`${i}-${s.name}`} variant="tool" filled label={s.name} count={s.count} />)
          ) : (
            <span className="min-w-0 truncate text-body-03-jp text-fg-muted" title={legacyText ?? undefined}>{legacyText || "—"}</span>
          )}
        </div>
      </div>
    </div>
  );
}
