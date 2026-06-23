import { supabase } from "@/src/lib/supabase";

export type SkillVocab = { id: string; label: string; category?: string | null };
export type ToolVocab = { id: string; name: string; slug?: string | null; category?: string | null; icon_url?: string | null };

export async function listSkillVocab(): Promise<SkillVocab[]> {
  const { data, error } = await supabase
    .from("skills_vocab")
    .select("id, label, category")
    .order("label");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listToolVocab(): Promise<ToolVocab[]> {
  const { data, error } = await supabase
    .from("tools_vocab")
    .select("id, name, slug, category, icon_url")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * tools_vocab.icon_url を更新（共有語彙のロゴ。空文字は null として消去）。
 * Works 編集画面のツールアイコン設定から呼ばれる。
 */
export async function setToolIconUrl(toolId: string, iconUrl: string | null): Promise<void> {
  const { error } = await supabase
    .from("tools_vocab")
    .update({ icon_url: iconUrl && iconUrl.trim() ? iconUrl.trim() : null })
    .eq("id", toolId);
  if (error) throw new Error(error.message);
}

export async function upsertSkillVocab(label: string): Promise<SkillVocab> {
  const trimmed = label.trim();
  const { data: existing } = await supabase
    .from("skills_vocab")
    .select("id, label, category")
    .ilike("label", trimmed)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase
    .from("skills_vocab")
    .insert({ label: trimmed })
    .select("id, label, category")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function upsertToolVocab(
  name: string,
  fields?: { slug?: string | null; category?: string | null },
): Promise<ToolVocab> {
  const trimmed = name.trim();
  const { data: existing } = await supabase
    .from("tools_vocab")
    .select("id, name, slug, category")
    .ilike("name", trimmed)
    .maybeSingle();
  if (existing) {
    // tools_vocab は全バー・全プロジェクトで共有されるため、空/null では
    // 既存の slug / category を上書きしない（非空の値が来たときだけ更新）。
    // ＝あるバーで slug 未入力のまま保存しても、他で設定済みのロゴを消さない。
    const update: { slug?: string; category?: string } = {};
    if (fields?.slug != null && fields.slug !== "") update.slug = fields.slug;
    if (fields?.category != null && fields.category !== "") update.category = fields.category;
    if (Object.keys(update).length > 0) {
      const { data: updated, error } = await supabase
        .from("tools_vocab")
        .update(update)
        .eq("id", existing.id)
        .select("id, name, slug, category")
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }
    return existing;
  }
  const { data, error } = await supabase
    .from("tools_vocab")
    .insert({ name: trimmed, slug: fields?.slug ?? null, category: fields?.category ?? null })
    .select("id, name, slug, category")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function setWorkSkills(workId: string, skillIds: string[]): Promise<void> {
  const { error: delError } = await supabase
    .from("work_skills")
    .delete()
    .eq("work_id", workId);
  if (delError) throw new Error(delError.message);
  if (skillIds.length === 0) return;
  const rows = skillIds.map((skill_id, idx) => ({
    work_id: workId,
    skill_id,
    sort_order: idx,
  }));
  const { error: insError } = await supabase.from("work_skills").insert(rows);
  if (insError) throw new Error(insError.message);
}

export async function setWorkTools(workId: string, toolIds: string[]): Promise<void> {
  const { error: delError } = await supabase
    .from("work_tools")
    .delete()
    .eq("work_id", workId);
  if (delError) throw new Error(delError.message);
  if (toolIds.length === 0) return;
  const rows = toolIds.map((tool_id, idx) => ({
    work_id: workId,
    tool_id,
    sort_order: idx,
  }));
  const { error: insError } = await supabase.from("work_tools").insert(rows);
  if (insError) throw new Error(insError.message);
}

/**
 * スキル行（skill_experience）に紐づくツールを丸ごと置き換える。
 * project_tools と同じ「全削除→挿入」方式で sort_order を 0..n に振り直す。
 */
export async function setExperienceTools(experienceId: string, toolIds: string[]): Promise<void> {
  const { error: delError } = await supabase
    .from("skill_experience_tools")
    .delete()
    .eq("experience_id", experienceId);
  if (delError) throw new Error(delError.message);
  if (toolIds.length === 0) return;
  const rows = toolIds.map((tool_id, idx) => ({
    experience_id: experienceId,
    tool_id,
    sort_order: idx,
  }));
  const { error: insError } = await supabase.from("skill_experience_tools").insert(rows);
  if (insError) throw new Error(insError.message);
}
