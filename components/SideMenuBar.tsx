"use client";

import { useEffect, useState } from "react";
import type { FC } from "react";
import Icon, { IconProps } from "./Icon";

const AVATAR_URL =
  "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=88&q=80";

// ─────────────────────────────────────────────
// SideMenuItem（ドロップダウンなしの通常アイテム）
// ─────────────────────────────────────────────
type SideMenuItemProps = {
  icon: Pick<IconProps, "set" | "name">;
  label: string;
  active?: boolean;
  collapsed?: boolean;
};

const SideMenuItem: FC<SideMenuItemProps> = ({
  icon,
  label,
  active = false,
  collapsed = false,
}) => {
  const state = active
    ? "bg-[rgba(255,255,255,0.05)] text-[#E0E0E0]"
    : "text-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.03)]";

  return (
    <button
      type="button"
      className={[
        "flex items-center rounded-[8px] shrink-0 transition-colors overflow-hidden",
        collapsed ? "w-10 h-10 justify-center" : "w-[208px] gap-3 px-3 py-[10px]",
        state,
      ].join(" ")}
    >
      <Icon set={icon.set} name={icon.name} className="h-5 w-5 shrink-0" aria-hidden />
      <span
        className={[
          "flex-1 text-left text-[15px] leading-none tracking-[0.75px] whitespace-nowrap overflow-hidden transition-all duration-300",
          collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100",
        ].join(" ")}
      >
        {label}
      </span>
    </button>
  );
};

// ─────────────────────────────────────────────
// ItemDropdown（ドロップダウン付きアイテム）
// Figma「Item」width=default/short × open/closed パターン
// ─────────────────────────────────────────────
type DropdownItem = { label: string; active?: boolean };

type ItemDropdownProps = {
  icon: Pick<IconProps, "set" | "name">;
  label: string;
  collapsed?: boolean;
  items: DropdownItem[];
};

const ItemDropdown: FC<ItemDropdownProps> = ({
  icon,
  label,
  collapsed = false,
  items,
}) => {
  const [open, setOpen] = useState(false);

  // サイドバー縮小時はドロップダウンを閉じる
  useEffect(() => {
    if (collapsed) setOpen(false);
  }, [collapsed]);

  /* ── short（縮小）モード ──────────────────── */
  if (collapsed) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="group relative flex items-center px-3 py-[10px] rounded-[8px] bg-[rgba(255,255,255,0.05)] text-[#E0E0E0] transition-colors"
        >
          <Icon set={icon.set} name={icon.name} className="h-5 w-5 shrink-0" aria-hidden />

          {/* ツールチップ（hover時・閉じているとき） */}
          {!open && (
            <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-1 flex -translate-y-1/2 items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              {/* 左向き三角 */}
              <div
                className="h-0 w-0 shrink-0"
                style={{
                  borderTop: "7px solid transparent",
                  borderBottom: "7px solid transparent",
                  borderRight: "7px solid #9e9e9e",
                }}
              />
              <div className="rounded-[4px] bg-[#212121] px-3 py-[10px] text-[14px] leading-5 text-white/80 whitespace-nowrap shadow-[0_0_0_1px_#9e9e9e]">
                {label}
              </div>
            </div>
          )}
        </button>

        {/* フローティングドロップダウン（クリック時） */}
        {open && (
          <div className="absolute left-full top-0 z-50 ml-2 flex flex-col gap-1 rounded-[8px] border border-[#424242] bg-[#212121] p-2">
            {items.map((item, i) => (
              <button
                key={i}
                type="button"
                className={[
                  "w-[172px] rounded-[8px] px-3 py-2 text-left text-[12px] tracking-[0.6px] whitespace-nowrap transition-colors",
                  item.active
                    ? "bg-[rgba(255,255,255,0.05)] text-[#E0E0E0]"
                    : "text-white/50 hover:bg-[rgba(255,255,255,0.03)]",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── default（展開）モード ───────────────── */
  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-[208px] items-center gap-3 rounded-[8px] bg-[rgba(255,255,255,0.05)] px-3 py-[10px] text-[#E0E0E0] transition-colors hover:bg-[rgba(255,255,255,0.08)]"
      >
        <Icon set={icon.set} name={icon.name} className="h-5 w-5 shrink-0" aria-hidden />
        <span className="flex-1 text-left text-[15px] leading-none tracking-[0.75px] whitespace-nowrap">
          {label}
        </span>
        <Icon
          set="Arrows"
          name={open ? "up" : "down"}
          className="h-4 w-4 shrink-0"
          aria-hidden
        />
      </button>

      {/* インラインサブリスト */}
      <div
        className={[
          "flex flex-col gap-1 w-[172px] overflow-hidden transition-all duration-300",
          open ? "max-h-[200px] opacity-100 mt-1" : "max-h-0 opacity-0 pointer-events-none",
        ].join(" ")}
      >
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            className={[
              "rounded-[8px] px-3 py-2 text-left text-[12px] tracking-[0.6px] whitespace-nowrap transition-colors",
              item.active
                ? "bg-[rgba(255,255,255,0.05)] text-[#E0E0E0]"
                : "text-white/50 hover:bg-[rgba(255,255,255,0.03)]",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// SideMenuBar
// ─────────────────────────────────────────────
const PROJECTS_ITEMS: DropdownItem[] = [
  { label: "label" },
  { label: "label", active: true },
  { label: "label" },
  { label: "label" },
];

export const SideMenuBar: FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={[
        "relative flex min-h-screen flex-col gap-6 border-r border-[#424242] bg-[#212121] p-6 rounded-[12px]",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[88px] items-center" : "w-[256px] items-start",
      ].join(" ")}
    >
      {/* Title */}
      <p
        className={[
          "font-normal leading-8 tracking-[0.07px] text-[#48F4BE] whitespace-nowrap transition-all duration-300",
          collapsed ? "text-[12px]" : "text-[24px]",
        ].join(" ")}
      >
        Portfolio
      </p>

      {/* Profile */}
      <div
        className={[
          "flex items-center w-full transition-all duration-300",
          collapsed ? "justify-center" : "gap-3",
        ].join(" ")}
      >
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[36px]">
          <img
            src={AVATAR_URL}
            alt="Avatar"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <div
          className={[
            "flex flex-col gap-1 min-w-0 overflow-hidden transition-all duration-300",
            collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100",
          ].join(" ")}
        >
          <span className="text-[10px] uppercase tracking-[0.4px] text-white/50 leading-[12px] whitespace-nowrap">
            Product Designer
          </span>
          <span className="text-[14px] leading-5 text-white/80 whitespace-nowrap">Yu Tomita</span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px w-full rounded-[2px] bg-[#424242] shrink-0" />

      {/* Navigation */}
      <nav
        className={[
          "flex flex-1 flex-col gap-2 w-full transition-all duration-300",
          collapsed ? "items-center" : "items-start",
        ].join(" ")}
      >
        {/* Profile section */}
        <p
          className={[
            "text-[10px] uppercase tracking-[0.4px] text-white/50 whitespace-nowrap transition-all duration-300",
            collapsed ? "text-center" : "px-3",
          ].join(" ")}
        >
          Profile
        </p>

        <SideMenuItem
          icon={{ set: "Peoples", name: "user" }}
          label="Introduction"
          collapsed={collapsed}
        />
        <SideMenuItem
          icon={{ set: "Edit", name: "list-top" }}
          label="Career"
          collapsed={collapsed}
        />

        {/* Projects ドロップダウン */}
        <ItemDropdown
          icon={{ set: "Charts", name: "ranking" }}
          label="Projects"
          collapsed={collapsed}
          items={PROJECTS_ITEMS}
        />

        <SideMenuItem
          icon={{ set: "Charts", name: "radar-chart" }}
          label="Skills"
          collapsed={collapsed}
        />

        {/* Divider */}
        <div className="my-2 h-px w-full rounded-[2px] bg-[#424242] shrink-0" />

        {/* Social section */}
        <p
          className={[
            "text-[10px] uppercase tracking-[0.4px] text-white/50 whitespace-nowrap transition-all duration-300",
            collapsed ? "text-center" : "px-3",
          ].join(" ")}
        >
          Social
        </p>

        <SideMenuItem
          icon={{ set: "Peoples", name: "user" }}
          label="Profile"
          collapsed={collapsed}
        />
      </nav>

      {/* Collapse / Expand button */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="absolute right-[-15px] top-[34px] flex items-center rounded-[8px] border border-[#424242] bg-[#212121] p-[6px]"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <Icon
          set="Arrows"
          name={collapsed ? "right" : "left"}
          className="h-[14px] w-[8px]"
        />
      </button>

      {/* Contact */}
      <SideMenuItem
        icon={{ set: "Office", name: "mail" }}
        label="Contact"
        collapsed={collapsed}
      />
    </aside>
  );
};

export default SideMenuBar;
