"use client";

import { useState } from "react";
import type { FC } from "react";
import Icon, { IconProps } from "./Icon";
import { ButtonFunction } from "./ButtonFunction";
import { getItemClasses, resolveItemStatus } from "@/lib/figma-variants";

export type SideMenuSectionId = "introduction" | "career" | "projects" | "skills";

const AVATAR_URL =
  "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=88&q=80";

// ─────────────────────────────────────────────
// SideMenuItem（Figma _Item: Size, Status, Width）
// ─────────────────────────────────────────────
type SideMenuItemProps = {
  icon: Pick<IconProps, "set" | "name">;
  label: string;
  href?: string;
  active?: boolean;
  collapsed?: boolean;
};

const SideMenuItem: FC<SideMenuItemProps> = ({
  icon,
  label,
  href,
  active = false,
  collapsed = false,
}) => {
  const status = resolveItemStatus(active);
  const width = collapsed ? "short" : "default";
  const className = getItemClasses(status, width);

  const content = (
    <>
      <Icon set={icon.set} name={icon.name} className="h-5 w-5 shrink-0" style={{ minWidth: 20, minHeight: 20 }} aria-hidden />
      <span
        className={[
          "flex-1 text-left text-[15px] leading-none tracking-[0.75px] whitespace-nowrap overflow-hidden transition-all duration-300",
          collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100",
        ].join(" ")}
      >
        {label}
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" className={className}>
      {content}
    </button>
  );
};

// ─────────────────────────────────────────────
// SideMenuBar
// ─────────────────────────────────────────────
type SideMenuBarProps = {
  activeSection?: SideMenuSectionId;
  /** サイドバー折りたたみ状態（省略時は内部で管理） */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

export const SideMenuBar: FC<SideMenuBarProps> = ({
  activeSection,
  collapsed: controlledCollapsed,
  onCollapsedChange,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = onCollapsedChange
    ? (v: boolean | ((prev: boolean) => boolean)) =>
        onCollapsedChange(typeof v === "function" ? v(collapsed) : v)
    : setInternalCollapsed;

  return (
    <aside
      className={[
        "relative flex min-h-screen flex-col gap-6 border-r border-[#424242] bg-[#212121] p-6 rounded-[12px] items-start",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[88px]" : "w-[256px]",
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
        className="flex items-center w-full gap-3"
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
      <nav className="flex flex-1 flex-col gap-2 w-full items-start">
        {/* Profile section */}
        <p className="text-[10px] uppercase tracking-[0.4px] text-white/50 whitespace-nowrap px-0">
          Profile
        </p>

        <SideMenuItem
          icon={{ set: "Peoples", name: "user" }}
          label="Introduction"
          href="#introduction"
          active={activeSection === "introduction"}
          collapsed={collapsed}
        />
        <SideMenuItem
          icon={{ set: "Edit", name: "list-top" }}
          label="Career"
          href="#career"
          active={activeSection === "career"}
          collapsed={collapsed}
        />

        <SideMenuItem
          icon={{ set: "Charts", name: "ranking" }}
          label="Projects"
          href="#projects"
          active={activeSection === "projects"}
          collapsed={collapsed}
        />

        <SideMenuItem
          icon={{ set: "Charts", name: "radar-chart" }}
          label="Skills"
          href="#skills"
          active={activeSection === "skills"}
          collapsed={collapsed}
        />

        {/* Divider */}
        <div className="my-2 h-px w-full rounded-[2px] bg-[#424242] shrink-0" />

        {/* Social section */}
        <p className="text-[10px] uppercase tracking-[0.4px] text-white/50 whitespace-nowrap px-0">
          Social
        </p>

        <SideMenuItem
          icon={{ set: "Peoples", name: "user" }}
          label="Profile"
          collapsed={collapsed}
        />
      </nav>

      {/* Collapse / Expand button (Figma Button/Function) */}
      <div className="absolute right-[-15px] top-[34px]">
        <ButtonFunction
          direction={collapsed ? "right" : "left"}
          border="on"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        />
      </div>

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
