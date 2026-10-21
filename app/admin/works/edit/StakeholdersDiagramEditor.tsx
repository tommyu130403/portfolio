"use client";

import { useState, type MouseEvent } from "react";
import Icon, { ICON_SETS, type IconSet } from "@/components/Icon";
import type { StakeholderGroup, StakeholderMember, StakeholdersData } from "@/components/WorkViz";
import { Input, MoveButtons, moveItem } from "../../AdminLayout";
import IconPickerField, { formatIconRef, parseIconRef } from "../../IconPickerField";
import type { IconCatalog } from "../../iconCatalogTypes";

const vizDel =
  "rounded px-2 py-1 text-[11px] text-system-700 hover:text-danger-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-system-700";
// AdminLayout の MoveButtons と同じ見た目
const moveBtn = "rounded px-2 py-1 text-[12px] text-system-700 hover:text-white disabled:opacity-30";
const LAST_MEMBER_HINT = "メンバーが 0 人のグループは公開ページに出ないため、最後の1人は消せません（グループごと消すときは「グループ削除」）";
const memberName = (m: StakeholderMember, mi: number) => m.label || `メンバー${mi + 1}`;
const groupName = (g: StakeholderGroup, gi: number) => g.label || `グループ${gi + 1}`;

function patchGroupAt(v: StakeholdersData, gi: number, p: Partial<StakeholderGroup>): StakeholdersData {
  return { groups: v.groups.map((g, i) => (i === gi ? { ...g, ...p } : g)) };
}
function patchMemberAt(v: StakeholdersData, gi: number, mi: number, p: Partial<StakeholderMember>): StakeholdersData {
  return patchGroupAt(v, gi, { members: v.groups[gi].members.map((m, i) => (i === mi ? { ...m, ...p } : m)) });
}

// components/WorkViz.tsx Connector の複製（components/ を触らないため。見た目を変えるときは両方直す）
function Connector() {
  return <span className="mb-px h-px w-4 shrink-0 rounded-full bg-border" />;
}

// components/WorkViz.tsx RefIcon の複製（非 export）。不正な set 名は描画しない
function GroupIcon({ icon }: { icon?: string }) {
  const ref = parseIconRef(icon);
  if (!ref || !(ICON_SETS as readonly string[]).includes(ref.set)) return null;
  return <Icon set={ref.set as IconSet} name={ref.name} tintColor="var(--color-system-white)" className="h-4 w-4" />;
}

type Selection = { kind: "group"; gi: number } | { kind: "member"; gi: number; mi: number } | null;

function GroupTile({
  group, selected, onSelect, onLabel,
}: {
  group: StakeholderGroup;
  selected: boolean;
  onSelect: () => void;
  onLabel: (v: string) => void;
}) {
  return (
    <div
      onClick={onSelect}
      onFocus={onSelect}
      className={`after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:content-[''] after:border-border relative flex size-16 shrink-0 cursor-pointer flex-col items-center justify-center rounded-r16 bg-surface ${
        selected ? "ring-2 ring-primary" : "hover:after:border-system-500"
      }`}
    >
      <GroupIcon icon={group.icon} />
      <input
        value={group.label}
        onChange={(e) => onLabel(e.target.value)}
        placeholder="グループ名"
        aria-label="グループ名"
        className="w-full min-w-0 bg-transparent px-1 text-center font-sans text-[10px] font-bold leading-normal tracking-[0.5px] text-white outline-none placeholder:text-system-700"
      />
    </div>
  );
}

function MemberPill({
  member, name, selected, canDelete, onSelect, onLabel, onToggleMe, onDelete,
}: {
  member: StakeholderMember;
  name: string;
  selected: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onLabel: (v: string) => void;
  onToggleMe: () => void;
  onDelete: () => void;
}) {
  const me = member.me === true;
  const type = `font-en text-[11px] font-extrabold leading-none tracking-[0.44px] ${me ? "text-main-050" : "text-system-500"}`;
  return (
    <span className="flex min-w-0 max-w-full items-center gap-1">
      <Connector />
      <span
        onClick={onSelect}
        onFocus={onSelect}
        className={`group/pill after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:content-[''] relative flex h-8 min-w-0 max-w-full cursor-pointer items-center gap-2 whitespace-nowrap rounded-[32px] px-[9px] py-px ${
          me ? "after:border-border-main" : "after:border-border"
        } ${selected ? "ring-2 ring-primary" : ""}`}
      >
        <span className="flex min-w-0 max-w-full items-center gap-1.5">
          <Icon
            set="Peoples"
            name={member.label ? "peoples-two" : "user"}
            tintColor={me ? "var(--color-main-050)" : "var(--color-system-500)"}
            className="h-4 w-4 shrink-0"
          />
          <span className={`inline-grid min-w-[4ch] ${type}`}>
            <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-pre">{(member.label || "名前") + " "}</span>
            <input
              size={1}
              value={member.label}
              onChange={(e) => onLabel(e.target.value)}
              placeholder="名前"
              aria-label={`${name} の名前`}
              className={`col-start-1 row-start-1 w-full min-w-0 bg-transparent p-0 outline-none placeholder:text-system-700 ${type}`}
            />
          </span>
        </span>
        <button
          type="button"
          aria-pressed={me}
          aria-label={`${name} を自分（me）にする`}
          title="自分の立ち位置（me）"
          onClick={onToggleMe}
          className={`font-en rounded-full px-1.5 py-1 text-[10px] font-normal leading-none tracking-[0.3px] transition-colors ${
            me ? "bg-main-100 text-system-900" : "bg-transparent text-system-700 ring-1 ring-inset ring-border-light hover:text-white"
          }`}
        >
          me
        </button>
        {canDelete && (
          <button
            type="button"
            aria-label={`${name} を削除`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full border border-border-light bg-[#0a0a0a] text-[10px] leading-none text-system-500 opacity-0 transition-opacity hover:text-danger-300 focus-visible:opacity-100 group-hover/pill:opacity-100 group-focus-within/pill:opacity-100"
          >
            ×
          </button>
        )}
      </span>
    </span>
  );
}

export default function StakeholdersDiagramEditor({
  value, onChange, iconCatalog,
}: {
  value: StakeholdersData;
  onChange: (v: StakeholdersData) => void;
  iconCatalog: IconCatalog;
}) {
  const [selection, setSelection] = useState<Selection>(null);
  const sel: Selection = (() => {
    if (!selection) return null;
    const g = value.groups[selection.gi];
    if (!g) return null;
    if (selection.kind === "member" && !g.members[selection.mi]) return null;
    return selection;
  })();
  const clearIfBg = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) setSelection(null);
  };

  const addGroup = () => {
    onChange({ groups: [...value.groups, { label: "", members: [{ label: "" }] }] });
    setSelection({ kind: "group", gi: value.groups.length });
  };
  const addMember = (gi: number) => {
    const g = value.groups[gi];
    onChange(patchGroupAt(value, gi, { members: [...g.members, { label: "" }] }));
    setSelection({ kind: "member", gi, mi: g.members.length });
  };
  const removeGroup = (gi: number) => {
    onChange({ groups: value.groups.filter((_, i) => i !== gi) });
    setSelection(null);
  };
  const removeMember = (gi: number, mi: number) => {
    const g = value.groups[gi];
    if (g.members.length <= 1) return;
    onChange(patchGroupAt(value, gi, { members: g.members.filter((_, i) => i !== mi) }));
    setSelection(null);
  };
  const moveMember = (gi: number, mi: number, d: -1 | 1) => {
    const g = value.groups[gi];
    const to = mi + d;
    if (to < 0 || to >= g.members.length) return;
    onChange(patchGroupAt(value, gi, { members: moveItem(g.members, mi, to) }));
    setSelection({ kind: "member", gi, mi: to });
  };
  const moveGroup = (gi: number, d: -1 | 1) => {
    const to = gi + d;
    if (to < 0 || to >= value.groups.length) return;
    onChange({ groups: moveItem(value.groups, gi, to) });
    setSelection({ kind: "group", gi: to });
  };

  const selGroup = sel ? value.groups[sel.gi] : null;
  const selMember = sel && sel.kind === "member" && selGroup ? selGroup.members[sel.mi] : null;

  return (
    <div className="flex flex-col gap-3">
      <div
        onClick={clearIfBg}
        className="after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:content-[''] after:border-border relative rounded-r16 bg-surface p-10"
      >
        {value.groups.length === 0 ? (
          <button
            type="button"
            onClick={addGroup}
            className="flex h-16 w-full items-center justify-center rounded-[12px] border border-dashed border-border-light text-[12px] text-fg-muted transition-colors hover:border-primary hover:text-white"
          >
            ＋ グループを追加
          </button>
        ) : (
          <div onClick={clearIfBg} className="flex flex-col items-start gap-2 md:px-10">
            {value.groups.map((g, gi) => (
              <div key={gi} className="flex max-w-full items-center gap-1">
                <GroupTile
                  group={g}
                  selected={sel?.kind === "group" && sel.gi === gi}
                  onSelect={() => setSelection({ kind: "group", gi })}
                  onLabel={(v) => onChange(patchGroupAt(value, gi, { label: v }))}
                />
                <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-2">
                  {g.members.map((m, mi) => (
                    <MemberPill
                      key={mi}
                      member={m}
                      name={memberName(m, mi)}
                      selected={sel?.kind === "member" && sel.gi === gi && sel.mi === mi}
                      canDelete={g.members.length > 1}
                      onSelect={() => setSelection({ kind: "member", gi, mi })}
                      onLabel={(v) => onChange(patchMemberAt(value, gi, mi, { label: v }))}
                      onToggleMe={() => onChange(patchMemberAt(value, gi, mi, { me: m.me === true ? undefined : true }))}
                      onDelete={() => removeMember(gi, mi)}
                    />
                  ))}
                  <span className="flex items-center gap-1">
                    <Connector />
                    <button
                      type="button"
                      onClick={() => addMember(gi)}
                      className="flex h-8 items-center rounded-[32px] border border-dashed border-border-light px-[9px] text-[11px] text-fg-muted transition-colors hover:border-primary hover:text-white"
                    >
                      ＋ メンバー
                    </button>
                  </span>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addGroup}
              className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-r16 border border-dashed border-border-light text-[10px] text-fg-muted transition-colors hover:border-primary hover:text-white"
            >
              ＋<span>グループ</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-border-light bg-[#161616] p-3">
        {!sel || !selGroup ? (
          <p className="text-[11px] text-fg-muted">
            グループ（四角）やメンバー（丸）をクリックすると、ここでアイコン・並び替え・削除を編集できます。名前は図の上で直接入力できます。「me」を押すと自分の立ち位置になります
          </p>
        ) : sel.kind === "group" ? (
          <>
            <span className="text-[11px] text-fg-muted">グループ</span>
            <Input
              className="!w-36"
              placeholder="グループ名"
              value={selGroup.label}
              onChange={(v) => onChange(patchGroupAt(value, sel.gi, { label: v }))}
            />
            <IconPickerField
              className="w-80"
              catalog={iconCatalog}
              allowEmpty
              value={parseIconRef(selGroup.icon)}
              onChange={(v) => onChange(patchGroupAt(value, sel.gi, { icon: formatIconRef(v) }))}
            />
            <span className="ml-auto flex items-center gap-1">
              <MoveButtons
                index={sel.gi}
                length={value.groups.length}
                label={groupName(selGroup, sel.gi)}
                onMove={(d) => moveGroup(sel.gi, d)}
              />
              <button type="button" className={vizDel} onClick={() => removeGroup(sel.gi)}>グループ削除</button>
            </span>
          </>
        ) : selMember ? (
          <>
            <span className="text-[11px] text-fg-muted">{groupName(selGroup, sel.gi)} のメンバー</span>
            <Input
              className="!w-56"
              placeholder="メンバー名（役職）"
              value={selMember.label}
              onChange={(v) => onChange(patchMemberAt(value, sel.gi, sel.mi, { label: v }))}
            />
            <label className="inline-flex items-center gap-1 text-[11px] text-fg-muted">
              <input
                type="checkbox"
                className="h-3 w-3 accent-primary"
                checked={selMember.me === true}
                onChange={(e) => onChange(patchMemberAt(value, sel.gi, sel.mi, { me: e.target.checked }))}
              />
              me（自分）
            </label>
            <span className="ml-auto flex items-center gap-1">
              <button
                type="button"
                className={moveBtn}
                aria-label={`${memberName(selMember, sel.mi)} を前へ`}
                disabled={sel.mi === 0}
                onClick={() => moveMember(sel.gi, sel.mi, -1)}
              >
                ←
              </button>
              <button
                type="button"
                className={moveBtn}
                aria-label={`${memberName(selMember, sel.mi)} を後ろへ`}
                disabled={sel.mi === selGroup.members.length - 1}
                onClick={() => moveMember(sel.gi, sel.mi, 1)}
              >
                →
              </button>
              <button
                type="button"
                className={vizDel}
                disabled={selGroup.members.length === 1}
                title={selGroup.members.length === 1 ? LAST_MEMBER_HINT : undefined}
                onClick={() => removeMember(sel.gi, sel.mi)}
              >
                削除
              </button>
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
