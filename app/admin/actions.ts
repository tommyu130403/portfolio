"use server";

import { getSupabaseAdmin } from "@/src/lib/supabase-admin";
import {
  upsertSkillVocab,
  upsertToolVocab,
  setProjectSkills,
  setProjectTools,
  listSkillVocab,
  listToolVocab,
} from "@/src/lib/skills-tools";
import type { Tables } from "@/src/types/supabase";

export type { SkillVocab, ToolVocab } from "@/src/lib/skills-tools";
export { listSkillVocab, listToolVocab };

// ─── Storage ──────────────────────────────────────────────────────────────────

export type StorageImage = { name: string; path: string; url: string };

async function listFolderRecursive(
  admin: ReturnType<typeof getSupabaseAdmin>,
  prefix: string,
): Promise<StorageImage[]> {
  const { data, error } = await admin.storage
    .from("Portfolio")
    .list(prefix, { limit: 1000 });
  if (error || !data) return [];
  const results: StorageImage[] = [];
  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.metadata) {
      const { data: urlData } = admin.storage
        .from("Portfolio")
        .getPublicUrl(fullPath);
      results.push({ name: item.name, path: fullPath, url: urlData.publicUrl });
    } else {
      results.push(...(await listFolderRecursive(admin, fullPath)));
    }
  }
  return results;
}

export async function listStorageImages(): Promise<{
  data: StorageImage[];
  error: string | null;
}> {
  try {
    const admin = getSupabaseAdmin();
    const images = await listFolderRecursive(admin, "");
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
    const admin = getSupabaseAdmin();
    const file = formData.get("file") as File;
    if (!file) return { url: null, path: null, error: "ファイルが見つかりません" };
    const ext = file.name.split(".").pop() ?? "bin";
    const base = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_\-]/g, "_");
    const filename = `${base}_${Date.now()}.${ext}`;
    const path = folder ? `${folder}/${filename}` : filename;
    const arrayBuffer = await file.arrayBuffer();
    const { error } = await admin.storage
      .from("Portfolio")
      .upload(path, arrayBuffer, { contentType: file.type, upsert: false });
    if (error) return { url: null, path: null, error: error.message };
    const { data: urlData } = admin.storage.from("Portfolio").getPublicUrl(path);
    return { url: urlData.publicUrl, path, error: null };
  } catch (e) {
    return { url: null, path: null, error: e instanceof Error ? e.message : String(e) };
  }
}

type ProjectRow = Tables<"projects">;

/**
 * プロジェクトを 1 件 upsert し、project_skills / project_tools も同期する。
 * skillIds / toolIds が渡された場合は新テーブルで保存。
 * 旧カラム projects.skills / projects.tools は後方互換のため同時に更新する（将来削除予定）。
 */
export async function saveProject(
  payload: ProjectRow,
  opts?: { skillIds?: string[]; toolIds?: string[] }
): Promise<{ error: string | null }> {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("projects")
      .upsert(
        {
          id: payload.id,
          title: payload.title,
          category: payload.category ?? null,
          thumbnail_url: payload.thumbnail_url ?? null,
          role: payload.role ?? null,
          period: payload.period ?? null,
          sections: payload.sections ?? null,
          sort_order: payload.sort_order,
          ...(payload.created_at ? { created_at: payload.created_at } : {}),
        },
        { onConflict: "id" }
      );
    if (error) return { error: error.message || error.code || String(error) };

    // 新テーブルへの保存（skillIds / toolIds が渡された場合）
    if (opts?.skillIds !== undefined) {
      await setProjectSkills(payload.id, opts.skillIds);
    }
    if (opts?.toolIds !== undefined) {
      await setProjectTools(payload.id, opts.toolIds);
    }

    return { error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

/**
 * プロジェクトを 1 件削除（サーバー・サービスロールで実行）
 */
export async function deleteProject(id: string): Promise<{ error: string | null }> {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("projects").delete().eq("id", id);
    if (error) return { error: error.message || error.code || String(error) };
    return { error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

/**
 * スキルラベルを skills_vocab に追加（Projects から新規入力された場合）
 * 旧: skill_bars への書き込みから移行済み。
 */
export async function addSkillLabelFromProjects(
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
 * ツール名を tools_vocab に追加（Projects から新規入力された場合）
 * 旧: skill_tools への書き込みから移行済み。
 */
export async function addToolNameFromProjects(
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

// ─── skill_cards CRUD ─────────────────────────────────────────────────────────

export async function saveSkillCard(card: {
  id: string; title: string; title_jp: string;
  icon_set: string; icon_name: string; sort_order: number;
}): Promise<{ error: string | null }> {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("skill_cards").upsert(card);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteSkillCard(id: string): Promise<{ error: string | null }> {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("skill_cards").delete().eq("id", id);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function addSkillCard(sortOrder: number): Promise<{
  data: import("@/src/types/supabase").Tables<"skill_cards"> | null;
  error: string | null;
}> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("skill_cards").insert({
      title: "New Card", title_jp: "新しいカード",
      icon_set: "Edit", icon_name: "writing-fluently",
      sort_order: sortOrder,
    }).select().single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function moveSkillCards(
  updates: { id: string; sort_order: number }[]
): Promise<{ error: string | null }> {
  try {
    const admin = getSupabaseAdmin();
    await Promise.all(
      updates.map(({ id, sort_order }) =>
        admin.from("skill_cards").update({ sort_order }).eq("id", id)
      )
    );
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── skill_experience CRUD ────────────────────────────────────────────────────

export async function saveSkillBar(bar: {
  id: string; card_id: string; label: string; label_short: string | null;
  segments: number; level: string; description: string | null; sort_order: number;
}): Promise<{ error: string | null }> {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("skill_experience").upsert(bar);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function saveUserSkills(rows: {
  id: string; user_id: string; is_target: boolean | null; updated_at: string;
  [key: string]: unknown;
}[]): Promise<{ error: string | null }> {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("user_skills").upsert(rows);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteSkillBar(barId: string): Promise<{ error: string | null }> {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("skill_experience").delete().eq("id", barId);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function addSkillBar(cardId: string, sortOrder: number): Promise<{
  data: import("@/src/types/supabase").Tables<"skill_experience"> | null;
  error: string | null;
}> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("skill_experience").insert({
      card_id: cardId, label: "", label_short: null,
      segments: 5, level: "Lv.3 Senior", sort_order: sortOrder,
    }).select().single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── skill_tools CRUD ─────────────────────────────────────────────────────────

export async function saveSkillTool(tool: {
  id: string; card_id: string; name: string; years: string; sort_order: number;
}): Promise<{ error: string | null }> {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("skill_tools").upsert(tool);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteSkillTool(toolId: string): Promise<{ error: string | null }> {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("skill_tools").delete().eq("id", toolId);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function addSkillTool(cardId: string, sortOrder: number): Promise<{
  data: import("@/src/types/supabase").Tables<"skill_tools"> | null;
  error: string | null;
}> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("skill_tools").insert({
      card_id: cardId, name: "", years: "", sort_order: sortOrder,
    }).select().single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── project_skills / project_tools 一括取得 ──────────────────────────────────

/**
 * スキルラベル配列からそのまま project_skills を更新する。
 * labels にないラベルは skills_vocab に自動登録してから保存する。
 */
export async function saveProjectSkillsByLabels(
  projectId: string,
  labels: string[]
): Promise<{ error: string | null }> {
  try {
    const skillIds = await Promise.all(
      labels.map(async (label) => {
        const vocab = await upsertSkillVocab(label);
        return vocab.id;
      })
    );
    await setProjectSkills(projectId, skillIds);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * ツール名配列からそのまま project_tools を更新する。
 */
export async function saveProjectToolsByNames(
  projectId: string,
  names: string[]
): Promise<{ error: string | null }> {
  try {
    const toolIds = await Promise.all(
      names.map(async (name) => {
        const vocab = await upsertToolVocab(name);
        return vocab.id;
      })
    );
    await setProjectTools(projectId, toolIds);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** 全プロジェクトのスキルラベルを一括取得 { projectId → label[] } */
export async function listAllProjectSkillLabels(): Promise<Record<string, string[]>> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("project_skills")
    .select("project_id, sort_order, skills_vocab(label)")
    .order("sort_order");
  const result: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const label = (row.skills_vocab as { label: string } | null)?.label;
    if (!label) continue;
    if (!result[row.project_id]) result[row.project_id] = [];
    result[row.project_id].push(label);
  }
  return result;
}

/** 全プロジェクトのツール名を一括取得 { projectId → name[] } */
export async function listAllProjectToolNames(): Promise<Record<string, string[]>> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("project_tools")
    .select("project_id, sort_order, tools_vocab(name)")
    .order("sort_order");
  const result: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const name = (row.tools_vocab as { name: string } | null)?.name;
    if (!name) continue;
    if (!result[row.project_id]) result[row.project_id] = [];
    result[row.project_id].push(name);
  }
  return result;
}
