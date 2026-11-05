// SQL `private.compute_work_stakeholders`（20261105130000）と同じ規則。片方を変えたら両方直す。
import type { StakeholderCard, StakeholderTeam, StakeholdersData } from "@/components/WorkViz";

export type StakeholderRoleInput = {
  id: string;
  name: string;
  group_id: string | null;
  is_titled: boolean;
};
export type StakeholderGroupInput = {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  note: string | null;
};
export type StakeholderCountInput = {
  role_id: string;
  headcount: number;
  note?: string | null;
  teams?: StakeholderTeam[] | null;
};

type RoleEntry = {
  role: StakeholderRoleInput;
  headcount: number;
  note: string | null;
  teams: StakeholderTeam[];
  me: boolean;
};

/** 図の対象になる役割。体制内訳の行（並び順どおり）→ 内訳に無い担当役割（人数1）の順。 */
export function stakeholderRoleEntries(
  counts: StakeholderCountInput[],
  roleIds: string[],
  roles: StakeholderRoleInput[],
): RoleEntry[] {
  const byId = new Map(roles.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const out: RoleEntry[] = [];
  const push = (id: string, headcount: number, note?: string | null, teams?: StakeholderTeam[] | null) => {
    const role = byId.get(id);
    if (!role || seen.has(id)) return;
    // チームは SQL が弾く形（名前が空・人数が 1〜999 の整数でない）を捨てる。1 つ以上残れば人数は合計
    const validTeams: StakeholderTeam[] = [];
    if (Array.isArray(teams)) {
      for (const t of teams as unknown[]) {
        if (!t || typeof t !== "object") continue;
        const { name, headcount: n } = t as Record<string, unknown>;
        if (typeof name !== "string" || name.trim() === "") continue;
        if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 999) continue;
        validTeams.push({ name: name.trim(), headcount: n });
      }
    }
    const total = validTeams.length > 0 ? validTeams.reduce((sum, t) => sum + t.headcount, 0) : headcount;
    if (!Number.isInteger(total) || total < 1) return;
    seen.add(id);
    out.push({
      role,
      headcount: total,
      note: (note ?? "").trim() || null,
      teams: validTeams,
      me: roleIds.includes(id),
    });
  };
  for (const c of counts) push(c.role_id, c.headcount, c.note, c.teams);
  for (const id of roleIds) push(id, 1, null, []);
  return out;
}

/** コードポイント順の比較（SQL の `collate "C"` と同じ。短い方が前綴りなら先） */
function compareCodePoints(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) {
    const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!;
    if (d !== 0) return d;
  }
  return x.length - y.length;
}

export function buildStakeholders(
  counts: StakeholderCountInput[],
  roles: StakeholderRoleInput[],
  groups: StakeholderGroupInput[],
  roleIds: string[],
): StakeholdersData | null {
  const entries = stakeholderRoleEntries(counts, roleIds, roles);
  if (entries.length === 0) return null;

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const buckets = new Map<string | null, RoleEntry[]>();
  for (const e of entries) {
    const key = e.role.group_id && groupById.has(e.role.group_id) ? e.role.group_id : null;
    const list = buckets.get(key);
    if (list) list.push(e);
    else buckets.set(key, [e]);
  }

  // 全ての行が役割カード。チームは teams に載せる（組織カードは作らない）
  const toCards = (list: RoleEntry[]): StakeholderCard[] =>
    list.map((e) => ({
      kind: "role",
      name: e.role.name,
      note: e.note ?? `${e.headcount}名`,
      me: e.me,
      teams: e.teams,
    }));

  const named = [...buckets.keys()]
    .filter((k): k is string => k !== null)
    .map((k) => groupById.get(k)!)
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order || compareCodePoints(a.name, b.name),
    );

  const layers: StakeholdersData["layers"] = named.map((g) => ({
    name: g.name,
    note: g.note ?? null,
    icon: g.icon ?? null,
    cards: toCards(buckets.get(g.id)!),
  }));
  const ungrouped = buckets.get(null);
  if (ungrouped) layers.push({ name: "", note: null, icon: null, cards: toCards(ungrouped) });
  return { v: 2, layers };
}
