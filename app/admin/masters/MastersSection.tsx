"use client";

import { type MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import ServiceLogo from "@/components/ServiceLogo";
import {
  FieldLabel,
  FormGroupHeader,
  ImagePickerField,
  Input,
} from "../AdminLayout";
import SectionTitle from "../SectionTitle";
import ProtectedImage from "@/components/ProtectedImage";
import Tag from "@/components/Tag";
import { WORK_CATEGORY_PRESET_HUES } from "@/lib/work-category-color";
import {
  addNameMaster,
  addContentVocab,
  addToolVocab,
  addWorkCategory,
  checkWorkCategoryDeletable,
  deleteCompany,
  deletePhaseName,
  deleteRole,
  deleteContentVocab,
  deleteToolVocab,
  deleteWorkCategory,
  listMasterCompanies,
  listMasterPhaseNames,
  listMasterRoles,
  listMasterContents,
  listMasterTools,
  listWorkCategories,
  renameNameMaster,
  renameContentVocab,
  renameWorkCategory,
  setWorkCategoryColor,
  updateToolVocab,
  type MasterCompany,
  type MasterPhaseName,
  type MasterRole,
  type MasterContent,
  type MasterTool,
  type NameMasterTable,
  type WorkCategory,
} from "../actions";
import { TOOL_CATEGORY_KEYS } from "./toolCategories";
import NameMasterList from "./NameMasterList";

const smallButton =
  "shrink-0 rounded-[6px] border border-border-light px-3 py-1 text-[11px] text-fg-muted transition-colors hover:border-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40";
const dangerButton =
  "shrink-0 rounded-[6px] px-2 py-1 text-[11px] text-system-700 hover:bg-danger-300/10 hover:text-danger-300 disabled:cursor-not-allowed disabled:opacity-40";
const selectClass =
  "w-full rounded-[8px] border border-border-light bg-[#1a1a1a] px-3 py-2 text-[14px] text-white outline-none transition-colors focus:border-primary";

/** カテゴリ色の指定欄: プリセット 8 色 + 「なし」+ 数値入力（0〜359）。変更はその場で保存する */
function CategoryColorControl({
  hue,
  disabled,
  onChange,
}: {
  hue: number | null;
  disabled: boolean;
  /** 保存して true、失敗（権限・通信・busy）なら false を返す */
  onChange: (hue: number | null) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(hue === null ? "" : String(hue));
  const inputRef = useRef<HTMLInputElement>(null);
  /** 保存せず、欄を保存済みの値へ戻す。badInput のとき React の値は変わらないので DOM も直接戻す */
  const revert = () => {
    const prev = hue === null ? "" : String(hue);
    setDraft(prev);
    if (inputRef.current) inputRef.current.value = prev;
  };
  /** 保存に失敗したら欄を元に戻す（成功時は親の key 差し替えで作り直される） */
  const save = async (next: number | null) => {
    if (!(await onChange(next))) revert();
  };
  const commit = () => {
    // type="number" は「e」「-」などの不正入力を value="" で返す（空欄と区別できない）。
    // そのまま空欄扱いにすると保存済みの色が消えるので、badInput は保存せず元に戻す
    if (inputRef.current?.validity.badInput) {
      revert();
      return;
    }
    const trimmed = draft.trim();
    if (trimmed === "") {
      if (hue !== null) void save(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 0 || n > 359) {
      revert();
      return;
    }
    if (n !== hue) void save(n);
  };
  /** 見本・「なし」を押すとき、数値欄の blur（＝打ちかけの値の保存）を起こさない。打ちかけは捨てて押した色を優先する */
  const keepFocus = (e: MouseEvent) => e.preventDefault();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {WORK_CATEGORY_PRESET_HUES.map((h) => (
        <button
          key={h}
          type="button"
          aria-label={`色相 ${h}`}
          disabled={disabled}
          onMouseDown={keepFocus}
          onClick={() => {
            revert();
            void save(h);
          }}
          aria-pressed={hue === h}
          title={`色相 ${h}`}
          className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[12px] font-bold leading-none transition-transform disabled:cursor-not-allowed disabled:opacity-40 ${hue === h ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#1a1a1a]" : "opacity-70 hover:opacity-100"}`}
          style={{ backgroundColor: `oklch(0.30 0.06 ${h})`, color: `oklch(0.88 0.09 ${h})`, boxShadow: `inset 0 0 0 2px oklch(0.88 0.09 ${h})` }}
        >
          {/* 選択中だけチェックを出す（リングだけでは暗い地で見分けにくい） */}
          {hue === h ? "✓" : ""}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onMouseDown={keepFocus}
        onClick={() => {
          revert();
          void save(null);
        }}
        className={`${smallButton} ${hue === null ? "border-primary text-white" : ""}`}
      >
        なし
      </button>
      <input
        ref={inputRef}
        type="number"
        min={0}
        max={359}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        // フォーカス中のホイールで値が動く（Chrome の標準動作）のを防ぐ。ホイール前にフォーカスを外す
        onWheel={(e) => e.currentTarget.blur()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        aria-label="色相（0〜359）"
        className="w-16 rounded-[6px] border border-border-light bg-[#1a1a1a] px-2 py-1 text-[11px] text-white outline-none focus:border-primary"
      />
    </div>
  );
}

type ToolDraft = { name: string; slug: string; category: string; icon_url: string };

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

export default function MastersSection({ logoSlugs }: { logoSlugs: string[] }) {
  const [tools, setTools] = useState<MasterTool[]>([]);
  const [contents, setContents] = useState<MasterContent[]>([]);
  const [fetching, setFetching] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newToolName, setNewToolName] = useState("");
  const [newContentLabel, setNewContentLabel] = useState("");
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [toolDraft, setToolDraft] = useState<ToolDraft>({ name: "", slug: "", category: "", icon_url: "" });
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [contentDraft, setContentDraft] = useState("");
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");

  const [companies, setCompanies] = useState<MasterCompany[]>([]);
  const [roles, setRoles] = useState<MasterRole[]>([]);
  const [phaseNames, setPhaseNames] = useState<MasterPhaseName[]>([]);

  const refresh = useCallback(async () => {
    const [t, s, c, co, ro, ph] = await Promise.all([
      listMasterTools(),
      listMasterContents(),
      listWorkCategories(),
      listMasterCompanies(),
      listMasterRoles(),
      listMasterPhaseNames(),
    ]);
    if (!t.error) setTools(t.data);
    if (!s.error) setContents(s.data);
    if (!c.error) setCategories(c.data);
    if (!co.error) setCompanies(co.data);
    if (!ro.error) setRoles(ro.data);
    if (!ph.error) setPhaseNames(ph.data);
    setError(t.error ?? s.error ?? c.error ?? co.error ?? ro.error ?? ph.error);
  }, []);

  useEffect(() => {
    let cancelled = false;
    refresh().then(() => {
      if (!cancelled) setFetching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  /** busy ガード付きで操作を実行し、成功なら再読込、失敗ならエラー表示 */
  const run = async (
    action: () => Promise<{ error: string | null }>,
    onSuccess?: () => void,
  ): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    try {
      const res = await action();
      if (res.error) {
        setError(res.error);
        return false;
      }
      onSuccess?.();
      await refresh();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const handleAddTool = () => {
    if (!newToolName.trim()) return;
    void run(() => addToolVocab(newToolName), () => setNewToolName(""));
  };

  const startEditTool = (t: MasterTool) => {
    setEditingToolId(t.id);
    setToolDraft({
      name: t.name,
      slug: t.slug ?? "",
      category: t.category ?? "",
      icon_url: t.icon_url ?? "",
    });
  };

  const handleSaveTool = (id: string) => {
    void run(
      () =>
        updateToolVocab(id, {
          name: toolDraft.name,
          slug: toolDraft.slug || null,
          category: toolDraft.category || null,
          icon_url: toolDraft.icon_url || null,
        }),
      () => setEditingToolId(null),
    );
  };

  const handleDeleteTool = (t: MasterTool) => {
    if (!window.confirm(`ツール「${t.name}」を削除しますか？`)) return;
    void run(() => deleteToolVocab(t.id));
  };

  const handleAddContent = () => {
    if (!newContentLabel.trim()) return;
    void run(() => addContentVocab(newContentLabel), () => setNewContentLabel(""));
  };

  const handleSaveContent = (id: string) => {
    void run(() => renameContentVocab(id, contentDraft), () => setEditingContentId(null));
  };

  const handleDeleteContent = (s: MasterContent) => {
    if (!window.confirm(`制作内容「${s.label}」を削除しますか？`)) return;
    void run(() => deleteContentVocab(s.id));
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    void run(() => addWorkCategory(newCategoryName), () => setNewCategoryName(""));
  };

  const handleSaveCategory = (id: string) => {
    void run(() => renameWorkCategory(id, categoryDraft), () => setEditingCategoryId(null));
  };

  const handleDeleteCategory = async (c: WorkCategory) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const usage = await checkWorkCategoryDeletable(c.name);
      if (usage.error) {
        setError(usage.error);
        return;
      }
      if (!window.confirm(`カテゴリ「${c.name}」を削除しますか？`)) return;
      const res = await deleteWorkCategory(c.id);
      if (res.error) setError(res.error);
      else await refresh();
    } finally {
      setBusy(false);
    }
  };

  const addName = (table: NameMasterTable) => async (name: string) => {
    const trimmed = name.trim();
    let existed = false;
    const ok = await run(async () => {
      const res = await addNameMaster(table, name);
      existed = !!res.existed;
      return res;
    });
    if (ok && existed) setError(`「${trimmed}」はすでにあります`);
    return ok && !existed;
  };

  const renameName = (table: NameMasterTable) => (id: string, name: string) =>
    run(() => renameNameMaster(table, id, name));

  const handleDeleteName = (label: string, remove: (id: string) => Promise<{ error: string | null }>) =>
    (item: { id: string; name: string }) => {
      if (!window.confirm(`${label}「${item.name}」を削除しますか？`)) return;
      void run(() => remove(item.id));
    };

  const handleDeleteRole = (item: { id: string; name: string }) => {
    const role = roles.find((r) => r.id === item.id);
    if (!role) return;
    const message =
      role.careerCount + role.workCount + role.breakdownCount > 0
        ? `役割「${role.name}」は 経歴 ${role.careerCount} 件 / 作品の担当役割 ${role.workCount} 件 / 体制内訳 ${role.breakdownCount} 件で使われています。\n削除するとこれらから外れ、公開ページの表示も変わります（経歴は文字が残ります）。削除しますか？`
        : `役割「${role.name}」を削除しますか？`;
    if (!window.confirm(message)) return;
    void run(() => deleteRole(item.id));
  };

  if (fetching) return <div className="h-64 animate-pulse rounded-[12px] bg-[#1a1a1a]" />;

  return (
    <section id="masters" className="scroll-mt-8">
      <SectionTitle label="Masters" title="マスタ管理" />
      <p className="mb-6 text-[13px] text-fg-muted">
        ツール・制作内容・作品カテゴリ・会社・役割・工程名の語彙を管理します。使われている語彙は削除できません（役割だけは使用中でも確認のうえ削除できます）。
      </p>
      {error && <p className="mb-4 text-[13px] text-danger-300">{error}</p>}

      <FormGroupHeader>ツール（tools_vocab）</FormGroupHeader>
      <div className="mt-3 flex items-center gap-2" onKeyDown={onEnter(handleAddTool)}>
        <Input value={newToolName} onChange={setNewToolName} placeholder="新しいツール名" />
        <button
          type="button"
          onClick={handleAddTool}
          disabled={busy || !newToolName.trim()}
          className={smallButton}
        >
          追加
        </button>
      </div>
      <ul className="mt-3 mb-10 flex flex-col gap-2">
        {tools.map((t) => {
          const used = t.workCount + t.skillCount > 0;
          if (editingToolId === t.id) {
            return (
              <li
                key={t.id}
                className="grid grid-cols-2 gap-3 rounded-[8px] border border-primary/40 bg-surface p-3"
              >
                <div>
                  <FieldLabel>ツール名</FieldLabel>
                  <div onKeyDown={onEnter(() => handleSaveTool(t.id))}>
                    <Input value={toolDraft.name} onChange={(v) => setToolDraft((d) => ({ ...d, name: v }))} />
                  </div>
                </div>
                <div>
                  <FieldLabel>ロゴ（public/logos）</FieldLabel>
                  <select
                    value={toolDraft.slug}
                    onChange={(e) => setToolDraft((d) => ({ ...d, slug: e.target.value }))}
                    className={selectClass}
                  >
                    <option value="">（なし）</option>
                    {toolDraft.slug && !logoSlugs.includes(toolDraft.slug) && (
                      <option value={toolDraft.slug}>{toolDraft.slug}（未登録）</option>
                    )}
                    {logoSlugs.map((s) => {
                      const takenBy = tools.find((o) => o.id !== t.id && o.slug === s)?.name;
                      return (
                        <option key={s} value={s} disabled={!!takenBy}>
                          {`${s}${takenBy ? `（${takenBy} で使用中）` : ""}`}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <FieldLabel>カテゴリー（ロゴが無いときのアイコン）</FieldLabel>
                  <select
                    value={toolDraft.category}
                    onChange={(e) => setToolDraft((d) => ({ ...d, category: e.target.value }))}
                    className={selectClass}
                  >
                    <option value="">（なし）</option>
                    {toolDraft.category &&
                      !(TOOL_CATEGORY_KEYS as readonly string[]).includes(toolDraft.category) && (
                        <option value={toolDraft.category}>{toolDraft.category}（未登録）</option>
                      )}
                    {TOOL_CATEGORY_KEYS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <FieldLabel>アイコン画像（Works 詳細で表示）</FieldLabel>
                  <ImagePickerField
                    value={toolDraft.icon_url}
                    onChange={(v) => setToolDraft((d) => ({ ...d, icon_url: v }))}
                    folder="tools/icons"
                    previewClassName="mt-2 h-10 w-10 rounded-[6px] object-contain"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <button type="button" onClick={() => handleSaveTool(t.id)} disabled={busy} className={smallButton}>
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingToolId(null)}
                    disabled={busy}
                    className={smallButton}
                  >
                    キャンセル
                  </button>
                </div>
              </li>
            );
          }
          return (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-[8px] border border-border-light bg-surface px-3 py-2"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[11px] text-system-700">
                {t.icon_url ? (
                  <ProtectedImage src={t.icon_url} alt="" className="h-5 w-5 object-contain" />
                ) : t.slug && logoSlugs.includes(t.slug) ? (
                  <ServiceLogo name={t.slug} className="h-5 w-5 object-contain" />
                ) : (
                  "—"
                )}
              </span>
              <span className="flex-1 text-[13px] text-white">{t.name}</span>
              <span className="text-[11px] text-fg-muted">{t.slug ?? "slug なし"}</span>
              <span className="text-[11px] text-fg-muted">{t.category ?? "カテゴリーなし"}</span>
              <span className="text-[11px] text-fg-muted">
                {used ? `使用中（作品 ${t.workCount} 件 / スキル項目 ${t.skillCount} 件）` : "未使用"}
              </span>
              <button type="button" onClick={() => startEditTool(t)} disabled={busy} className={smallButton}>
                編集
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTool(t)}
                disabled={busy || used}
                title={used ? "使用中のため削除できません" : undefined}
                className={dangerButton}
              >
                削除
              </button>
            </li>
          );
        })}
      </ul>

      <FormGroupHeader>制作内容（contents_vocab）</FormGroupHeader>
      <div className="mt-3 flex items-center gap-2" onKeyDown={onEnter(handleAddContent)}>
        <Input value={newContentLabel} onChange={setNewContentLabel} placeholder="新しい制作内容" />
        <button
          type="button"
          onClick={handleAddContent}
          disabled={busy || !newContentLabel.trim()}
          className={smallButton}
        >
          追加
        </button>
      </div>
      <ul className="mt-3 mb-10 flex flex-col gap-2">
        {contents.map((s) => {
          const used = s.workCount > 0;
          if (editingContentId === s.id) {
            return (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-[8px] border border-primary/40 bg-surface p-3"
              >
                <div className="min-w-0 flex-1" onKeyDown={onEnter(() => handleSaveContent(s.id))}>
                  <Input value={contentDraft} onChange={setContentDraft} />
                </div>
                <button type="button" onClick={() => handleSaveContent(s.id)} disabled={busy} className={smallButton}>
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => setEditingContentId(null)}
                  disabled={busy}
                  className={smallButton}
                >
                  キャンセル
                </button>
              </li>
            );
          }
          return (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-[8px] border border-border-light bg-surface px-3 py-2"
            >
              <span className="flex-1 text-[13px] text-white">{s.label}</span>
              <span className="text-[11px] text-fg-muted">
                {used ? `使用中（作品 ${s.workCount} 件）` : "未使用"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingContentId(s.id);
                  setContentDraft(s.label);
                }}
                disabled={busy}
                className={smallButton}
              >
                名前変更
              </button>
              <button
                type="button"
                onClick={() => handleDeleteContent(s)}
                disabled={busy || used}
                title={used ? "使用中のため削除できません" : undefined}
                className={dangerButton}
              >
                削除
              </button>
            </li>
          );
        })}
      </ul>

      <FormGroupHeader>作品カテゴリ（work_categories）</FormGroupHeader>
      <div className="mt-3 flex items-center gap-2" onKeyDown={onEnter(handleAddCategory)}>
        <Input value={newCategoryName} onChange={setNewCategoryName} placeholder="新しいカテゴリ名" />
        <button
          type="button"
          onClick={handleAddCategory}
          disabled={busy || !newCategoryName.trim()}
          className={smallButton}
        >
          追加
        </button>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {categories.map((c) => {
          if (editingCategoryId === c.id) {
            return (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-[8px] border border-primary/40 bg-surface p-3"
              >
                <div className="min-w-0 flex-1" onKeyDown={onEnter(() => handleSaveCategory(c.id))}>
                  <Input value={categoryDraft} onChange={setCategoryDraft} />
                </div>
                <button type="button" onClick={() => handleSaveCategory(c.id)} disabled={busy} className={smallButton}>
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCategoryId(null)}
                  disabled={busy}
                  className={smallButton}
                >
                  キャンセル
                </button>
              </li>
            );
          }
          return (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-[8px] border border-border-light bg-surface px-3 py-2"
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-[13px] text-white">{c.name}</span>
                {/* 公開サイトでの見え方（作品カードと同じ sm） */}
                <Tag variant="category" size="sm" label={c.name} hue={c.color_hue} className="min-w-0" />
                <CategoryColorControl
                  key={c.color_hue ?? "none"}
                  hue={c.color_hue}
                  disabled={busy}
                  onChange={(hue) => run(() => setWorkCategoryColor(c.id, hue))}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingCategoryId(c.id);
                  setCategoryDraft(c.name);
                }}
                disabled={busy}
                className={smallButton}
              >
                名前変更
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteCategory(c)}
                disabled={busy}
                className={dangerButton}
              >
                削除
              </button>
            </li>
          );
        })}
      </ul>

      <NameMasterList
        title="会社（companies）"
        placeholder="新しい会社名"
        items={companies.map((c) => ({
          id: c.id,
          name: c.name,
          usage: `経歴 ${c.careerCount} 件`,
          used: c.careerCount > 0,
        }))}
        busy={busy}
        onAdd={addName("companies")}
        onRename={renameName("companies")}
        onDelete={handleDeleteName("会社", deleteCompany)}
      />

      <NameMasterList
        title="役割（roles）"
        placeholder="新しい役割名"
        hint="作品の担当役割・体制内訳で使う役割名には「・」「、」「,」や半角数字を入れないでください（公開ページで分割されます）"
        items={roles.map((r) => ({
          id: r.id,
          name: r.name,
          usage: `経歴 ${r.careerCount} / 作品 ${r.workCount} / 体制内訳 ${r.breakdownCount}`,
          used: r.careerCount + r.workCount + r.breakdownCount > 0,
        }))}
        busy={busy}
        onAdd={addName("roles")}
        onRename={renameName("roles")}
        onDelete={handleDeleteRole}
        allowDeleteUsed
      />

      <NameMasterList
        title="工程名（phase_names）"
        placeholder="新しい工程名"
        items={phaseNames.map((p) => ({
          id: p.id,
          name: p.name,
          usage: `作品 ${p.workCount} 件`,
          used: p.workCount > 0,
        }))}
        busy={busy}
        onAdd={addName("phase_names")}
        onRename={renameName("phase_names")}
        onDelete={handleDeleteName("工程名", deletePhaseName)}
      />
    </section>
  );
}
