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

/**
 * Skills/Tools 用のボキャブラリ行を追加（Projects からの新規追加分）
 *
 * 前提:
 * - SKILL_VOCAB_CARD_ID: skill_bars.card_id に使うスキルカード ID
 * - TOOL_VOCAB_CARD_ID:  skill_tools.card_id に使うスキルカード ID
 *
 * これらは Supabase 側で任意の「辞書用」カードを 1 つ作成し、その id を .env.local に設定してください。
 */

export async function addSkillLabelFromProjects(label: string): Promise<{ error: string | null }> {
  const cardId = process.env.SKILL_VOCAB_CARD_ID;
  if (!cardId) {
    // 設定されていない場合は DB には書かず、そのまま UI 側だけで使う
    return { error: null };
  }
  try {
    const admin = getSupabaseAdmin();
    const trimmed = label.trim();
    if (!trimmed) return { error: null };

    const { error } = await admin.from("skill_bars").insert({
      card_id: cardId,
      label: trimmed,
      segments: 5,
      level: "",
      description: null,
    });
    if (error) return { error: error.message || error.code || String(error) };
    return { error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

export async function addToolNameFromProjects(name: string): Promise<{ error: string | null }> {
  const cardId = process.env.TOOL_VOCAB_CARD_ID;
  if (!cardId) {
    // 設定されていない場合は DB には書かず、そのまま UI 側だけで使う
    return { error: null };
  }
  try {
    const admin = getSupabaseAdmin();
    const trimmed = name.trim();
    if (!trimmed) return { error: null };

    const { error } = await admin.from("skill_tools").insert({
      card_id: cardId,
      name: trimmed,
      years: "",
    });
    if (error) return { error: error.message || error.code || String(error) };
    return { error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}
