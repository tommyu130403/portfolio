"use client";

import { useState } from "react";
import { WorkStakeholderDiagram, type StakeholdersData } from "@/components/WorkViz";
import type { StakeholderRoleInput } from "@/lib/stakeholders";
import type { StakeholderGroupRow } from "../../actions";
import { Input } from "../../AdminLayout";
import IconPickerField, { formatIconRef, type IconValue } from "../../IconPickerField";
import type { IconCatalog } from "../../iconCatalogTypes";

const smallButton =
  "shrink-0 rounded-[6px] border border-border-light px-3 py-1 text-[11px] text-fg-muted transition-colors hover:border-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

type NewGroupDraft = { name: string; icon: IconValue | null };

/** 関係者図の表示と、役割ごとのグループ・役職の設定（役割マスタへ即時保存） */
export default function StakeholdersDiagramEditor({
  data,
  workRoles,
  groups,
  iconCatalog,
  disabled,
  onSetGroup,
  onSetTitled,
  onCreateGroup,
}: {
  data: StakeholdersData | null;
  workRoles: StakeholderRoleInput[];
  groups: StakeholderGroupRow[];
  iconCatalog: IconCatalog;
  disabled: boolean;
  onSetGroup: (roleId: string, groupId: string | null) => void;
  onSetTitled: (roleId: string, next: boolean) => void;
  onCreateGroup: (roleId: string, name: string, icon: string | null) => Promise<boolean>;
}) {
  const [drafts, setDrafts] = useState<Record<string, NewGroupDraft>>({});
  const draftOf = (roleId: string): NewGroupDraft => drafts[roleId] ?? { name: "", icon: null };
  const patchDraft = (roleId: string, p: Partial<NewGroupDraft>) =>
    setDrafts((d) => ({ ...d, [roleId]: { ...draftOf(roleId), ...p } }));

  const create = async (roleId: string) => {
    const d = draftOf(roleId);
    if (!d.name.trim()) return;
    const ok = await onCreateGroup(roleId, d.name, formatIconRef(d.icon) ?? null);
    if (ok) {
      setDrafts((all) => {
        const next = { ...all };
        delete next[roleId];
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:content-[''] after:border-border relative rounded-r16 bg-surface p-10">
        {data ? (
          <WorkStakeholderDiagram data={data} />
        ) : (
          <p className="text-[12px] text-fg-muted">体制内訳か担当役割を入れると、ここに図が出ます</p>
        )}
      </div>

      {workRoles.length > 0 && (
        <ul className="flex flex-col gap-2">
          {workRoles.map((r) => {
            const d = draftOf(r.id);
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 rounded-[8px] border border-border-light bg-surface px-3 py-2"
              >
                <span className="min-w-[96px] text-[13px] text-white">{r.name}</span>
                <select
                  aria-label={`${r.name}のグループ`}
                  value={r.group_id ?? ""}
                  disabled={disabled}
                  onChange={(e) => onSetGroup(r.id, e.target.value || null)}
                  className="max-w-[200px] rounded-[6px] border border-border-light bg-[#1a1a1a] px-2 py-1 text-[12px] text-white outline-none focus:border-primary disabled:opacity-40"
                >
                  <option value="">（グループなし）</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <label className="flex shrink-0 items-center gap-1 text-[11px] text-fg-muted">
                  <input
                    type="checkbox"
                    checked={r.is_titled}
                    disabled={disabled}
                    onChange={(e) => onSetTitled(r.id, e.target.checked)}
                  />
                  役職
                </label>
                {!r.group_id && (
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <div className="w-[200px]">
                      <Input
                        value={d.name}
                        onChange={(v) => patchDraft(r.id, { name: v })}
                        placeholder="新しいグループ名"
                        disabled={disabled}
                      />
                    </div>
                    <IconPickerField
                      catalog={iconCatalog}
                      allowEmpty
                      align="left"
                      disabled={disabled}
                      value={d.icon}
                      onChange={(v) => patchDraft(r.id, { icon: v })}
                    />
                    <button
                      type="button"
                      onClick={() => void create(r.id)}
                      disabled={disabled || !d.name.trim()}
                      className={smallButton}
                    >
                      作成して設定
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[11px] text-fg-muted">
        グループと役職は役割マスタの設定です。変更はすぐ保存され、同じ役割を使う他の作品の図にも反映されます
      </p>
    </div>
  );
}
