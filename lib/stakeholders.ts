// SQL `private.compute_work_stakeholders`（20261101120000）と同じ規則。片方を変えたら両方直す。
import type { StakeholderMember, StakeholdersData } from "@/components/WorkViz";

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
};
export type StakeholderCountInput = { role_id: string; headcount: number };

type RoleEntry = { role: StakeholderRoleInput; headcount: number; me: boolean };

/** 図の対象になる役割。体制内訳の行（並び順どおり）→ 内訳に無い担当役割（人数1）の順。 */
export function stakeholderRoleEntries(
  counts: StakeholderCountInput[],
  roleIds: string[],
  roles: StakeholderRoleInput[],
): RoleEntry[] {
  const byId = new Map(roles.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const out: RoleEntry[] = [];
  const push = (id: string, headcount: number) => {
    const role = byId.get(id);
    if (!role || seen.has(id)) return;
    if (!Number.isInteger(headcount) || headcount < 1) return;
    seen.add(id);
    out.push({ role, headcount, me: roleIds.includes(id) });
  };
  for (const c of counts) push(c.role_id, c.headcount);
  for (const id of roleIds) push(id, 1);
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

  const toMembers = (list: RoleEntry[]): StakeholderMember[] =>
    list.flatMap((e) =>
      Array.from({ length: e.headcount }, (_, i) =>
        e.role.is_titled
          ? { label: e.role.name, me: e.me }
          : { label: "", me: e.me && i === 0 },
      ),
    );

  const named = [...buckets.keys()]
    .filter((k): k is string => k !== null)
    .map((k) => groupById.get(k)!)
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order || compareCodePoints(a.name, b.name),
    );

  const result: StakeholdersData["groups"] = named.map((g) => ({
    label: g.name,
    icon: g.icon ?? null,
    members: toMembers(buckets.get(g.id)!),
  }));
  const ungrouped = buckets.get(null);
  if (ungrouped) result.push({ label: "", icon: null, members: toMembers(ungrouped) });
  return { groups: result };
}
