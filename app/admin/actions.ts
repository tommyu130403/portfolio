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

type ProjectRow = Tables<"projects">;

/**
 * プロジェクトを 1 件 upsert し、project_skills / project_tools も同期する。
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
