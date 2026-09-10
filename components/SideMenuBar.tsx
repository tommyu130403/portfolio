"use client";

import { useEffect, useRef, useState } from "react";
import type { FC } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Icon, { IconProps } from "./Icon";
import { ButtonFunction } from "./ButtonFunction";
import { getItemClasses, resolveItemStatus } from "@/lib/figma-variants";
import { useAuth } from "@/lib/auth";

export type SideMenuSectionId = "introduction" | "career" | "works" | "skills";

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
  // Figma の Active は背景を持たず文字色だけ変わる（node 59:24912）。
  // 色だけが現在地の手がかりになるため aria-current を併せて出す（WCAG 1.4.1）。
  const status = resolveItemStatus(active);
  const width = collapsed ? "short" : "default";
  const className = getItemClasses(status, width);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);

  const updateTooltipPos = () => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTooltipPos({
      top: rect.top + rect.height / 2,
      left: rect.right + 8,
    });
  };

  useEffect(() => {
    if (!collapsed || !showTooltip) return;
    updateTooltipPos();
    const handle = () => updateTooltipPos();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [collapsed, showTooltip]);

  const content = (
    <>
      <Icon set={icon.set} name={icon.name} className="h-[18px] w-[18px] shrink-0" aria-hidden />
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

  const tooltip =
    collapsed && showTooltip && tooltipPos
      ? createPortal(
          <span
            className={[
              "pointer-events-none fixed z-[70] -translate-y-1/2",
              "rounded-r4 border border-border bg-surface px-3 py-[10px]",
              "text-[14px] leading-[20px] whitespace-nowrap text-white/80",
              "shadow-base",
            ].join(" ")}
            style={{ top: tooltipPos.top, left: tooltipPos.left }}
            role="tooltip"
          >
            {label}
          </span>,
          document.body
        )
      : null;

  if (href) {
    return (
      <div
        ref={wrapperRef}
        className="relative w-full"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocusCapture={() => setShowTooltip(true)}
        onBlurCapture={() => setShowTooltip(false)}
      >
        <Link href={href} className={className} aria-current={active ? "page" : undefined}>
          {content}
        </Link>
        {tooltip}
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="relative w-full"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocusCapture={() => setShowTooltip(true)}
      onBlurCapture={() => setShowTooltip(false)}
    >
      <button type="button" className={className} aria-current={active ? "true" : undefined}>
        {content}
      </button>
      {tooltip}
    </div>
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
  /** 折りたたみトグルボタンの表示（既定 true）。モバイルのオーバーレイ表示では false にする */
  showCollapseToggle?: boolean;
  /** セクションリンクの前置き。トップページは "" のまま(同一ページ内スクロール)、
      別ページ(/works 等)からは "/" を渡して "/#introduction" にする */
  hrefBase?: string;
};

export const SideMenuBar: FC<SideMenuBarProps> = ({
  activeSection,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  showCollapseToggle = true,
  hrefBase = "",
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = onCollapsedChange
    ? (v: boolean | ((prev: boolean) => boolean)) =>
        onCollapsedChange(typeof v === "function" ? v(collapsed) : v)
    : setInternalCollapsed;

  const { role, logout } = useAuth();

  return (
    <aside
      className={[
        "relative flex h-screen flex-col border-r border-border-light bg-surface rounded-[12px]",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[96px]" : "w-[256px]",
      ].join(" ")}
    >
      {/* Collapse / Expand button — absolute inside aside (no overflow on aside = not clipped) */}
      {showCollapseToggle && (
        <div className="absolute right-[-18px] top-[34px] z-10">
          <ButtonFunction
            direction={collapsed ? "right" : "left"}
            border="on"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          />
        </div>
      )}

      {/* Inner scrollable content — overflow-y here doesn't clip the absolute button above */}
      <div className="flex flex-col gap-6 p-6 items-start w-full h-full min-h-0 overflow-y-auto">
        {/* Title */}
        <p
          className={[
            "font-guide font-normal leading-8 tracking-[0.07px] text-primary whitespace-nowrap transition-all duration-300",
            collapsed ? "text-[12px]" : "text-[24px]",
          ].join(" ")}
        >
          Portfolio
        </p>

        {/* Profile */}
        <div className="flex items-center w-full gap-3">
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
        <div className="h-px w-full rounded-[2px] bg-border-light shrink-0" />

        {/* Navigation */}
        {/* pl-[2px]: アイコン中心が collapsed 時の aside 幅 96px の中央に揃う
            計算: p-6(24) + pl(2) + item px-3(12) = 38px → icon center = 48px = 96/2 */}
        <nav className="flex flex-1 flex-col gap-2 w-full items-start pl-[2px]">
          {/* Profile section */}
          <p className="text-[10px] uppercase tracking-[0.4px] text-white/50 whitespace-nowrap px-0">
            Profile
          </p>

          <SideMenuItem
            icon={{ set: "Peoples", name: "user" }}
            label="Introduction"
            href={`${hrefBase}#introduction`}
            active={activeSection === "introduction"}
            collapsed={collapsed}
          />
          <SideMenuItem
            icon={{ set: "Edit", name: "list-top" }}
            label="Career"
            href={`${hrefBase}#career`}
            active={activeSection === "career"}
            collapsed={collapsed}
          />
          <SideMenuItem
            icon={{ set: "Charts", name: "ranking" }}
            label="Works"
            href={`${hrefBase}#works`}
            active={activeSection === "works"}
            collapsed={collapsed}
          />
          <SideMenuItem
            icon={{ set: "Charts", name: "viencharts" }}
            label="Skills"
            href={`${hrefBase}#skills`}
            active={activeSection === "skills"}
            collapsed={collapsed}
          />

          {/* Divider */}
          <div className="my-2 h-px w-full rounded-[2px] bg-border-light shrink-0" />

          {/* Social section */}
          <p className="text-[10px] uppercase tracking-[0.4px] text-white/50 whitespace-nowrap px-0">
            Social
          </p>
          <SideMenuItem
            icon={{ set: "Peoples", name: "user" }}
            label="Profile"
            collapsed={collapsed}
          />

          {role === "owner" && (
            <>
              <div className="my-2 h-px w-full rounded-[2px] bg-border-light shrink-0" />
              <p className="text-[10px] uppercase tracking-[0.4px] text-white/50 whitespace-nowrap px-0">
                Developer
              </p>
              <SideMenuItem
                icon={{ set: "Base", name: "config" }}
                label="Admin"
                href="/admin"
                collapsed={collapsed}
              />
              <SideMenuItem
                icon={{ set: "Edit", name: "format-brush" }}
                label="Styleguide"
                href="/styleguide"
                collapsed={collapsed}
              />
            </>
          )}
        </nav>

        {/* Contact */}
        <SideMenuItem
          icon={{ set: "Office", name: "mail" }}
          label="Contact"
          collapsed={collapsed}
        />

        {process.env.NODE_ENV !== "development" && role !== null && (
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 w-full transition-colors duration-200"
            title="ログアウト"
          >
            <Icon set="Arrows" name="logout" className="h-[18px] w-[18px] shrink-0 text-white/30" />
            <span
              className={[
                "text-[10px] tracking-[0.4px] text-white/30 whitespace-nowrap overflow-hidden transition-all duration-300",
                collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100",
              ].join(" ")}
            >
              ログアウト
            </span>
          </button>
        )}
      </div>
    </aside>
  );
};

export default SideMenuBar;
