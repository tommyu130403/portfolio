"use server";

import { getSupabaseAdmin } from "@/src/lib/supabase-admin";
import type { Tables } from "@/src/types/supabase";

type ProjectRow = Tables<"projects">;

/**
 * プロジェクトを 1 件 upsert（サーバー・サービスロールで実行）
 */
export async function saveProject(payload: ProjectRow): Promise<{ error: string | null }> {
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
          skills: payload.skills ?? null,
          tools: payload.tools ?? null,
          sections: payload.sections ?? null,
          sort_order: payload.sort_order,
          ...(payload.created_at ? { created_at: payload.created_at } : {}),
        },
        { onConflict: "id" }
      );
    if (error) return { error: error.message || error.code || String(error) };
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
