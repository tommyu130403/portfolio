import { supabase } from "@/src/lib/supabase";

export type SkillVocab = { id: string; label: string; category?: string | null };
export type ToolVocab = { id: string; name: string; slug?: string | null };

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
    .select("id, name, slug")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
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

export async function upsertToolVocab(name: string): Promise<ToolVocab> {
  const trimmed = name.trim();
  const { data: existing } = await supabase
    .from("tools_vocab")
    .select("id, name, slug")
    .ilike("name", trimmed)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase
    .from("tools_vocab")
    .insert({ name: trimmed })
    .select("id, name, slug")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function setProjectSkills(projectId: string, skillIds: string[]): Promise<void> {
  const { error: delError } = await supabase
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
  const { error: insError } = await supabase.from("project_skills").insert(rows);
  if (insError) throw new Error(insError.message);
}

export async function setProjectTools(projectId: string, toolIds: string[]): Promise<void> {
  const { error: delError } = await supabase
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
  const { error: insError } = await supabase.from("project_tools").insert(rows);
  if (insError) throw new Error(insError.message);
}
