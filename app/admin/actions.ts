import { supabase } from "@/src/lib/supabase";
import {
  upsertSkillVocab,
  upsertToolVocab,
  setExperienceTools,
  setToolIconUrl,
} from "@/src/lib/skills-tools-client";
import type { Json, Tables } from "@/src/types/supabase";
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

/** 作品・スキル・ツールを一つの DB トランザクションで保存する。 */
export async function saveWork(
  payload: WorkRow,
  skills: string[],
  tools: string[],
): Promise<{ error: string | null }> {
  try {
    // The DB types are generated from the deployed schema. Until this migration is
    // applied and update-types is run, keep the new RPC's signature local.
    const client = supabase as unknown as {
      rpc: (
        name: "save_work_with_relations",
        args: { p_work: Json; p_skill_labels: string[]; p_tool_names: string[] },
      ) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await client.rpc("save_work_with_relations", {
      p_work: payload as unknown as Json,
      p_skill_labels: skills,
      p_tool_names: tools,
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
    const { data, error } = await supabase.from("skill_cards").delete().eq("id", id).select("id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "スキルカードを削除できませんでした（権限またはデータを確認してください）" };
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
    const results = await Promise.all(
      updates.map(({ id, sort_order }) =>
        supabase.from("skill_cards").update({ sort_order }).eq("id", id).select("id")
      )
    );
    const failed = results.find((result) => result.error || !result.data?.length);
    if (failed) {
      return { error: failed.error?.message ?? "並び順を更新できませんでした（権限またはデータを確認してください）" };
    }
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
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
    const { error } = await supabase.from("skill_experience").upsert(bar);
    if (error) return { error: error.message };
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
