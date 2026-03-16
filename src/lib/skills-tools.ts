import { getSupabaseAdmin } from "@/src/lib/supabase-admin";

export type SkillVocab = {
  id: string;
  label: string;
  slug?: string | null;
  category?: string | null;
};

export type ToolVocab = {
  id: string;
  name: string;
  slug?: string | null;
};

// ─── 語彙取得 ──────────────────────────────────────────────────

export async function listSkillVocab(): Promise<SkillVocab[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("skills_vocab")
    .select("id, label, slug, category")
    .order("label");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listToolVocab(): Promise<ToolVocab[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("tools_vocab")
    .select("id, name, slug")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function suggestSkillVocab(
  query: string,
  opts?: { limit?: number }
): Promise<SkillVocab[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("skills_vocab")
    .select("id, label, slug, category")
    .ilike("label", `${query}%`)
    .order("label")
    .limit(opts?.limit ?? 20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function suggestToolVocab(
  query: string,
  opts?: { limit?: number }
): Promise<ToolVocab[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("tools_vocab")
    .select("id, name, slug")
    .ilike("name", `${query}%`)
    .order("name")
    .limit(opts?.limit ?? 20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── 語彙マスタへの追加（upsert: label/name が同じものは重複挿入しない） ──

export async function upsertSkillVocab(label: string): Promise<SkillVocab> {
  const admin = getSupabaseAdmin();
  const trimmed = label.trim();

  // 既存検索（大文字小文字を区別しない）
  const { data: existing } = await admin
    .from("skills_vocab")
    .select("id, label, slug, category")
    .ilike("label", trimmed)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await admin
    .from("skills_vocab")
    .insert({ label: trimmed })
    .select("id, label, slug, category")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function upsertToolVocab(name: string): Promise<ToolVocab> {
  const admin = getSupabaseAdmin();
  const trimmed = name.trim();

  const { data: existing } = await admin
    .from("tools_vocab")
    .select("id, name, slug")
    .ilike("name", trimmed)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await admin
    .from("tools_vocab")
    .insert({ name: trimmed })
    .select("id, name, slug")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ─── プロジェクト × スキル / ツール ────────────────────────────

export async function getProjectSkills(projectId: string): Promise<SkillVocab[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("project_skills")
    .select("sort_order, skills_vocab(id, label, slug, category)")
    .eq("project_id", projectId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => row.skills_vocab as SkillVocab)
    .filter(Boolean);
}

export async function getProjectTools(projectId: string): Promise<ToolVocab[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("project_tools")
    .select("sort_order, tools_vocab(id, name, slug)")
    .eq("project_id", projectId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => row.tools_vocab as ToolVocab)
    .filter(Boolean);
}

/**
 * プロジェクトのスキルを上書き保存（set 型）。
 * 渡した skillIds がそのままセットとなるよう、差分 delete / insert を行う。
 */
export async function setProjectSkills(
  projectId: string,
  skillIds: string[]
): Promise<void> {
  const admin = getSupabaseAdmin();

  // 既存を全削除してから insert（シンプルなセット型更新）
  const { error: delError } = await admin
    .from("project_skills")
    .delete()
    .eq("project_id", projectId);
  if (delError) throw new Error(delError.message);

  if (skillIds.length === 0) return;

  const rows = skillIds.map((skill_id, idx) => ({
    project_id: projectId,
    skill_id,
    sort_order: idx,
  }));
  const { error: insError } = await admin.from("project_skills").insert(rows);
  if (insError) throw new Error(insError.message);
}

/**
 * プロジェクトのツールを上書き保存（set 型）。
 */
export async function setProjectTools(
  projectId: string,
  toolIds: string[]
): Promise<void> {
  const admin = getSupabaseAdmin();

  const { error: delError } = await admin
    .from("project_tools")
    .delete()
    .eq("project_id", projectId);
  if (delError) throw new Error(delError.message);

  if (toolIds.length === 0) return;

  const rows = toolIds.map((tool_id, idx) => ({
    project_id: projectId,
    tool_id,
    sort_order: idx,
  }));
  const { error: insError } = await admin.from("project_tools").insert(rows);
  if (insError) throw new Error(insError.message);
}
