import { supabase } from "@/src/lib/supabase";
import {
  upsertSkillVocab,
  upsertToolVocab,
  setExperienceTools,
} from "@/src/lib/skills-tools-client";
import type { Json, Tables } from "@/src/types/supabase";
import { parseTimeline } from "@/components/WorkViz";
import {
  clearFlowchartCache,
  type FlowchartData,
} from "@/lib/flowchart";

// ─── Storage ──────────────────────────────────────────────────────────────────

export type StorageImage = { name: string; path: string; url: string };

async function listFolderRecursive(prefix: string): Promise<StorageImage[]> {
  const results: StorageImage[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage
      .from("Portfolio")
      .list(prefix, { limit: pageSize, offset });
    if (error) throw new Error(error.message);
    if (!data) throw new Error("画像一覧を取得できませんでした");
    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.metadata) {
        const { data: urlData } = supabase.storage
          .from("Portfolio")
          .getPublicUrl(fullPath);
        results.push({ name: item.name, path: fullPath, url: urlData.publicUrl });
      } else {
        results.push(...(await listFolderRecursive(fullPath)));
      }
    }
    if (data.length < pageSize) break;
  }
  return results;
}

export async function listStorageImages(): Promise<{
  data: StorageImage[];
  error: string | null;
}> {
  try {
    const images = await listFolderRecursive("");
    return { data: images, error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : String(e) };
  }
}
export async function uploadStorageImage(
  formData: FormData,
  folder: string,
): Promise<{ url: string | null; path: string | null; error: string | null }> {
  try {
    const file = formData.get("file") as File;
    if (!file) return { url: null, path: null, error: "ファイルが見つかりません" };
    const ext = file.name.split(".").pop() ?? "bin";
    const base = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_\-]/g, "_");
    const filename = `${base}_${Date.now()}.${ext}`;
    const path = folder ? `${folder}/${filename}` : filename;
    const arrayBuffer = await file.arrayBuffer();
    const { error } = await supabase.storage
      .from("Portfolio")
      .upload(path, arrayBuffer, { contentType: file.type, upsert: false });
    if (error) return { url: null, path: null, error: error.message };
    const { data: urlData } = supabase.storage.from("Portfolio").getPublicUrl(path);
    return { url: urlData.publicUrl, path, error: null };
  } catch (e) {
    return { url: null, path: null, error: e instanceof Error ? e.message : String(e) };
  }
}

type WorkRow = Tables<"works">;
export type FlowchartRow = Tables<"flowcharts">;

// ─── flowcharts CRUD ──────────────────────────────────────────────────────────

export async function listFlowcharts(): Promise<{
  data: FlowchartRow[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from("flowcharts")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) return { data: [], error: error.message };
    return { data: data ?? [], error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getFlowchart(id: string): Promise<{
  data: FlowchartRow | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from("flowcharts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function saveFlowchart(payload: {
  id?: string;
  title: string;
  description?: string | null;
  data: FlowchartData;
}): Promise<{ data: FlowchartRow | null; error: string | null }> {
  try {
    const values = {
      title: payload.title.trim() || "無題のフローチャート",
      description: payload.description?.trim() || null,
      data: payload.data as unknown as Json,
      updated_at: new Date().toISOString(),
    };
    const query = payload.id
      ? supabase
          .from("flowcharts")
          .upsert({ id: payload.id, ...values }, { onConflict: "id" })
      : supabase.from("flowcharts").insert(values);
    const { data, error } = await query.select().single();
    if (error) return { data: null, error: error.message };
    clearFlowchartCache(data.id);
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteFlowchart(
  id: string,
): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase.from("flowcharts").delete().eq("id", id).select("id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "フローチャートを削除できませんでした（権限またはデータを確認してください）" };
    clearFlowchartCache(id);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function duplicateFlowchart(id: string): Promise<{
  data: FlowchartRow | null;
  error: string | null;
}> {
  try {
    const current = await getFlowchart(id);
    if (current.error || !current.data) {
      return {
        data: null,
        error: current.error ?? "複製元のフローチャートが見つかりません",
      };
    }
    const { data, error } = await supabase
      .from("flowcharts")
      .insert({
        title: `${current.data.title}（コピー）`,
        description: current.data.description,
        data: current.data.data,
      })
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 作品・スキル・ツール・担当役割・体制内訳を一つの DB トランザクションで保存する。
 * stakeholderCounts が null のときは旧形式の体制内訳（文字のまま）として保存する。
 */
export async function saveWork(
  payload: WorkRow,
  skills: string[],
  tools: string[],
  roleIds: string[],
  stakeholderCounts: { role_id: string; headcount: number }[] | null,
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc("save_work_with_relations", {
      p_work: payload as unknown as Json,
      p_skill_labels: skills,
      p_tool_names: tools,
      p_role_ids: roleIds,
      p_stakeholder_counts: stakeholderCounts as unknown as Json,
    });
    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

/** 作品を 1 件削除する。権限は Supabase RLS が判定する。 */
export async function deleteWork(id: string): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase.from("works").delete().eq("id", id).select("id");
    if (error) return { error: error.message || error.code || String(error) };
    if (!data?.length) return { error: "作品を削除できませんでした（権限またはデータを確認してください）" };
    return { error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

/**
 * Works の公開 / 非公開だけを即時更新する（一覧・編集ヘッダーのスイッチ用）
 * RLS で拒否されるとエラーなしで 0 行更新になるため、更新行が無ければ失敗として返す。
 */
export async function setWorkPublished(
  id: string,
  isPublished: boolean
): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("works")
      .update({ is_published: isPublished })
      .eq("id", id)
      .select("id");
    if (error) return { error: error.message || error.code || String(error) };
    if (!data?.length) {
      return { error: "公開状態を更新できませんでした（権限またはデータが見つかりません）" };
    }
    return { error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

// ─── Work categories ──────────────────────────────────────────────────────────

export type WorkCategory = { id: string; name: string; sort_order: number };

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function listWorkCategories(): Promise<{
  data: WorkCategory[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from("work_categories")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) return { data: [], error: error.message || error.code || String(error) };
    return { data: data ?? [], error: null };
  } catch (e) {
    return { data: [], error: errMsg(e) };
  }
}

/** 同名がすでにあればその行を返す（重複は作らない）。RLS 拒否は 0 行で返るため失敗として扱う。 */
export async function addWorkCategory(
  name: string
): Promise<{ error: string | null; category?: WorkCategory }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "カテゴリ名を入力してください" };
  try {
    const { data: existing, error: findError } = await supabase
      .from("work_categories")
      .select("id, name, sort_order")
      .eq("name", trimmed)
      .limit(1);
    if (findError) return { error: findError.message || findError.code || String(findError) };
    if (existing?.length) return { error: null, category: existing[0] };

    const { data: last, error: maxError } = await supabase
      .from("work_categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);
    if (maxError) return { error: maxError.message || maxError.code || String(maxError) };
    const next = (last?.[0]?.sort_order ?? 0) + 1;

    const { data, error } = await supabase
      .from("work_categories")
      .insert({ name: trimmed, sort_order: next })
      .select("id, name, sort_order");
    if (error) return { error: error.message || error.code || String(error) };
    if (!data?.length) {
      return { error: "カテゴリを追加できませんでした（権限がありません）" };
    }
    return { error: null, category: data[0] };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

/** 名前変更は DB 関数で work_categories と works.category を同時に更新する。 */
export async function renameWorkCategory(
  id: string,
  name: string
): Promise<{ error: string | null }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "カテゴリ名を入力してください" };
  try {
    const { data: dup, error: dupError } = await supabase
      .from("work_categories")
      .select("id")
      .eq("name", trimmed)
      .neq("id", id)
      .limit(1);
    if (dupError) return { error: dupError.message || dupError.code || String(dupError) };
    if (dup?.length) return { error: "同じ名前のカテゴリがすでにあります" };

    const { error } = await supabase.rpc("rename_work_category", {
      p_id: id,
      p_name: trimmed,
    });
    if (error) return { error: error.message || error.code || String(error) };
    return { error: null };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

/**
 * カテゴリを使っている作品があれば、削除できない理由を返す（確認ダイアログより前に呼ぶ）。
 */
export async function checkWorkCategoryDeletable(name: string): Promise<{ error: string | null }> {
  try {
    const { count, error } = await supabase
      .from("works")
      .select("id", { count: "exact", head: true })
      .eq("category", name);
    if (error) return { error: error.message || error.code || String(error) };
    if ((count ?? 0) > 0) {
      return { error: `このカテゴリは ${count} 件の作品で使われているため削除できません` };
    }
    return { error: null };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

/** 作品で使われているカテゴリは削除させない。RLS 拒否は 0 行で返るため失敗として扱う。 */
export async function deleteWorkCategory(id: string): Promise<{ error: string | null }> {
  try {
    const { data: found, error: findError } = await supabase
      .from("work_categories")
      .select("name")
      .eq("id", id)
      .limit(1);
    if (findError) return { error: findError.message || findError.code || String(findError) };
    const name = found?.[0]?.name;
    if (!name) return { error: "カテゴリが見つかりません" };

    const usage = await checkWorkCategoryDeletable(name);
    if (usage.error) return usage;

    const { data, error } = await supabase
      .from("work_categories")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) return { error: error.message || error.code || String(error) };
    if (!data?.length) {
      return { error: "カテゴリを削除できませんでした（権限がありません）" };
    }
    return { error: null };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

// ─── Masters (tools_vocab / skills_vocab) ─────────────────────────────────────

export type MasterTool = {
  id: string; name: string; slug: string | null; category: string | null;
  icon_url: string | null; workCount: number; skillCount: number;
};
export type MasterSkill = { id: string; label: string; workCount: number };

function dbErr(error: { message?: string; code?: string }): string {
  return error.message || error.code || String(error);
}

function countBy(rows: { [k: string]: string | null }[] | null, key: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows ?? []) {
    const v = r[key];
    if (v == null) continue;
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return m;
}

/** PostgREST の 1 回あたりの行数上限（既定 1000）を超えても全件を読む */
async function fetchAllIds(
  table: "work_tools" | "skill_experience_tools" | "work_skills" | "career_items" | "work_roles" | "work_stakeholder_counts",
  column: "tool_id" | "skill_id" | "company_id" | "role_id",
): Promise<{ data: { [k: string]: string | null }[]; error: { message?: string; code?: string } | null }> {
  const PAGE = 1000;
  const all: { [k: string]: string | null }[] = [];
  for (let from = 0; ; from += PAGE) {
    // テーブルごとに列が異なるため、型の組み合わせ検査を外す（列名は呼び出し側で正しく渡す）
    const q = supabase.from(table as "work_tools").select(column as "tool_id");
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) return { data: [], error };
    const rows = (data ?? []) as unknown as { [k: string]: string | null }[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return { data: all, error: null };
}

export async function listMasterTools(): Promise<{ data: MasterTool[]; error: string | null }> {
  try {
    const [tools, wt, st] = await Promise.all([
      supabase.from("tools_vocab").select("id, name, slug, category, icon_url").order("name"),
      fetchAllIds("work_tools", "tool_id"),
      fetchAllIds("skill_experience_tools", "tool_id"),
    ]);
    const err = tools.error ?? wt.error ?? st.error;
    if (err) return { data: [], error: dbErr(err) };
    const workCounts = countBy(wt.data, "tool_id");
    const skillCounts = countBy(st.data, "tool_id");
    return {
      data: (tools.data ?? []).map((t) => ({
        ...t,
        workCount: workCounts.get(t.id) ?? 0,
        skillCount: skillCounts.get(t.id) ?? 0,
      })),
      error: null,
    };
  } catch (e) {
    return { data: [], error: errMsg(e) };
  }
}

export async function listMasterSkills(): Promise<{ data: MasterSkill[]; error: string | null }> {
  try {
    const [skills, ws] = await Promise.all([
      supabase.from("skills_vocab").select("id, label").order("label"),
      fetchAllIds("work_skills", "skill_id"),
    ]);
    const err = skills.error ?? ws.error;
    if (err) return { data: [], error: dbErr(err) };
    const counts = countBy(ws.data, "skill_id");
    return {
      data: (skills.data ?? []).map((s) => ({ ...s, workCount: counts.get(s.id) ?? 0 })),
      error: null,
    };
  } catch (e) {
    return { data: [], error: errMsg(e) };
  }
}

async function hasToolNameConflict(
  name: string,
  excludeId?: string,
): Promise<{ error: string | null; conflict: boolean }> {
  const { data, error } = await supabase.from("tools_vocab").select("id, name");
  if (error) return { error: dbErr(error), conflict: false };
  const lower = name.toLowerCase();
  const conflict = (data ?? []).some(
    (r) => r.id !== excludeId && r.name.trim().toLowerCase() === lower,
  );
  return { error: null, conflict };
}

async function hasSkillLabelConflict(
  label: string,
  excludeId?: string,
): Promise<{ error: string | null; conflict: boolean }> {
  const { data, error } = await supabase.from("skills_vocab").select("id, label");
  if (error) return { error: dbErr(error), conflict: false };
  const lower = label.toLowerCase();
  const conflict = (data ?? []).some(
    (r) => r.id !== excludeId && r.label.trim().toLowerCase() === lower,
  );
  return { error: null, conflict };
}

export async function addToolVocab(name: string): Promise<{ error: string | null }> {
  try {
    const trimmed = name.trim();
    if (!trimmed) return { error: "ツール名を入力してください" };
    const dup = await hasToolNameConflict(trimmed);
    if (dup.error) return { error: dup.error };
    if (dup.conflict) return { error: "同じ名前のツールがすでにあります" };
    const { data, error } = await supabase.from("tools_vocab").insert({ name: trimmed }).select("id");
    if (error) return { error: dbErr(error) };
    if (!data?.length) return { error: "ツールを追加できませんでした（権限がありません）" };
    return { error: null };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function updateToolVocab(
  id: string,
  patch: { name: string; slug: string | null; category: string | null; icon_url: string | null },
): Promise<{ error: string | null }> {
  try {
    const name = patch.name.trim();
    if (!name) return { error: "ツール名を入力してください" };
    const dup = await hasToolNameConflict(name, id);
    if (dup.error) return { error: dup.error };
    if (dup.conflict) return { error: "同じ名前のツールがすでにあります" };

    const slug = patch.slug?.trim() || null;
    if (slug) {
      const { data: taken, error: slugErr } = await supabase
        .from("tools_vocab")
        .select("id, name")
        .eq("slug", slug)
        .neq("id", id)
        .limit(1);
      if (slugErr) return { error: dbErr(slugErr) };
      if (taken?.length) return { error: `このロゴ（slug）は「${taken[0].name}」で使われています` };
    }

    const { data, error } = await supabase
      .from("tools_vocab")
      .update({
        name,
        slug,
        category: patch.category?.trim() || null,
        icon_url: patch.icon_url?.trim() || null,
      })
      .eq("id", id)
      .select("id");
    if (error) return { error: dbErr(error) };
    if (!data?.length) return { error: "ツールを更新できませんでした（権限がありません）" };
    return { error: null };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

async function countToolUsage(
  id: string,
): Promise<{ error: string | null; workCount: number; skillCount: number }> {
  const [w, s] = await Promise.all([
    supabase.from("work_tools").select("tool_id", { count: "exact", head: true }).eq("tool_id", id),
    supabase
      .from("skill_experience_tools")
      .select("tool_id", { count: "exact", head: true })
      .eq("tool_id", id),
  ]);
  const err = w.error ?? s.error;
  if (err) return { error: dbErr(err), workCount: 0, skillCount: 0 };
  return { error: null, workCount: w.count ?? 0, skillCount: s.count ?? 0 };
}

export async function deleteToolVocab(id: string): Promise<{ error: string | null }> {
  try {
    const usage = await countToolUsage(id);
    if (usage.error) return { error: usage.error };
    if (usage.workCount + usage.skillCount > 0) {
      return {
        error: `このツールは作品 ${usage.workCount} 件 / スキル項目 ${usage.skillCount} 件で使われているため削除できません`,
      };
    }
    const { data, error } = await supabase.from("tools_vocab").delete().eq("id", id).select("id");
    if (error) return { error: dbErr(error) };
    if (!data?.length) return { error: "ツールを削除できませんでした（権限がありません）" };
    return { error: null };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function addSkillVocab(label: string): Promise<{ error: string | null }> {
  try {
    const trimmed = label.trim();
    if (!trimmed) return { error: "スキル名を入力してください" };
    const dup = await hasSkillLabelConflict(trimmed);
    if (dup.error) return { error: dup.error };
    if (dup.conflict) return { error: "同じ名前のスキルがすでにあります" };
    const { data, error } = await supabase.from("skills_vocab").insert({ label: trimmed }).select("id");
    if (error) return { error: dbErr(error) };
    if (!data?.length) return { error: "スキルを追加できませんでした（権限がありません）" };
    return { error: null };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function renameSkillVocab(id: string, label: string): Promise<{ error: string | null }> {
  try {
    const trimmed = label.trim();
    if (!trimmed) return { error: "スキル名を入力してください" };
    const dup = await hasSkillLabelConflict(trimmed, id);
    if (dup.error) return { error: dup.error };
    if (dup.conflict) return { error: "同じ名前のスキルがすでにあります" };
    const { data, error } = await supabase
      .from("skills_vocab")
      .update({ label: trimmed })
      .eq("id", id)
      .select("id");
    if (error) return { error: dbErr(error) };
    if (!data?.length) return { error: "スキルを更新できませんでした（権限がありません）" };
    return { error: null };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function deleteSkillVocab(id: string): Promise<{ error: string | null }> {
  try {
    const { count, error: countErr } = await supabase
      .from("work_skills")
      .select("skill_id", { count: "exact", head: true })
      .eq("skill_id", id);
    if (countErr) return { error: dbErr(countErr) };
    if ((count ?? 0) > 0) {
      return { error: `このスキルは作品 ${count} 件で使われているため削除できません` };
    }
    const { data, error } = await supabase.from("skills_vocab").delete().eq("id", id).select("id");
    if (error) return { error: dbErr(error) };
    if (!data?.length) return { error: "スキルを削除できませんでした（権限がありません）" };
    return { error: null };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

// ─── Masters (companies / roles / phase_names) ────────────────────────────────

export type NameMasterTable = "companies" | "roles" | "phase_names";
export type NameMaster = { id: string; name: string; sort_order: number };
export type MasterCompany = NameMaster & { careerCount: number };
export type MasterRole = NameMaster & { careerCount: number; workCount: number; breakdownCount: number };
export type MasterPhaseName = NameMaster & { workCount: number };

const NAME_LABEL = { companies: "会社名", roles: "役割名", phase_names: "工程名" } as const;
const NAME_NOUN = { companies: "会社", roles: "役割", phase_names: "工程名" } as const;
const RENAME_RPC = {
  companies: "rename_company",
  roles: "rename_role",
  phase_names: "rename_phase_name",
} as const;

export async function listNameMaster(
  table: NameMasterTable,
): Promise<{ data: NameMaster[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from(table as "roles")
      .select("id, name, sort_order")
      .order("sort_order")
      .order("name");
    if (error) return { data: [], error: dbErr(error) };
    return { data: data ?? [], error: null };
  } catch (e) {
    return { data: [], error: errMsg(e) };
  }
}

export async function addNameMaster(
  table: NameMasterTable,
  name: string,
): Promise<{ error: string | null; item?: NameMaster; existed?: boolean }> {
  try {
    const trimmed = name.trim();
    if (!trimmed) return { error: `${NAME_LABEL[table]}を入力してください` };
    const { data: all, error: listErr } = await supabase
      .from(table as "roles")
      .select("id, name, sort_order");
    if (listErr) return { error: dbErr(listErr) };
    const rows = all ?? [];
    const lower = trimmed.toLowerCase();
    const found = rows.find((r) => r.name.trim().toLowerCase() === lower);
    if (found) return { error: null, item: found, existed: true };
    const sortOrder = rows.reduce((m, r) => Math.max(m, r.sort_order), 0) + 1;
    const { data, error } = await supabase
      .from(table as "roles")
      .insert({ name: trimmed, sort_order: sortOrder })
      .select("id, name, sort_order");
    if (error) {
      if (error.code === "23505") {
        const pattern = trimmed.replace(/[\\%_]/g, (c) => "\\" + c);
        const { data: again, error: againErr } = await supabase
          .from(table as "roles")
          .select("id, name, sort_order")
          .ilike("name", pattern)
          .limit(1);
        if (againErr) return { error: dbErr(againErr) };
        if (again?.length) return { error: null, item: again[0], existed: true };
      }
      return { error: dbErr(error) };
    }
    if (!data?.length) return { error: `${NAME_NOUN[table]}を追加できませんでした（権限がありません）` };
    return { error: null, item: data[0] };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function renameNameMaster(
  table: NameMasterTable,
  id: string,
  name: string,
): Promise<{ error: string | null }> {
  try {
    const trimmed = name.trim();
    if (!trimmed) return { error: `${NAME_LABEL[table]}を入力してください` };
    const { data: all, error: listErr } = await supabase
      .from(table as "roles")
      .select("id, name");
    if (listErr) return { error: dbErr(listErr) };
    const lower = trimmed.toLowerCase();
    if ((all ?? []).some((r) => r.id !== id && r.name.trim().toLowerCase() === lower)) {
      return { error: `同じ名前の${NAME_NOUN[table]}がすでにあります` };
    }
    const { error } = await supabase.rpc(RENAME_RPC[table] as "rename_role", {
      p_id: id,
      p_name: trimmed,
    });
    if (error) return { error: dbErr(error) };
    return { error: null };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function listMasterCompanies(): Promise<{ data: MasterCompany[]; error: string | null }> {
  try {
    const [list, career] = await Promise.all([
      listNameMaster("companies"),
      fetchAllIds("career_items", "company_id"),
    ]);
    if (list.error) return { data: [], error: list.error };
    if (career.error) return { data: [], error: dbErr(career.error) };
    const counts = countBy(career.data, "company_id");
    return {
      data: list.data.map((c) => ({ ...c, careerCount: counts.get(c.id) ?? 0 })),
      error: null,
    };
  } catch (e) {
    return { data: [], error: errMsg(e) };
  }
}

export async function listMasterRoles(): Promise<{ data: MasterRole[]; error: string | null }> {
  try {
    const [list, career, works, breakdown] = await Promise.all([
      listNameMaster("roles"),
      fetchAllIds("career_items", "role_id"),
      fetchAllIds("work_roles", "role_id"),
      fetchAllIds("work_stakeholder_counts", "role_id"),
    ]);
    if (list.error) return { data: [], error: list.error };
    const err = career.error ?? works.error ?? breakdown.error;
    if (err) return { data: [], error: dbErr(err) };
    const careerCounts = countBy(career.data, "role_id");
    const workCounts = countBy(works.data, "role_id");
    const breakdownCounts = countBy(breakdown.data, "role_id");
    return {
      data: list.data.map((r) => ({
        ...r,
        careerCount: careerCounts.get(r.id) ?? 0,
        workCount: workCounts.get(r.id) ?? 0,
        breakdownCount: breakdownCounts.get(r.id) ?? 0,
      })),
      error: null,
    };
  } catch (e) {
    return { data: [], error: errMsg(e) };
  }
}

/** works.timeline の phases[].label ごとに、使っている作品数を数える（作品内の重複は 1 回） */
async function countPhaseLabelUsage(): Promise<{ error: string | null; counts: Map<string, number> }> {
  const counts = new Map<string, number>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("works")
      .select("timeline")
      .range(from, from + PAGE - 1);
    if (error) return { error: dbErr(error), counts };
    const rows = data ?? [];
    for (const row of rows) {
      const labels = new Set((parseTimeline(row.timeline)?.phases ?? []).map((p) => p.label));
      for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    if (rows.length < PAGE) break;
  }
  return { error: null, counts };
}

export async function listMasterPhaseNames(): Promise<{ data: MasterPhaseName[]; error: string | null }> {
  try {
    const [list, usage] = await Promise.all([listNameMaster("phase_names"), countPhaseLabelUsage()]);
    if (list.error) return { data: [], error: list.error };
    if (usage.error) return { data: [], error: usage.error };
    return {
      data: list.data.map((p) => ({ ...p, workCount: usage.counts.get(p.name) ?? 0 })),
      error: null,
    };
  } catch (e) {
    return { data: [], error: errMsg(e) };
  }
}

async function countRows(
  table: "career_items" | "work_roles" | "work_stakeholder_counts",
  column: "company_id" | "role_id",
  id: string,
): Promise<{ error: string | null; count: number }> {
  const { count, error } = await supabase
    .from(table as "work_roles")
    .select(column as "role_id", { count: "exact", head: true })
    .eq(column as "role_id", id);
  if (error) return { error: dbErr(error), count: 0 };
  return { error: null, count: count ?? 0 };
}

async function deleteNameMasterRow(
  table: NameMasterTable,
  id: string,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from(table as "roles")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: dbErr(error) };
  if (!data?.length) return { error: `${NAME_NOUN[table]}を削除できませんでした（権限がありません）` };
  return { error: null };
}

export async function deleteCompany(id: string): Promise<{ error: string | null }> {
  try {
    const c = await countRows("career_items", "company_id", id);
    if (c.error) return { error: c.error };
    if (c.count > 0) {
      return { error: `この会社は経歴 ${c.count} 件で使われているため削除できません` };
    }
    return await deleteNameMasterRow("companies", id);
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function deleteRole(id: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc("delete_role", { p_id: id });
    if (error) return { error: dbErr(error) };
    return { error: null };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function deletePhaseName(id: string): Promise<{ error: string | null }> {
  try {
    const { data: row, error: getErr } = await supabase
      .from("phase_names")
      .select("name")
      .eq("id", id)
      .maybeSingle();
    if (getErr) return { error: dbErr(getErr) };
    if (!row) return { error: "工程名を削除できませんでした（権限がありません）" };
    const usage = await countPhaseLabelUsage();
    if (usage.error) return { error: usage.error };
    const n = usage.counts.get(row.name) ?? 0;
    if (n > 0) {
      return { error: `この工程名は作品 ${n} 件のタイムラインで使われているため削除できません` };
    }
    return await deleteNameMasterRow("phase_names", id);
  } catch (e) {
    return { error: errMsg(e) };
  }
}

/**
 * スキルラベルを skills_vocab に追加（Works から新規入力された場合）
 * 旧: skill_bars への書き込みから移行済み。
 */
export async function addSkillLabelFromWorks(
  label: string
): Promise<{ error: string | null; id?: string }> {
  try {
    const vocab = await upsertSkillVocab(label);
    return { error: null, id: vocab.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

/**
 * ツール名を tools_vocab に追加（Works から新規入力された場合）
 */
export async function addToolNameFromWorks(
  name: string
): Promise<{ error: string | null; id?: string }> {
  try {
    const vocab = await upsertToolVocab(name);
    return { error: null, id: vocab.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

// ─── career_items ─────────────────────────────────────────────────────────────

export async function saveCareerItem(item: {
  id: string;
  role: string;
  role_id: string | null;
  company: string;
  company_id: string | null;
  period: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string;
  sort_order: number;
}): Promise<{ error: string | null; company?: string; role?: string; period?: string }> {
  try {
    // 別タブでの名前変更を上書きしないよう、保存の直前にマスタの最新の名前を取り直す
    let company = item.company;
    let role = item.role;
    if (item.company_id) {
      const { data: c, error: cErr } = await supabase
        .from("companies")
        .select("name")
        .eq("id", item.company_id);
      if (cErr) return { error: dbErr(cErr) };
      if (!c?.length) return { error: "選択した会社が見つかりません（マスタ管理で削除された可能性があります）" };
      company = c[0].name;
    }
    if (item.role_id) {
      const { data: r, error: rErr } = await supabase
        .from("roles")
        .select("name")
        .eq("id", item.role_id);
      if (rErr) return { error: dbErr(rErr) };
      if (!r?.length) return { error: "選択した役職が見つかりません（マスタ管理で削除された可能性があります）" };
      role = r[0].name;
    }
    const { data, error } = await supabase
      .from("career_items")
      .upsert({ ...item, company, role }, { onConflict: "id" })
      .select("id, period");
    if (error) return { error: dbErr(error) };
    if (!data?.length) return { error: "経歴を保存できませんでした（権限がありません）" };
    return { error: null, company, role, period: data[0].period };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function deleteCareerItem(id: string): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("career_items")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) return { error: dbErr(error) };
    if (!data?.length) return { error: "経歴を削除できませんでした（権限またはデータが見つかりません）" };
    return { error: null };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

// ─── skill_cards CRUD ─────────────────────────────────────────────────────────

export async function saveSkillCard(card: {
  id: string; title: string; title_jp: string;
  icon_set: string; icon_name: string; sort_order: number;
}): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase.from("skill_cards").upsert(card).select("id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "カードを保存できませんでした（権限がありません）" };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteSkillCard(id: string): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase.from("skill_cards").delete().eq("id", id).select("id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "スキルカードを削除できませんでした（権限またはデータを確認してください）" };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function moveSkillCards(
  updates: { id: string; sort_order: number }[]
): Promise<{ error: string | null }> {
  try {
    const results = await Promise.all(
      updates.map(({ id, sort_order }) =>
        supabase.from("skill_cards").update({ sort_order }).eq("id", id).select("id")
      )
    );
    // RLS で拒否されるとエラーなしで 0 行更新になるため、更新行が無ければ失敗として返す
    const failed = results.find((r) => r.error);
    if (failed?.error) return { error: dbErr(failed.error) };
    if (results.some((r) => !r.data?.length)) {
      return { error: "並び順を更新できませんでした（権限またはデータが見つかりません）" };
    }
    return { error: null };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function saveWorksOrder(
  updates: { id: string; sort_order: number }[]
): Promise<{ error: string | null }> {
  try {
    const results = await Promise.all(
      updates.map(({ id, sort_order }) =>
        supabase.from("works").update({ sort_order }).eq("id", id).select("id")
      )
    );
    // RLS で拒否されるとエラーなしで 0 行更新になるため、更新行が無ければ失敗として返す
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      return { error: failed.error.message || failed.error.code || String(failed.error) };
    }
    if (results.some((r) => !r.data?.length)) {
      return { error: "並び順を更新できませんでした（権限またはデータが見つかりません）" };
    }
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── skill_experience CRUD ────────────────────────────────────────────────────

export async function saveSkillBar(bar: {
  id: string; card_id: string; label: string; label_short: string | null;
  segments: number; level: string; description: string | null; sort_order: number;
  icon_set: string | null; icon_name: string | null; label_note: string | null;
}): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase.from("skill_experience").upsert(bar).select("id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "スキルバーを保存できませんでした（権限がありません）" };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteSkillBar(barId: string): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase.from("skill_experience").delete().eq("id", barId).select("id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "スキル行を削除できませんでした（権限またはデータを確認してください）" };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function moveSkillBars(
  updates: { id: string; sort_order: number }[]
): Promise<{ error: string | null }> {
  try {
    const results = await Promise.all(
      updates.map(({ id, sort_order }) =>
        supabase.from("skill_experience").update({ sort_order }).eq("id", id).select("id")
      )
    );
    // RLS で拒否されるとエラーなしで 0 行更新になるため、更新行が無ければ失敗として返す
    const failed = results.find((r) => r.error);
    if (failed?.error) return { error: dbErr(failed.error) };
    if (results.some((r) => !r.data?.length)) {
      return { error: "並び順を更新できませんでした（権限またはデータが見つかりません）" };
    }
    return { error: null };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

// ─── skill_experience_tools（スキル行単位のツール）────────────────────────────

/** スキル行のツールを tools_vocab の ID 配列（順序＝配列順）で置き換える。 */
export async function saveExperienceToolIds(
  experienceId: string,
  toolIds: string[],
): Promise<{ error: string | null }> {
  try {
    await setExperienceTools(experienceId, [...new Set(toolIds)]);
    return { error: null };
  } catch (e) {
    return { error: errMsg(e) };
  }
}
