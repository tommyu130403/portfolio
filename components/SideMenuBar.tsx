"use client";

import { useEffect, useRef, useState } from "react";
import type { FC } from "react";
import { createPortal } from "react-dom";
import Icon, { IconProps } from "./Icon";
import { ButtonFunction } from "./ButtonFunction";
import { getItemClasses, resolveItemStatus } from "@/lib/figma-variants";

const IS_DEV = process.env.NODE_ENV === "development";
const PROD_PREVIEW_KEY = "portfolio_prod_preview";

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
              "rounded-[14px] border border-[#424242] bg-[#212121] px-3 py-2",
              "text-[12px] leading-[1.5] tracking-[0.36px] whitespace-nowrap text-[var(--color-white)]",
              "shadow-[1px_1px_16px_2px_rgba(0,0,0,0.25)]",
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
        <a href={href} className={className}>
          {content}
        </a>
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
      <button type="button" className={className}>
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

  // 本番環境プレビュートグル（開発環境のみ）
  // SSR との不一致を防ぐため、localStorage の値はハイドレーション後に反映する
  const [isProdPreview, setIsProdPreview] = useState(false);
  useEffect(() => {
    setIsProdPreview(localStorage.getItem(PROD_PREVIEW_KEY) === "true");
  }, []);
  const toggleProdPreview = () => {
    const next = !isProdPreview;
    setIsProdPreview(next);
    localStorage.setItem(PROD_PREVIEW_KEY, String(next));
  };

  return (
    <aside
      className={[
        "relative flex h-screen flex-col border-r border-[#424242] bg-[#212121] rounded-[12px]",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[96px]" : "w-[256px]",
      ].join(" ")}
    >
      {/* Collapse / Expand button — absolute inside aside (no overflow on aside = not clipped) */}
      <div className="absolute right-[-18px] top-[34px] z-10">
        <ButtonFunction
          direction={collapsed ? "right" : "left"}
          border="on"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        />
      </div>

      {/* Inner scrollable content — overflow-y here doesn't clip the absolute button above */}
      <div className="flex flex-col gap-6 p-6 items-start w-full h-full min-h-0 overflow-y-auto">
        {/* Title */}
        <p
          className={[
            "font-guide font-normal leading-8 tracking-[0.07px] text-[#48F4BE] whitespace-nowrap transition-all duration-300",
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
        <div className="h-px w-full rounded-[2px] bg-[#424242] shrink-0" />

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
            icon={{ set: "Charts", name: "viencharts" }}
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

          {/* Developer section - local only */}
          {IS_DEV && !isProdPreview && (
            <>
              <div className="my-2 h-px w-full rounded-[2px] bg-[#424242] shrink-0" />
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

        {/* Production preview toggle - local dev only */}
        {IS_DEV && (
          <button
            type="button"
            onClick={toggleProdPreview}
            title={isProdPreview ? "本番プレビュー中（クリックで開発表示に戻す）" : "本番プレビューを有効化"}
            className="flex items-center gap-2 w-full transition-colors duration-200"
          >
            <div
              className={[
                "relative h-4 w-7 shrink-0 rounded-full transition-colors duration-200",
                isProdPreview ? "bg-[#48f4be]" : "bg-[#424242]",
              ].join(" ")}
            >
              <div
                className={[
                  "absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200",
                  isProdPreview ? "translate-x-3" : "translate-x-0",
                ].join(" ")}
              />
            </div>
            <span
              className={[
                "text-[10px] tracking-[0.4px] whitespace-nowrap overflow-hidden transition-all duration-300",
                isProdPreview ? "text-[#48f4be]" : "text-white/30",
                collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100",
              ].join(" ")}
            >
              {isProdPreview ? "本番プレビュー中" : "本番プレビュー"}
            </span>
          </button>
        )}
      </div>
    </aside>
  );
};

export default SideMenuBar;
