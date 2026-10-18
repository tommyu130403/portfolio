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

// URL 未入手。入手後に href を足す
const SOCIAL_LINKS: { label: string; icon: Pick<IconProps, "set" | "name">; href?: string }[] = [
  { label: "GitHub", icon: { set: "Brand", name: "logo-github" } },
  { label: "YOUTRUST", icon: { set: "Brand", name: "logo-youtrust" } },
];

// ─────────────────────────────────────────────
// SideMenuItem（Figma _Item: Size, Status, Width）
// ─────────────────────────────────────────────
type SideMenuItemProps = {
  icon: Pick<IconProps, "set" | "name">;
  label: string;
  href?: string;
  active?: boolean;
  collapsed?: boolean;
  /** Figma の _Item width=short。ラベルを表示せず、aria-label とツールチップで示す */
  iconOnly?: boolean;
};

const SideMenuItem: FC<SideMenuItemProps> = ({
  icon,
  label,
  href,
  active = false,
  collapsed = false,
  iconOnly = false,
}) => {
  // Figma の Active は背景を持たず文字色だけ変わる（node 59:24912）。
  // 色だけが現在地の手がかりになるため aria-current を併せて出す（WCAG 1.4.1）。
  const status = resolveItemStatus(active);
  const width = iconOnly ? "hug" : collapsed ? "short" : "default";
  const className = getItemClasses(status, width);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  // ツールチップの向き: 縦に並ぶ項目（折りたたみ時）は右、横に並ぶ項目（展開時の Social アイコン）は下
  const placement = collapsed ? "right" : "bottom";
  // 隠すときに位置も消す（次に出すとき、前回の位置で一瞬描かれないように）
  const hideTooltip = () => {
    setShowTooltip(false);
    setTooltipPos(null);
  };

  useEffect(() => {
    if (!(collapsed || iconOnly) || !showTooltip) return;
    const handle = () => {
      // 包み div は折りたたみ時に横幅いっぱいなので、ボタン本体の位置で測る
      const el = wrapperRef.current?.firstElementChild ?? wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setTooltipPos(
        placement === "right"
          ? { top: rect.top + rect.height / 2, left: rect.right + 4 }
          : { top: rect.bottom + 4, left: rect.left }
      );
    };
    // 初回も次のフレームで測る（effect 内で同期に setState しない）
    const raf = requestAnimationFrame(handle);
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [collapsed, iconOnly, showTooltip, placement]);

  const content = (
    <>
      <Icon set={icon.set} name={icon.name} className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {!iconOnly && (
        <span
          className={[
            "font-en flex-1 text-left text-[15px] leading-[20px] tracking-[0.75px] whitespace-nowrap overflow-hidden transition-all duration-300",
            collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100",
          ].join(" ")}
        >
          {label}
        </span>
      )}
    </>
  );

  const tooltip =
    (collapsed || iconOnly) && showTooltip && tooltipPos
      ? createPortal(
          <span
            className={[
              "font-en pointer-events-none fixed z-[70]",
              "rounded-r4 border border-border bg-surface px-3 py-[10px]",
              "text-[14px] leading-[20px] whitespace-nowrap text-white/80",
              "shadow-base",
            ].join(" ")}
            style={{
              top: tooltipPos.top,
              left: tooltipPos.left,
              transform: placement === "right" ? "translateY(-50%)" : undefined,
            }}
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
        className={iconOnly ? "relative" : "relative w-full"}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={hideTooltip}
        onFocusCapture={() => setShowTooltip(true)}
        onBlurCapture={hideTooltip}
      >
        <Link
          href={href}
          className={className}
          aria-current={active ? "page" : undefined}
          aria-label={iconOnly ? label : undefined}
        >
          {content}
        </Link>
        {tooltip}
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={iconOnly ? "relative" : "relative w-full"}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={hideTooltip}
      onFocusCapture={() => setShowTooltip(true)}
      onBlurCapture={hideTooltip}
    >
      <button
        type="button"
        className={className}
        aria-current={active ? "true" : undefined}
        aria-label={iconOnly ? label : undefined}
      >
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

  const { entered, supabaseSession, logout } = useAuth();

  return (
    <aside
      className={[
        "relative flex h-screen flex-col bg-surface",
        "after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border after:content-['']",
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
            "font-guide font-normal leading-8 tracking-[0.0703px] text-primary whitespace-nowrap transition-all duration-300",
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
            <span className="font-en font-medium text-[10px] uppercase tracking-[0.4px] text-white/50 leading-[12px] whitespace-nowrap">
              Product Designer
            </span>
            <span className="font-en font-medium text-[14px] leading-5 text-white/80 whitespace-nowrap">Yu Tomita</span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px w-full rounded-[2px] bg-border shrink-0" />

        {/* Profile section */}
        {/* pl-[2px]: 折りたたみ時のみ。アイコン中心が collapsed 時の aside 幅 96px の中央に揃う
            計算: p-6(24) + pl(2) + item px-3(12) = 38px → icon center = 48px = 96/2 */}
        <nav
          aria-label="Profile"
          className={["flex flex-col gap-2 w-full items-start", collapsed ? "pl-[2px]" : ""].join(" ")}
        >
          <p className="font-en font-medium text-[10px] uppercase tracking-[0.4px] leading-[12px] text-white/50 whitespace-nowrap px-0">
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
        </nav>

        {/* Divider */}
        <div className="h-px w-full rounded-[2px] bg-border shrink-0" />

        {/* Social section */}
        <nav
          aria-label="Social"
          className={["flex flex-1 flex-col gap-2 w-full items-start", collapsed ? "pl-[2px]" : ""].join(" ")}
        >
          <p className="font-en font-medium text-[10px] uppercase tracking-[0.4px] leading-[12px] text-white/50 whitespace-nowrap px-0">
            Social
          </p>
          <div className={collapsed ? "flex flex-col gap-2" : "flex gap-2"}>
            {SOCIAL_LINKS.map((l) => (
              <SideMenuItem
                key={l.label}
                iconOnly
                icon={l.icon}
                label={l.label}
                href={l.href}
                collapsed={collapsed}
              />
            ))}
          </div>
        </nav>

        {(process.env.NODE_ENV === "development" || supabaseSession === "signedIn") && (
          <>
            <div className="h-px w-full rounded-[2px] bg-border shrink-0" />
            <nav
              aria-label="Developer"
              className={["flex flex-col gap-2 w-full items-start", collapsed ? "pl-[2px]" : ""].join(" ")}
            >
              <p className="font-en font-medium text-[10px] uppercase tracking-[0.4px] leading-[12px] text-white/50 whitespace-nowrap px-0">
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
            </nav>
          </>
        )}

        {/* Contact */}
        <SideMenuItem
          icon={{ set: "Office", name: "mail" }}
          label="Contact"
          collapsed={collapsed}
        />

        {process.env.NODE_ENV !== "development" && (entered || supabaseSession === "signedIn") && (
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
