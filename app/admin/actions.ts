import { supabase } from "@/src/lib/supabase";
import {
  upsertSkillVocab,
  upsertToolVocab,
  setWorkSkills,
  setWorkTools,
  setExperienceTools,
  setToolIconUrl,
  listSkillVocab,
  listToolVocab,
} from "@/src/lib/skills-tools-client";
import type { Tables } from "@/src/types/supabase";

export type { SkillVocab, ToolVocab } from "@/src/lib/skills-tools-client";
export { listSkillVocab, listToolVocab };

// ─── Storage ──────────────────────────────────────────────────────────────────

export type StorageImage = { name: string; path: string; url: string };

async function listFolderRecursive(prefix: string): Promise<StorageImage[]> {
  const { data, error } = await supabase.storage
    .from("Portfolio")
    .list(prefix, { limit: 1000 });
  if (error || !data) return [];
  const results: StorageImage[] = [];
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

/**
 * Works を 1 件 upsert し、work_skills / work_tools も同期する。
 * skillIds / toolIds が渡された場合は新テーブルで保存。
 */
export async function saveWork(
  payload: WorkRow,
  opts?: { skillIds?: string[]; toolIds?: string[] }
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from("works")
      .upsert(
        {
          id: payload.id,
          title: payload.title,
          category: payload.category ?? null,
          thumbnail_url: payload.thumbnail_url ?? null,
          role: payload.role ?? null,
          period: payload.period ?? null,
          timeline: payload.timeline ?? null,
          stakeholders: payload.stakeholders ?? null,
          hero_brand: payload.hero_brand ?? null,
          hero_screenshots: payload.hero_screenshots ?? [],
          hero_bg_color: payload.hero_bg_color ?? null,
          sections: payload.sections ?? null,
          summary: payload.summary ?? null,
          site_url: payload.site_url ?? null,
          site_title: payload.site_title ?? null,
          site_thumbnail_url: payload.site_thumbnail_url ?? null,
          stakeholder_breakdown: payload.stakeholder_breakdown ?? null,
          sort_order: payload.sort_order,
          career_item_id: payload.career_item_id ?? null,
          ...(payload.created_at ? { created_at: payload.created_at } : {}),
        },
        { onConflict: "id" }
      );
    if (error) return { error: error.message || error.code || String(error) };

    // 新テーブルへの保存（skillIds / toolIds が渡された場合）
    if (opts?.skillIds !== undefined) {
      await setWorkSkills(payload.id, opts.skillIds);
    }
    if (opts?.toolIds !== undefined) {
      await setWorkTools(payload.id, opts.toolIds);
    }

    return { error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

/**
 * Works を 1 件削除（サーバー・サービスロールで実行）
 */
export async function deleteWork(id: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from("works").delete().eq("id", id);
    if (error) return { error: error.message || error.code || String(error) };
    return { error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
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

/**
 * ツールのアイコン（tools_vocab.icon_url）を更新（共有語彙のロゴ。空で消去）。
 */
export async function saveToolIconUrl(
  toolId: string,
  iconUrl: string | null
): Promise<{ error: string | null }> {
  try {
    await setToolIconUrl(toolId, iconUrl);
    return { error: null };
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
    const { error } = await supabase.from("skill_cards").upsert(card);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteSkillCard(id: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from("skill_cards").delete().eq("id", id);
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
    const { data, error } = await supabase.from("skill_cards").insert({
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
    await Promise.all(
      updates.map(({ id, sort_order }) =>
        supabase.from("skill_cards").update({ sort_order }).eq("id", id)
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
  icon_set: string | null; icon_name: string | null; label_note: string | null;
}): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from("skill_experience").upsert(bar);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteSkillBar(barId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from("skill_experience").delete().eq("id", barId);
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
    const { data, error } = await supabase.from("skill_experience").insert({
      card_id: cardId, label: "", label_short: null,
      segments: 5, level: "Lv.3 Senior", sort_order: sortOrder,
      icon_set: "Base", icon_name: "system", label_note: null,
    }).select().single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── skill_experience_tools（スキル行単位のツール）────────────────────────────

/**
 * スキル行（skill_experience）のツール一覧をまとめて保存する。
 *  - 各ツールは名前で tools_vocab を upsert（slug / category も保存）。
 *  - その ID 群で skill_experience_tools を置き換える（順序＝配列順）。
 * 同名ツールは 1 件に集約（中間テーブルの PK 重複を避ける）。
 */
export async function saveExperienceTools(
  experienceId: string,
  tools: { name: string; slug: string | null; category: string | null }[],
): Promise<{ error: string | null }> {
  try {
    const ids: string[] = [];
    for (const t of tools) {
      const name = t.name.trim();
      if (!name) continue;
      const vocab = await upsertToolVocab(name, { slug: t.slug, category: t.category });
      ids.push(vocab.id);
    }
    await setExperienceTools(experienceId, [...new Set(ids)]);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── work_skills / work_tools 一括取得 ──────────────────────────────────

/**
 * スキルラベル配列からそのまま work_skills を更新する。
 * labels にないラベルは skills_vocab に自動登録してから保存する。
 */
export async function saveWorkSkillsByLabels(
  workId: string,
  labels: string[]
): Promise<{ error: string | null }> {
  try {
    const skillIds = await Promise.all(
      labels.map(async (label) => {
        const vocab = await upsertSkillVocab(label);
        return vocab.id;
      })
    );
    await setWorkSkills(workId, skillIds);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * ツール名配列からそのまま work_tools を更新する。
 */
export async function saveWorkToolsByNames(
  workId: string,
  names: string[]
): Promise<{ error: string | null }> {
  try {
    const toolIds = await Promise.all(
      names.map(async (name) => {
        const vocab = await upsertToolVocab(name);
        return vocab.id;
      })
    );
    await setWorkTools(workId, toolIds);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** 全 Works のスキルラベルを一括取得 { workId → label[] } */
export async function listAllWorkSkillLabels(): Promise<Record<string, string[]>> {
  const { data } = await supabase
    .from("work_skills")
    .select("work_id, sort_order, skills_vocab(label)")
    .order("sort_order");
  const result: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const label = (row.skills_vocab as { label: string } | null)?.label;
    if (!label) continue;
    if (!result[row.work_id]) result[row.work_id] = [];
    result[row.work_id].push(label);
  }
  return result;
}

/** 全 Works のツール名を一括取得 { workId → name[] } */
export async function listAllWorkToolNames(): Promise<Record<string, string[]>> {
  const { data } = await supabase
    .from("work_tools")
    .select("work_id, sort_order, tools_vocab(name)")
    .order("sort_order");
  const result: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const name = (row.tools_vocab as { name: string } | null)?.name;
    if (!name) continue;
    if (!result[row.work_id]) result[row.work_id] = [];
    result[row.work_id].push(name);
  }
  return result;
}
