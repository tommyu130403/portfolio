"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AdminShell,
  FieldLabel,
  FormGroupHeader,
  HeroScreenshotsEditor,
  FlowchartPickerModal,
  WorkPickerModal,
  ImagePickerField,
  ImagePickerModal,
  Input,
  MoveButtons,
  PeriodFields,
  moveItem,
} from "../../AdminLayout";
import { parsePeriod, validatePeriod, isSamePeriod, periodInputsOf, periodColumnsForSave, isLegacyPeriod, type PeriodInputs } from "../../period";
import RichMarkdownEditor, {
  UPLOAD_PLACEHOLDER,
  PreviewPane,
  DeviceSwitcher,
  type PreviewDevice,
  type EditorMode,
} from "@/components/RichMarkdownEditor";
import WorkDetailHeader, { type WorkToolItem, type WorkDetailEditRegion } from "@/components/WorkDetailHeader";
import WorkCard from "@/components/WorkCard";
import WorkDetailContent from "@/components/WorkDetailContent";
import { parseScreenshots, parseThumbnail, DEFAULT_IMAGE, type WorkThumbnailData, type ThumbnailLayout } from "@/lib/work-content";
import { workPeriodLabel } from "@/lib/work-period";
import { compressImage } from "@/lib/compress-image";
import {
  parseTimeline,
  parseStakeholders,
  type TimelineData,
  type StakeholdersData,
} from "@/components/WorkViz";
import { sectionsToMarkdown, markdownToSections, sectionStartLines } from "@/lib/work-sections";
import {
  saveWork,
  deleteWork,
  addToolNameFromWorks,
  addContentLabelFromWorks,
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
import { periodFromInputs } from "@/lib/timeline-scale";
import type { IconCatalog } from "@/app/admin/iconCatalogTypes";
import Tag from "@/components/Tag";
import { parseStakeholderBreakdown } from "@/components/WorkDetailHeader";
import { supabase } from "@/src/lib/supabase";
import ProtectedImage from "@/components/ProtectedImage";
import type { Json, Tables } from "@/src/types/supabase";

type Work = Tables<"works">;

/**
 * Work 1件の全画面エディタ（/admin/works/edit?id=xxx、id 省略 or "new" で新規作成）。
 * 左 = メタ情報フォーム → 本文のリッチ Markdown エディタ（1 本でスクロール）、
 * 右 = 公開ページ全体（上部ブロック・本文・一覧カード）を未保存の値で描くプレビュー。xl 未満では縦積み。
 */

// 新規作成時の Stakeholders 初期値（Figma Master 848:2948）
const DEFAULT_STAKEHOLDERS: StakeholdersData = {
  groups: [
    { label: "Product", icon: "Abstract/application-one", members: [{ label: "General Manager" }, { label: "Product Manager", me: true }] },
    { label: "Project", icon: "Components/tree-list", members: [{ label: "Project Owner" }, { label: "Project Manager", me: true }] },
    { label: "Designer", icon: "Components/platte", members: [{ label: "Leader", me: true }, { label: "" }] },
    { label: "Engineer", icon: "Edit/code", members: [{ label: "Leader" }, { label: "" }, { label: "" }, { label: "" }] },
  ],
};

function emptyWork(id: string): Work {
  return {
    id,
    is_published: true,
    title: "新しいプロジェクト",
    category: null,
    thumbnail_url: null,
    thumbnail: null,
    role: null,
    period: null,
    start_date: null,
    end_date: null,
    is_current: false,
    timeline: null,
    stakeholders: DEFAULT_STAKEHOLDERS as unknown as Json,
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
type ToolOption = { id: string; name: string; icon_url: string | null; slug: string | null };

/** 期間の入力欄が読み込み時の値から変わっているか（保存時の検証とプレビューで同じ判定を使う） */
const isPeriodTouched = (work: Work, period: PeriodInputs) => !isSamePeriod(period, periodInputsOf(work));

/**
 * 編集中の状態から、保存する（公開ページが読む）Work 行を組み立てる純粋関数。
 * 保存（handleSave）と右側のプレビューが同じ結果を共有する。
 */
function composePublicWork({
  work,
  id,
  roles,
  roleIds,
  breakdown,
  period,
  markdown,
}: {
  work: Work;
  id: string;
  roles: NameMaster[];
  roleIds: string[];
  breakdown: BreakdownState;
  period: PeriodInputs;
  markdown: string;
}): Work {
  const periodTouched = isPeriodTouched(work, period);
  // 公開ページが読む文字の列は、選んだ役割から作り直す（DB 側も同じ規則で作り直す）
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const derivedRole =
    roleIds.map((rid) => roleName.get(rid)).filter(Boolean).join("・") || null;
  const derivedBreakdown =
    breakdown.mode === "rows"
      ? breakdown.rows
          .filter((r) => roleName.has(r.role_id)) // 役割未選択の行は保存前に弾かれる。プレビューに "undefined" を出さない
          .map((r) => `${roleName.get(r.role_id)}${r.headcount}`)
          .join("・") || null
      : work.stakeholder_breakdown;
  return {
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
}

/**
 * textarea の中で `textBefore` が占める高さ（px）を測る。折り返しを含めた実際の行位置を得るために、
 * 同じ幅・フォント・左右余白の見えない要素へ流し込んで高さを読む。
 */
function measureTextareaOffset(ta: HTMLTextAreaElement, textBefore: string): number {
  if (!textBefore) return 0;
  const cs = getComputedStyle(ta);
  const mirror = document.createElement("div");
  for (const prop of [
    "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "tabSize",
    "paddingLeft", "paddingRight", "overflowWrap", "wordBreak",
  ] as const) {
    mirror.style[prop] = cs[prop];
  }
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.boxSizing = "border-box";
  mirror.style.width = `${ta.clientWidth}px`; // clientWidth は内側余白込み・枠線なし（box-sizing: border-box で合わせる）
  // 末尾の改行は div では行にならないため、ゼロ幅文字を足して「前の行の終わり」まで高さに含める
  mirror.textContent = `${textBefore}\n\u200b`;
  document.body.appendChild(mirror);
  const lineHeight = parseFloat(cs.lineHeight) || 20;
  const height = mirror.offsetHeight - lineHeight; // 足した 1 行分を戻す
  mirror.remove();
  // textarea の中では上余白のぶん下に描かれるので、その分を足す
  return Math.max(0, height) + (parseFloat(cs.paddingTop) || 0);
}

export default function WorkEditor({ workId, iconCatalog }: { workId: string; iconCatalog: IconCatalog }) {
  const router = useRouter();
  const isNew = workId === "new";
  const id = useMemo(() => (isNew ? crypto.randomUUID() : workId), [isNew, workId]);

  const [work, setWork] = useState<Work | null>(isNew ? emptyWork(id) : null);
  const [markdown, setMarkdown] = useState(isNew ? DEFAULT_BODY_MD : "");
  const [vizPreview, setVizPreview] = useState<"timeline" | "stakeholders" | null>(null);
  const [period, setPeriod] = useState<PeriodInputs>(parsePeriod(null));
  const [contents, setContents] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [contentOptions, setContentOptions] = useState<string[]>([]);
  const [newContentLabel, setNewContentLabel] = useState("");
  const [addingContent, setAddingContent] = useState(false);
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
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishPending, setPublishPending] = useState(false);
  const [settingsDevice, setSettingsDevice] = useState<PreviewDevice>("full");
  // 保存時の検証エラーで該当欄まで左ペインをスクロールするための参照
  const periodFieldRef = useRef<HTMLDivElement>(null);
  const breakdownFieldRef = useRef<HTMLDivElement>(null);
  // プレビューの編集ボタンから左カラムの該当欄へ移動するための参照
  const titleInputRef = useRef<HTMLInputElement>(null);
  const screenshotsFieldRef = useRef<HTMLDivElement>(null);
  const titleFieldRef = useRef<HTMLDivElement>(null);
  const tagsFieldRef = useRef<HTMLDivElement>(null);
  const rolesFieldRef = useRef<HTMLDivElement>(null);
  const bodyFieldRef = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
  }, []);
  const ringClass = (key: string) => (highlight === key ? "rounded-[8px] ring-2 ring-inset ring-primary/60" : "");
  // 本文エディタの表示モード。プレビューの見出しボタンから textarea へ飛ぶために外から制御する
  const [bodyMode, setBodyMode] = useState<EditorMode>("edit");
  /** 該当欄を画面中央へスクロールし、1.6 秒だけ枠で強調する */
  const focusField = (key: string, ref: RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlight(key);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlight(null), 1600);
  };

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

  // 作品ピッカー（本文の作品カード挿入用。フローチャートと同じ Promise 方式）
  const [workPickerOpen, setWorkPickerOpen] = useState(false);
  const workPickResolve = useRef<
    ((v: { id: string; title: string } | null) => void) | null
  >(null);
  const pickWork = () =>
    new Promise<{ id: string; title: string } | null>((resolve) => {
      workPickResolve.current = resolve;
      setWorkPickerOpen(true);
    });
  const closeWorkPicker = (result: { id: string; title: string } | null) => {
    workPickResolve.current?.(result);
    workPickResolve.current = null;
    setWorkPickerOpen(false);
  };

  useEffect(() => {
    const fetchAll = async () => {
      const [workRes, contentsRes, toolsRes, careerRes, contentVocabRes, toolVocabRes, rolesRes, phaseNamesRes, workRolesRes, countsRes] = await Promise.all([
        isNew
          ? Promise.resolve({ data: null })
          : supabase.from("works").select("*").eq("id", workId).maybeSingle(),
        isNew
          ? Promise.resolve({ data: [] })
          : supabase.from("work_contents").select("sort_order, contents_vocab(label)").eq("work_id", workId).order("sort_order"),
        isNew
          ? Promise.resolve({ data: [] })
          : supabase.from("work_tools").select("sort_order, tools_vocab(name)").eq("work_id", workId).order("sort_order"),
        supabase.from("career_items").select("id, role, company, period").order("sort_order"),
        // Work タグ用の制作内容語彙は専用マスタ contents_vocab を単一ソースとする
        // （スキルセクションの skill_experience とは疎結合）
        supabase.from("contents_vocab").select("label").order("sort_order").order("label"),
        supabase.from("tools_vocab").select("id, name, icon_url, slug").order("name"),
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
        "error" in contentsRes ? contentsRes.error : null,
        "error" in toolsRes ? toolsRes.error : null,
        careerRes.error,
        contentVocabRes.error,
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
        setContents(
          ((contentsRes.data ?? []) as unknown as { contents_vocab: { label: string } | null }[])
            .map((r) => r.contents_vocab?.label)
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
      setContentOptions(
        ((contentVocabRes.data ?? []) as { label: string }[]).map((r) => r.label)
      );
      setToolOptions((toolVocabRes.data ?? []) as ToolOption[]);
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

  // 右側のプレビュー用。保存と同じ組み立て規則で、未保存の編集状態から作る
  const previewWork = useMemo(
    () => (work ? composePublicWork({ work, id, roles, roleIds, breakdown, period, markdown }) : null),
    [work, id, roles, roleIds, breakdown, period, markdown]
  );
  const previewTools = useMemo<WorkToolItem[]>(
    () =>
      tools.map((name) => {
        const opt = toolOptions.find((t) => t.name.toLowerCase() === name.toLowerCase());
        return { name, icon_url: opt?.icon_url ?? null, slug: opt?.slug ?? null };
      }),
    [tools, toolOptions]
  );
  const previewScreenshots = useMemo(
    () => parseScreenshots(previewWork?.hero_screenshots),
    [previewWork?.hero_screenshots]
  );

  // jsonb のパースは work の該当カラムが変わったときだけ（毎レンダー・毎キーストロークの再パースを防ぐ）
  const parsedTimeline = useMemo(() => parseTimeline(work?.timeline), [work?.timeline]);
  const parsedStakeholders = useMemo(() => parseStakeholders(work?.stakeholders), [work?.stakeholders]);
  const thumbnail = useMemo(() => parseThumbnail(work?.thumbnail), [work?.thumbnail]);
  // 「なし」に切り替えても入力を失わないよう、直前の構成を退避しておく（イベント処理の中でだけ読み書きする）
  const thumbStashRef = useRef<WorkThumbnailData | null>(null);

  const setThumbnail = (next: WorkThumbnailData | null) => {
    setField("thumbnail", next as unknown as Json);
  };
  const changeLayout = (v: string) => {
    if (v === "none") {
      if (thumbnail) thumbStashRef.current = thumbnail;
      setThumbnail(null);
      return;
    }
    const base: WorkThumbnailData = thumbnail ??
      thumbStashRef.current ?? { layout: "a1", logo_url: null, desktop_url: null, mobile_urls: [], capture_urls: [] };
    setThumbnail({ ...base, layout: v as ThumbnailLayout });
  };
  const setSlot = (key: "mobile_urls" | "capture_urls", i: number, v: string) => {
    if (!thumbnail) return;
    const arr = [...thumbnail[key]];
    while (arr.length < i + 1) arr.push("");
    arr[i] = v;
    while (arr.length > 0 && arr[arr.length - 1] === "") arr.pop();
    setThumbnail({ ...thumbnail, [key]: arr });
  };

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

  const handleAddContent = async () => {
    const label = newContentLabel.trim();
    if (!label || addingContent) return;
    setAddingContent(true);
    try {
      let chosen = contentOptions.find((s) => s.toLowerCase() === label.toLowerCase());
      if (!chosen) {
        const res = await addContentLabelFromWorks(label);
        if (res.error || !res.id) {
          setSaveError(res.error ?? "制作内容の追加に失敗しました");
          return;
        }
        chosen = label;
        setContentOptions((prev) =>
          prev.some((s) => s.toLowerCase() === label.toLowerCase())
            ? prev
            : [...prev, label].sort((a, b) => a.localeCompare(b))
        );
      }
      const c = chosen;
      if (!contents.some((s) => s.toLowerCase() === c.toLowerCase())) {
        setContents((prev) => [...prev, c]);
        markDirty();
      }
      setNewContentLabel("");
    } finally {
      setAddingContent(false);
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

  /** プレビューの編集ボタン → 左カラムの該当欄へ移動して強調する */
  const handlePreviewEdit = (region: WorkDetailEditRegion) => {
    if (region === "title") {
      // タイトル入力は上部のヘッダー行（スクロール領域の外）にあるため、入力欄にフォーカスしつつ
      // 左カラムは先頭のカテゴリ欄まで戻す（先頭要素への center スクロールは 0 に丸まる）
      titleInputRef.current?.focus({ preventScroll: true });
      focusField("title", titleFieldRef);
      return;
    }
    const target = {
      screenshots: screenshotsFieldRef,
      tags: tagsFieldRef,
      period: periodFieldRef,
      roles: rolesFieldRef,
      stakeholders: breakdownFieldRef,
    }[region];
    focusField(region === "stakeholders" ? "breakdown" : region, target);
  };

  /** プレビューの見出しの編集ボタン → 本文エディタの該当 `# 見出し` 行にカーソルを置く */
  const handleEditSection = (index: number) => {
    // textarea は値を LF に揃えるため、行の計算も LF 基準にする（DB 由来の CRLF でずれない）
    const normalized = markdown.replace(/\r\n?/g, "\n");
    // プレビュー（WorkDetailContent）と同じ区切り規則で、n 番目のセクションの先頭行を得る。
    // 仮の行（画像アップロード中）は保存時と同じく本文として数えない
    const line = sectionStartLines(normalized, (l) => l.trim() === UPLOAD_PLACEHOLDER)[index];
    focusField("body", bodyFieldRef);
    if (line === undefined) return;
    // プレビュー表示中は textarea が無いので編集モードへ戻す。カーソル移動は描画後（effect）に行う
    if (bodyMode === "preview") setBodyMode("edit");
    pendingJump.current = { text: normalized, line };
    setJumpSeq((n) => n + 1);
  };
  // 見出しジャンプの実行。描画が終わって textarea が確実にある状態で動かすため effect にしている
  const pendingJump = useRef<{ text: string; line: number } | null>(null);
  const [jumpSeq, setJumpSeq] = useState(0);
  useEffect(() => {
    const jump = pendingJump.current;
    if (!jump) return;
    pendingJump.current = null;
    // 本文エディタは textarea の位置を外へ公開していないため、API を増やさず DOM から直接取る（この画面専用の最小対応）
    const ta = bodyFieldRef.current?.querySelector("textarea");
    if (!ta) return;
    const lines = jump.text.split("\n");
    const start = lines.slice(0, jump.line).reduce((n, l) => n + l.length + 1, 0);
    const end = start + lines[jump.line].length;
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(start, end);
    // 選択行が見える位置まで textarea 内をスクロールする。折り返しで行番号×行高の概算は大きく外れるため、
    // textarea と同じ幅・フォント・余白の見えない要素に「選択行より前の本文」を流し込み、その高さを実際の行位置として使う
    ta.scrollTop = Math.max(0, measureTextareaOffset(ta, lines.slice(0, jump.line).join("\n")) - ta.clientHeight / 3);
  }, [jumpSeq]);

  const handleSave = async () => {
    if (!work) return;
    if (!work.title.trim()) {
      setSaveError("タイトルを入力してください");
      return;
    }
    const periodTouched = isPeriodTouched(work, period);
    const periodError = periodTouched ? validatePeriod(period) : null;
    if (periodError) {
      setSaveError(periodError);
      focusField("period", periodFieldRef);
      return;
    }
    // 役割未選択の行と、マスタに無い役割 id の行（別画面で削除された等）はどちらも保存しない
    const knownRole = new Set(roles.map((r) => r.id));
    if (breakdown.mode === "rows" && breakdown.rows.some((r) => !knownRole.has(r.role_id))) {
      setSaveError("体制内訳に、役割が未選択か、マスタから削除された役割の行があります");
      focusField("breakdown", breakdownFieldRef);
      return;
    }
    if (breakdown.mode === "rows") {
      const ids = breakdown.rows.map((r) => r.role_id);
      if (new Set(ids).size !== ids.length) {
        setSaveError("体制内訳に同じ役割が複数あります");
        focusField("breakdown", breakdownFieldRef);
        return;
      }
      if (breakdown.rows.some((r) => !Number.isInteger(r.headcount) || r.headcount < 1 || r.headcount > 999)) {
        setSaveError("体制内訳の人数は 1〜999 で入力してください");
        focusField("breakdown", breakdownFieldRef);
        return;
      }
    }
    setSaving(true);
    setSaveError(null);
    const payload = composePublicWork({ work, id, roles, roleIds, breakdown, period, markdown });
    const saveRes = await saveWork(
      payload,
      contents,
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
          ref={titleInputRef}
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

      {/* 設定フォーム＋本文エディタ（左）/ 公開ページ全体のプレビュー（右） */}
      <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 pb-3">
            <p className="text-[11px] text-fg-muted">公開ページでの見え方（保存前の値で描画）</p>
            <DeviceSwitcher device={settingsDevice} onChange={setSettingsDevice} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto xl:flex-row xl:overflow-hidden">
          <div className="w-full shrink-0 pb-12 xl:min-h-0 xl:w-1/2 xl:shrink xl:overflow-y-auto xl:pr-4">
          <div className="flex max-w-main min-w-0 flex-col gap-4">
            <div ref={titleFieldRef} className={ringClass("title")}>
              <FieldLabel>カテゴリ</FieldLabel>
              <WorkCategoryField value={work.category} onChange={(v) => setField("category", v)} dirty={dirty} />
            </div>
            <div ref={rolesFieldRef} className={ringClass("roles")}>
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
            <div>
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
            <div ref={periodFieldRef} className={ringClass("period")}>
              <FieldLabel>期間</FieldLabel>
              <PeriodFields value={period} disabled={saving} onChange={(p) => { setPeriod(p); markDirty(); }} />
              {isLegacyPeriod(work) && isSamePeriod(period, periodInputsOf(work)) && (
                <p className="mt-1 text-[11px] text-[#f4c248]">現在の値「{work.period}」は年月の入力欄で読み取れない形式です。入力して保存すると置き換わります。</p>
              )}
            </div>

            <FormGroupHeader>デバイスモックアップ</FormGroupHeader>
            {/* hero_bg_color は未使用のため入力を撤去。hero_brand は構成サムネイルのサービス名として
                「サムネイル構成」で入力する。カラムは互換のため残置（破壊的 DROP は別途要承認）。 */}
            <div ref={screenshotsFieldRef} className={ringClass("screenshots")}>
              <FieldLabel>スクリーンショット（左パネルのデバイスモックアップ・先頭2枚を表示）</FieldLabel>
              <HeroScreenshotsEditor
                value={(work.hero_screenshots ?? []) as string[]}
                onChange={(v) => setField("hero_screenshots", v as unknown as Json)}
              />
            </div>

            <FormGroupHeader>一覧・タグ設定（サムネイル構成 / 制作内容 / ツール）</FormGroupHeader>
            <div className="flex flex-col gap-3">
              <div>
                <FieldLabel>サムネイル構成</FieldLabel>
                <select
                  value={thumbnail?.layout ?? "none"}
                  onChange={(e) => changeLayout(e.target.value)}
                  className="w-full rounded-[8px] border border-border-light bg-[#1a1a1a] px-3 py-2 text-[14px] text-white outline-none transition-colors focus:border-primary"
                >
                  <option value="none">なし（1枚画像を使う）</option>
                  <option value="a1">A-1 デスクトップ+モバイル</option>
                  <option value="a2">A-2 デスクトップのみ</option>
                  <option value="a3">A-3 モバイルのみ</option>
                  <option value="d">D モックアップなし</option>
                </select>
              </div>
              {thumbnail === null ? (
                <div>
                  <FieldLabel>サムネイル（1枚画像）</FieldLabel>
                  <ImagePickerField
                    value={work.thumbnail_url ?? ""}
                    onChange={(v) => setField("thumbnail_url", v || null)}
                    folder="projects/thumbnails"
                    previewClassName="mt-2 h-16 w-28 rounded-[6px] object-cover"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <FieldLabel>サービス名</FieldLabel>
                    <Input value={work.hero_brand ?? ""} onChange={(v) => setField("hero_brand", v || null)} placeholder="サービス名" />
                  </div>
                  <div>
                    <FieldLabel>ロゴ</FieldLabel>
                    <ImagePickerField
                      value={thumbnail.logo_url ?? ""}
                      onChange={(v) => setThumbnail({ ...thumbnail, logo_url: v || null })}
                      folder="projects/thumbnails"
                      previewClassName="mt-2 h-12 w-12 rounded-[6px] object-cover"
                    />
                  </div>
                  {(thumbnail.layout === "a1" || thumbnail.layout === "a2") && (
                    <div>
                      <FieldLabel>デスクトップ画面</FieldLabel>
                      <ImagePickerField
                        value={thumbnail.desktop_url ?? ""}
                        onChange={(v) => setThumbnail({ ...thumbnail, desktop_url: v || null })}
                        folder="projects/thumbnails"
                        previewClassName="mt-2 h-16 w-28 rounded-[6px] object-cover"
                      />
                    </div>
                  )}
                  {thumbnail.layout === "a1" && (
                    <div>
                      <FieldLabel>モバイル画面</FieldLabel>
                      <ImagePickerField
                        value={thumbnail.mobile_urls[0] ?? ""}
                        onChange={(v) => setSlot("mobile_urls", 0, v)}
                        folder="projects/thumbnails"
                        previewClassName="mt-2 h-16 w-28 rounded-[6px] object-cover"
                      />
                    </div>
                  )}
                  {thumbnail.layout === "a3" &&
                    [0, 1].map((i) => (
                      <div key={`mobile-${i}`}>
                        <FieldLabel>モバイル画面 {i + 1}</FieldLabel>
                        <ImagePickerField
                          value={thumbnail.mobile_urls[i] ?? ""}
                          onChange={(v) => setSlot("mobile_urls", i, v)}
                          folder="projects/thumbnails"
                          previewClassName="mt-2 h-16 w-28 rounded-[6px] object-cover"
                        />
                      </div>
                    ))}
                  {thumbnail.layout === "d" &&
                    [0, 1].map((i) => (
                      <div key={`capture-${i}`}>
                        <FieldLabel>資料キャプチャ {i + 1}</FieldLabel>
                        <ImagePickerField
                          value={thumbnail.capture_urls[i] ?? ""}
                          onChange={(v) => setSlot("capture_urls", i, v)}
                          folder="projects/thumbnails"
                          previewClassName="mt-2 h-16 w-28 rounded-[6px] object-cover"
                        />
                      </div>
                    ))}
                </>
              )}
            </div>
            <div ref={tagsFieldRef} className={`flex flex-col gap-4 ${ringClass("tags")}`}>
            <div>
              <FieldLabel>制作内容</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {contentOptions.map((label) => {
                  const selected = contents.some((s) => s.toLowerCase() === label.toLowerCase());
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggle(contents, setContents, label)}
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
                {contentOptions.length === 0 && <span className="text-[12px] text-system-700">制作内容がまだありません。下の入力欄から追加できます</span>}
              </div>
              <div
                className="mt-2 flex items-center gap-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
                    e.preventDefault();
                    void handleAddContent();
                  }
                }}
              >
                <Input value={newContentLabel} onChange={setNewContentLabel} placeholder="新しい制作内容" className="!w-56" />
                <button
                  type="button"
                  onClick={() => void handleAddContent()}
                  disabled={addingContent}
                  className="rounded-[6px] border border-border-light px-2 py-1 text-[11px] text-fg-muted transition-colors hover:border-primary hover:text-white"
                >
                  追加
                </button>
              </div>
            </div>
            <div>
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
                      setToolOptions((prev) => [...prev, { id: res.id!, name, icon_url: null, slug: null }]);
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
            </div>

            <FormGroupHeader>詳細ページ・左パネル設定</FormGroupHeader>
            <div ref={breakdownFieldRef} className={ringClass("breakdown")}>
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
            <div>
              <p className="mb-3 text-[11px] text-fg-muted">公開ページの作品詳細・左パネル（期間の行）の全画面アイコンからモーダルで表示されます。工程が 0 件ならアイコンは出ません。右上の「保存」で反映。</p>
              <TimelineGanttEditor
                value={parsedTimeline ?? EMPTY_TIMELINE}
                onChange={(v) => {
                  setField("timeline", (v.phases.length ? v : null) as unknown as Work["timeline"]);
                }}
                onInsertTemplate={() => setField("timeline", DEFAULT_TIMELINE as unknown as Work["timeline"])}
                period={period}
                disabled={saving}
                onPeriodChange={(p) => {
                  setPeriod(p);
                  markDirty();
                }}
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
            <div>
              <p className="mb-3 text-[11px] text-fg-muted">公開ページの作品詳細・左パネル（体制の行）の全画面アイコンからモーダルで表示されます。グループが 0 件ならアイコンは出ません。右上の「保存」で反映。</p>
              <StakeholdersDiagramEditor
                iconCatalog={iconCatalog}
                value={parsedStakeholders ?? { groups: [] }}
                onChange={(v) => setField("stakeholders", (v.groups.length ? v : null) as unknown as Work["stakeholders"])}
              />
            </div>

            <FormGroupHeader>本文</FormGroupHeader>
            <div ref={bodyFieldRef} className={`flex flex-col gap-2 ${ringClass("body")}`}>
              {/^:::\s*(timeline|stakeholders)\b/m.test(markdown) && (
                <p className="text-[11px] text-fg-muted">本文に「::: timeline」「::: stakeholders」の行があります。この行は現在は表示に使われません（Timeline / Stakeholders は上の設定欄で編集）。</p>
              )}
              <RichMarkdownEditor
                value={markdown}
                onChange={(md) => {
                  setMarkdown(md);
                  markDirty();
                }}
                onPickImage={pickImage}
                onPickFlowchart={pickFlowchart}
                onPickWork={pickWork}
                onUploadImage={async (file) => {
                  const fd = new FormData();
                  fd.append("file", await compressImage(file));
                  const { url, error } = await uploadStorageImage(fd, "projects/sections");
                  return { url, error };
                }}
                mode={bodyMode}
                onModeChange={setBodyMode}
                className="h-[640px]"
              />
            </div>
          </div>
          </div>
          <div className="h-[640px] w-full shrink-0 xl:h-auto xl:min-h-0 xl:w-1/2 xl:shrink">
            <PreviewPane device={settingsDevice}>
              {previewWork && (
                <div className="flex flex-col gap-12 text-white">
                  <WorkDetailHeader
                    work={previewWork}
                    contents={contents}
                    tools={previewTools}
                    screenshots={previewScreenshots}
                    onEdit={handlePreviewEdit}
                  />
                  <WorkDetailContent work={previewWork} onEditSection={handleEditSection} />
                  <section className="flex flex-col gap-3">
                    <p className="text-[11px] text-fg-muted">一覧カードでの見え方</p>
                    <div className="max-w-[339px]">
                      <WorkCard
                        category={previewWork.category}
                        title={previewWork.title}
                        contents={contents}
                        period={workPeriodLabel(previewWork)}
                        image={previewWork.thumbnail_url ?? DEFAULT_IMAGE}
                        thumbnail={parseThumbnail(previewWork.thumbnail)}
                        serviceName={previewWork.hero_brand}
                      />
                    </div>
                  </section>
                  <p className="text-[11px] text-fg-muted">
                    担当経歴（Career）の紐付けはトップページの経歴欄に出るため、ここには表示しません
                  </p>
                </div>
              )}
            </PreviewPane>
          </div>
          </div>
        </div>

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
      <WorkPickerModal
        open={workPickerOpen}
        onClose={() => closeWorkPicker(null)}
        onSelect={closeWorkPicker}
        excludeId={id}
      />
      {vizPreview && (
        <WorkVizModal kind={vizPreview} timeline={parsedTimeline} period={periodFromInputs(period)} stakeholders={parsedStakeholders} onClose={() => setVizPreview(null)} />
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
