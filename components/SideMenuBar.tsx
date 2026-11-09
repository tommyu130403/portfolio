"use client";

import { useEffect, useRef, useState } from "react";
import type { FC } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Icon, { IconProps } from "./Icon";
import ContactDialog, { clearContactDraft } from "./ContactDialog";
import { getItemClasses, resolveItemStatus } from "@/lib/figma-variants";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/src/lib/supabase";
import ProtectedImage from "./ProtectedImage";

export type SideMenuSectionId = "introduction" | "career" | "works" | "skills";

// アイコンは自己紹介のポートレート(profile.hero_image_url)を使う。
// メニューはトップで 2 つ(PC 用とモバイル用)同時に描かれるため、同時の取得は 1 回にまとめる。
// 画面を開くたびに取り直す(管理画面で差し替えた直後に戻っても新しい画像になるように)。
// 取り直すあいだは直前の画像を出し、灰色の丸がちらつかないようにする
let lastAvatarUrl = "";
let avatarRequest: Promise<string> | null = null;
function loadAvatarUrl(): Promise<string> {
  // 取得に失敗したときだけ直前の画像を使う。取得できて空なら(画像を外したなら)空に戻す
  avatarRequest ??= Promise.resolve()
    .then(() => supabase.from("profile").select("hero_image_url").eq("id", 1).single())
    .then(({ data, error }) => (error ? null : data?.hero_image_url ?? ""), () => null)
    .then((value) => {
      avatarRequest = null;
      if (value !== null) lastAvatarUrl = value;
      return lastAvatarUrl;
    });
  return avatarRequest;
}

function useAvatarUrl(): string {
  const [url, setUrl] = useState(lastAvatarUrl);
  useEffect(() => {
    let active = true;
    loadAvatarUrl().then((value) => { if (active) setUrl(value); });
    return () => { active = false; };
  }, []);
  return url;
}

// 外部サイトは新しいタブで開く(SideMenuItem が http から始まる href を外部と見なす)
const SOCIAL_LINKS: { label: string; icon: Pick<IconProps, "set" | "name">; href: string }[] = [
  { label: "GitHub", icon: { set: "Brand", name: "logo-github" }, href: "https://github.com/tommyu130403" },
  {
    label: "YOUTRUST",
    icon: { set: "Brand", name: "logo-youtrust" },
    href: "https://youtrust.jp/users/d9c58189b5ae60afa33c27d939759f7c",
  },
];

// ─────────────────────────────────────────────
// SideMenuItem（Figma _Item: Size, Status, Width）
// ─────────────────────────────────────────────
type SideMenuItemProps = {
  icon: Pick<IconProps, "set" | "name">;
  label: string;
  href?: string;
  /** href が無いとき(ボタンとして描くとき)に押したら呼ぶ */
  onClick?: () => void;
  /** 押すとダイアログが開くボタンのとき "dialog"(読み上げで伝える) */
  hasPopup?: "dialog";
  active?: boolean;
  collapsed?: boolean;
  /** Figma の _Item width=short。ラベルを表示せず、aria-label とツールチップで示す */
  iconOnly?: boolean;
};

const SideMenuItem: FC<SideMenuItemProps> = ({
  icon,
  label,
  href,
  onClick,
  hasPopup,
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
      {/* アイコンは文字色に追従させる（通常時 System/500、ホバーと表示中は白。Figma 59:24643） */}
      <Icon
        set={icon.set}
        name={icon.name}
        tintColor="currentColor"
        className={`h-[18px] w-[18px] shrink-0 transition-colors duration-300 ${active ? "text-white" : "text-system-500 group-hover/item:text-white"}`}
        aria-hidden
      />
      {!iconOnly && (
        <span
          className={[
            "font-en flex-1 text-left text-[15px] leading-[20px] tracking-[0.75px] whitespace-nowrap overflow-hidden max-w-[160px] transition-opacity duration-300",
            // 幅は動かさず透明度だけ切り替える(折りたたみ時は親の幅でクリップされる)
            collapsed ? "opacity-0" : "opacity-100",
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
    const external = /^https?:\/\//.test(href);
    return (
      <div
        ref={wrapperRef}
        className={iconOnly ? "relative" : "relative w-full"}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={hideTooltip}
        onFocusCapture={() => setShowTooltip(true)}
        onBlurCapture={hideTooltip}
      >
        {external ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
            aria-label={iconOnly ? `${label}(新しいタブで開きます)` : undefined}
          >
            {content}
          </a>
        ) : (
          <Link
            href={href}
            className={className}
            aria-current={active ? "page" : undefined}
            aria-label={iconOnly ? label : undefined}
          >
            {content}
          </Link>
        )}
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
        onClick={onClick}
        aria-haspopup={hasPopup}
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
  /** 折りたたみ状態の固定。省略時はホバー / キーボードフォーカスで展開する（既定は折りたたみ 96px、
      展開時 216px でページ内容に重なる）。モバイルのオーバーレイ表示やスタイルガイドでは
      collapsed={false} 等で固定する */
  collapsed?: boolean;
  /** セクションリンクの前置き。トップページは "" のまま(同一ページ内スクロール)、
      別ページ(/works 等)からは "/" を渡して "/#introduction" にする */
  hrefBase?: string;
};

export const SideMenuBar: FC<SideMenuBarProps> = ({
  activeSection,
  collapsed: fixedCollapsed,
  hrefBase = "",
}) => {
  const [hovered, setHovered] = useState(false);
  // マウスのクリックで入ったフォーカスは対象外（ポインターが離れたら閉じるため）
  const [keyboardFocusWithin, setKeyboardFocusWithin] = useState(false);
  const isHoverMode = fixedCollapsed === undefined;
  const collapsed = fixedCollapsed ?? !(hovered || keyboardFocusWithin);

  const { supabaseSession, accessRole, logout } = useAuth();
  const avatarUrl = useAvatarUrl();
  const [logoutError, setLogoutError] = useState("");
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        // マウスで離れたら、キーボード由来の展開も閉じる(クリックで残ったフォーカスで開きっぱなしにしない)
        setHovered(false);
        setKeyboardFocusWithin(false);
      }}
      onFocusCapture={(e) => {
        if ((e.target as HTMLElement).matches(":focus-visible")) setKeyboardFocusWithin(true);
      }}
      onBlurCapture={(e) => {
        const next = e.relatedTarget as Node | null;
        if (!next || !e.currentTarget.contains(next)) setKeyboardFocusWithin(false);
      }}
      className={[
        "relative flex h-screen flex-col bg-surface",
        "after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border after:content-['']",
        "transition-[width] duration-300 ease-in-out",
        // 展開幅 216px = 最も幅の広い中身(プロフィールの「PRODUCT DESIGNER」右端 187px)+ 右余白 24px = 211px を 8 の倍数へ切り上げ。
        // size トークンに近い値(200 では切れる / 次は 320)がないため直書き
        collapsed ? "w-[96px]" : "w-[216px]",
        isHoverMode && !collapsed ? "shadow-base" : "",
      ].join(" ")}
    >
      <div className="flex flex-col gap-6 p-6 items-start w-full h-full min-h-0 overflow-y-auto overflow-x-hidden">
        {/* Title */}
        {/* font-size は動かさず scale で縮める(24px × 0.5 = 折りたたみ時の 12px)。レイアウト再計算を避ける。
            w-0: 縮める前の幅が場所を取ると、折りたたみ時に中身が横へはみ出してスクロールできてしまうため */}
        <p
          className={[
            "w-0 font-guide font-normal text-[24px] leading-8 tracking-[0.0703px] text-primary whitespace-nowrap origin-left transition-transform duration-300",
            collapsed ? "scale-50" : "",
          ].join(" ")}
        >
          Portfolio
        </p>

        {/* Profile */}
        <div className="flex items-center w-full gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[36px] bg-surface-light">
            {avatarUrl && (
              <ProtectedImage
                src={avatarUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
          </div>
          <div
            className={[
              "flex flex-col gap-1 min-w-0 overflow-hidden max-w-[160px] transition-opacity duration-300",
              collapsed ? "opacity-0" : "opacity-100",
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

        {accessRole === "owner" && (
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
          onClick={() => setContactOpen(true)}
          hasPopup="dialog"
          collapsed={collapsed}
        />

        {supabaseSession === "signedIn" && (
          <button
            type="button"
            onClick={() => {
              setLogoutError("");
              clearContactDraft();
              void logout()
                .then((error) => { if (error) setLogoutError(error); })
                .catch(() => setLogoutError("ログアウトできませんでした"));
            }}
            className="flex items-center gap-2 w-full transition-colors duration-200"
            title="ログアウト"
          >
            <Icon set="Arrows" name="logout" className="h-[18px] w-[18px] shrink-0 text-white/30" />
            <span
              className={[
                "text-[10px] tracking-[0.4px] text-white/30 whitespace-nowrap overflow-hidden max-w-[160px] transition-opacity duration-300",
                collapsed ? "opacity-0" : "opacity-100",
              ].join(" ")}
            >
              ログアウト
            </span>
          </button>
        )}
        {logoutError && <p className="text-[12px] text-danger-300" role="alert">{logoutError}</p>}
      </div>
    </aside>
    {/* aside の外に置く(メニューのホバー・フォーカス展開の判定にダイアログ内の操作を混ぜないため) */}
    {contactOpen && <ContactDialog onClose={() => setContactOpen(false)} />}
    </>
  );
};

export default SideMenuBar;
