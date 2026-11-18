/**
 * 作品本文の図版ブロック（team / stairs / summary / merge / triage / related）の中身の読み取り。
 * 純粋関数だけ（React・DOM・DB に依存しない）。ブロックの境界は lib/work-sections.ts、描画は components/WorkFigureBlocks.tsx。
 * `:` は全角 `：`、`|` は全角 `｜` でもよい。読めない行は捨てて、何も残らなければ null / 空配列を返す。
 */

const splitPipes = (text: string): string[] => text.split(/[|｜]/).map((c) => c.trim());
const bulletText = (line: string): string | null => line.match(/^\s*[-*+]\s+(.*)$/)?.[1].trim() ?? null;
const bulletsOf = (body: string[]): string[] => body.map(bulletText).filter((t): t is string => !!t);

/** `::: kind タイトル | 補足文` の開き行の残りを、タイトルと補足文に分ける */
export function splitTitleLead(rest: string): { title: string; lead: string } {
  const [title = "", ...lead] = splitPipes(rest);
  return { title, lead: lead.join(" | ").trim() };
}

/* ------------------------------------------------------------------ *
 * team
 * ------------------------------------------------------------------ */

export type TeamLine = { label: string; layers: string[] };

/** `- 表示名 = 層A, 層B`。`=` の無い行・左右が空の行は捨てる */
export function parseTeamLines(body: string[]): TeamLine[] {
  const out: TeamLine[] = [];
  for (const text of bulletsOf(body)) {
    const m = text.match(/^(.*?)\s*[=＝]\s*(.*)$/);
    if (!m) continue;
    const label = m[1].trim();
    const layers = m[2].split(/[,、，]/).map((s) => s.trim()).filter(Boolean);
    if (label && layers.length > 0) out.push({ label, layers });
  }
  return out;
}

/** works.stakeholders の読み取り結果のうち、ここで使う形（components/WorkViz の StakeholdersData と構造が合う） */
export type TeamSourceLayer = {
  name: string;
  cards: ({ kind: "role"; name: string; note: string; me: boolean } | { kind: "org" })[];
};
export type TeamRow = { name: string; me: boolean; count: number };
export type TeamGroup = { label: string; rows: TeamRow[] };

const norm = (s: string) => s.trim().toLowerCase();

/**
 * 層を本文の指定に従ってグループにまとめる。
 * 指定された層は書いた順に、表示名のグループへ入れる（層名は大小文字・前後の空白を無視して照合。無い層名は無視）。
 * どの行にも書かれなかった層は、そのあとに層名のままのグループとして足す（落とさない）。
 * 人数は breakdown の役割名 → カードの note「N名」→ 1 の順。role 以外のカード（組織）は数えない。行が 0 のグループは出さない
 */
export function buildTeamGroups(
  layers: TeamSourceLayer[],
  breakdown: { name: string; count: number }[] | null,
  lines: TeamLine[],
): TeamGroup[] {
  const counts = new Map((breakdown ?? []).map((b) => [b.name.trim(), b.count]));
  const rowsOf = (layer: TeamSourceLayer): TeamRow[] =>
    layer.cards.flatMap((c): TeamRow[] => {
      if (c.kind !== "role") return [];
      const fromNote = c.note.trim().match(/^(\d+)名$/);
      const count = counts.get(c.name.trim()) ?? (fromNote ? Number(fromNote[1]) : 1);
      return [{ name: c.name, me: c.me, count: Math.max(1, count) }];
    });

  const byName = new Map<string, TeamSourceLayer>();
  for (const l of layers) if (!byName.has(norm(l.name))) byName.set(norm(l.name), l);

  const used = new Set<TeamSourceLayer>();
  const groups: TeamGroup[] = [];
  for (const line of lines) {
    const rows: TeamRow[] = [];
    for (const name of line.layers) {
      const layer = byName.get(norm(name));
      if (!layer || used.has(layer)) continue;
      used.add(layer);
      rows.push(...rowsOf(layer));
    }
    if (rows.length > 0) groups.push({ label: line.label, rows });
  }
  for (const layer of layers) {
    if (used.has(layer)) continue;
    const rows = rowsOf(layer);
    if (rows.length > 0) groups.push({ label: layer.name, rows });
  }
  return groups;
}

/* ------------------------------------------------------------------ *
 * stairs
 * ------------------------------------------------------------------ */

export type StairsTone = "neutral" | "mid" | "accent";
export type StairsRow = { name: string; tag: string; desc: string; note: string; tone: StairsTone };

/** `- 名前 | タグ | 説明 | 右端の注記 | tone(mid / accent。省略=neutral)` */
export function parseStairs(body: string[]): StairsRow[] {
  return bulletsOf(body)
    .map((text): StairsRow => {
      const [name = "", tag = "", desc = "", note = "", tone = ""] = splitPipes(text);
      const t = tone.toLowerCase();
      return { name, tag, desc, note, tone: t === "mid" || t === "accent" ? t : "neutral" };
    })
    .filter((r) => r.name);
}

/* ------------------------------------------------------------------ *
 * summary
 * ------------------------------------------------------------------ */

export type SummaryData = { lead: string; problem: string; action: string; result: string };
const SUMMARY_KEYS = ["lead", "problem", "action", "result"] as const;

/** `lead:` / `problem:` / `action:` / `result:`（各 1 行）。古い `release:` 行は読み捨てる。1 つも無ければ null */
export function parseSummary(body: string[]): SummaryData | null {
  const data: SummaryData = { lead: "", problem: "", action: "", result: "" };
  for (const raw of body) {
    const m = raw.trim().match(/^(lead|problem|action|result)\s*[:：]\s*(.*)$/i);
    if (m) data[m[1].toLowerCase() as (typeof SUMMARY_KEYS)[number]] = m[2].trim();
  }
  return SUMMARY_KEYS.some((k) => data[k]) ? data : null;
}

/* ------------------------------------------------------------------ *
 * merge
 * ------------------------------------------------------------------ */

export type MergeFrom = { title: string; body: string; note: string };
export type MergeStepTone = "default" | "accent" | "dashed";
export type MergeStep = { tag: string; name: string; tone: MergeStepTone; note: string };
export type MergeData = { from: MergeFrom[]; intoTitle: string; steps: MergeStep[]; note: string };

/**
 * `from: 題 | 本文 | 注記` / `into: 題` / `- タグ | 名前 | tone(accent / dashed) | 注記` / `note: 図の下の補足`。
 * 手順が 1 つも読めなければ null（from だけでは図にならない）
 */
export function parseMerge(body: string[]): MergeData | null {
  const from: MergeFrom[] = [];
  const steps: MergeStep[] = [];
  let intoTitle = "";
  const notes: string[] = [];
  for (const raw of body) {
    const line = raw.trim();
    const key = line.match(/^(from|into|note)\s*[:：]\s*(.*)$/i);
    if (key) {
      const k = key[1].toLowerCase();
      if (k === "from") {
        const [title = "", text = "", note = ""] = splitPipes(key[2]);
        if (title || text) from.push({ title, body: text, note });
      } else if (k === "into") {
        intoTitle = key[2].trim();
      } else if (key[2].trim()) {
        notes.push(key[2].trim());
      }
      continue;
    }
    const item = bulletText(line);
    if (item === null) continue;
    const parts = splitPipes(item);
    const [tag = "", name = "", third = "", fourth = ""] = parts;
    const t = third.toLowerCase();
    const isTone = t === "accent" || t === "dashed";
    // 1 項目だけなら名前。3 番目が tone でなければ注記として読む
    const step: MergeStep =
      parts.length === 1
        ? { tag: "", name: tag, tone: "default", note: "" }
        : { tag, name, tone: isTone ? t : "default", note: isTone ? fourth : third || fourth };
    if (step.name || step.tag) steps.push(step);
  }
  return steps.length > 0 ? { from, intoTitle, steps, note: notes.join("\n") } : null;
}

/* ------------------------------------------------------------------ *
 * triage
 * ------------------------------------------------------------------ */

export type TriageKind = "in" | "cut" | "defer";
export type TriageSection = { kind: TriageKind; label: string; reason: string; items: string[] };
export type TriageData = { sections: TriageSection[]; note: string };

const TRIAGE_DEFAULT_LABEL: Record<TriageKind, string> = { in: "入れた", cut: "削った", defer: "見送った" };

/**
 * `in:` / `cut:` / `defer:`（`ラベル | 理由`。ラベル省略可）の下に `- ` の項目。`note:` は図の下の補足。
 * 並びは入れた → 削った → 見送った に固定。同じ見出しが 2 回あれば項目を足す。項目の無い見出しは出さない。何も無ければ null
 */
export function parseTriage(body: string[]): TriageData | null {
  const map = new Map<TriageKind, TriageSection>();
  let cur: TriageSection | null = null;
  const notes: string[] = [];
  for (const raw of body) {
    const line = raw.trim();
    const key = line.match(/^(in|cut|defer|note)\s*[:：]\s*(.*)$/i);
    if (key) {
      const k = key[1].toLowerCase();
      if (k === "note") {
        if (key[2].trim()) notes.push(key[2].trim());
        cur = null;
        continue;
      }
      const kind = k as TriageKind;
      const [label = "", ...reason] = splitPipes(key[2]);
      const existing = map.get(kind);
      if (existing) {
        cur = existing;
      } else {
        cur = { kind, label: label || TRIAGE_DEFAULT_LABEL[kind], reason: reason.join(" | ").trim(), items: [] };
        map.set(kind, cur);
      }
      continue;
    }
    const item = bulletText(line);
    if (item && cur) cur.items.push(item);
  }
  const sections = (["in", "cut", "defer"] as const).map((k) => map.get(k)).filter((s): s is TriageSection => !!s && s.items.length > 0);
  return sections.length > 0 ? { sections, note: notes.join("\n") } : null;
}

/* ------------------------------------------------------------------ *
 * related
 * ------------------------------------------------------------------ */

export type RelatedItem = { id: string; label: string; accent: boolean };
export type RelatedData = { heading: string; items: RelatedItem[] };

export const RELATED_DEFAULT_HEADING = "この作品とつながる作品";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `::: related 見出し` + `- <uuid> | ラベル [| accent]`。id が UUID でない行は捨てる。1 件も無ければ null */
export function parseRelated(rest: string, body: string[]): RelatedData | null {
  const items: RelatedItem[] = [];
  for (const text of bulletsOf(body)) {
    const [id = "", label = "", flag = ""] = splitPipes(text);
    if (UUID.test(id)) items.push({ id: id.toLowerCase(), label, accent: flag.toLowerCase() === "accent" });
  }
  return items.length > 0 ? { heading: rest.trim() || RELATED_DEFAULT_HEADING, items } : null;
}
