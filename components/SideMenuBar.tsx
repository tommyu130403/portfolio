import type { FC } from "react";
import Icon, { IconProps } from "./Icon";

export type SideMenuItemProps = {
  /** 左側のアイコン設定 */
  icon: Pick<IconProps, "set" | "name">;
  /** ラベル文言 */
  label: string;
  /** 選択状態（背景が強調される） */
  active?: boolean;
  /** テキストラベルを表示するか（サイドバー縮小時は false にする） */
  showLabel?: boolean;
  /** 右側に表示するアイコン（ドロップダウン矢印など） */
  rightIcon?: Pick<IconProps, "set" | "name">;
  /** 幅を広く取る通常サイズかどうか */
  fullWidth?: boolean;
};

/**
 * サイドメニュー内で使用する汎用アイテムコンポーネント。
 * Figma「Item」コンポーネントをベースに、アイコン＋ラベル＋オプションの右アイコンを表現。
 */
const SideMenuItem: FC<SideMenuItemProps> = ({
  icon,
  label,
  active = false,
  showLabel = true,
  rightIcon,
  fullWidth = true,
}) => {
  const baseClasses =
    "flex items-center gap-3 max-w-[256px] px-3 py-2 rounded-[8px] shrink-0 text-[15px] tracking-[0.75px] transition-colors";

  const widthClass = fullWidth ? "w-[208px]" : "";
  const stateClasses = active
    ? "bg-[rgba(255,255,255,0.05)] text-[#E0E0E0]"
    : "text-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.03)]";

  return (
    <button type="button" className={`${baseClasses} ${widthClass} ${stateClasses}`}>
      <Icon
        set={icon.set}
        name={icon.name}
        className="h-[18px] w-[18px]"
        aria-hidden={!showLabel}
      />

      {showLabel && (
        <span className="flex-1 text-left leading-none">{label}</span>
      )}

      {rightIcon && (
        <Icon
          set={rightIcon.set}
          name={rightIcon.name}
          className="h-4 w-4"
          aria-hidden
        />
      )}
    </button>
  );
};

export type SideMenuBarProps = {
  /** Figma のバリアントに合わせたサイズ。デフォルトは "default"。 */
  size?: "default" | "small";
};

/**
 * Figma Library「SideMenuBar」コンポーネントをもとにしたサイドメニュー。
 * - `size="default"`: テキスト付きのフル幅サイドバー
 * - `size="small"`: テキストを省いたコンパクトなサイドバー
 */
export const SideMenuBar: FC<SideMenuBarProps> = ({ size = "default" }) => {
  const isSmall = size === "small";
  const showLabel = !isSmall;

  return (
    <aside
      className={[
        "flex h-[1024px] flex-col gap-6 rounded-[12px] border-r border-[#424242] bg-[#212121] p-6",
        isSmall ? "w-[88px] items-center" : "w-[256px] items-start",
      ].join(" ")}
    >
      {/* Header */}
      {!isSmall && (
        <p className="text-center text-2xl leading-8 tracking-[0.07px] text-[#48F4BE]">
          Portfolio
        </p>
      )}

      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 overflow-hidden rounded-full bg-slate-500">
          {/* ここにアバター画像を入れる場合は <img> を追加 */}
        </div>
        {showLabel && (
          <div className="flex flex-1 flex-col">
            <span className="text-[10px] uppercase tracking-[0.4px] text-white/50">
              Product Designer
            </span>
            <span className="text-sm text-white/80">Yu Tomita</span>
          </div>
        )}
      </div>

      <div className="h-px w-full rounded-[2px] bg-[#424242]" />

      {/* Profile section */}
      <nav className="flex flex-1 flex-col gap-2 text-sm">
        {!isSmall && (
          <p className="px-3 text-[10px] uppercase tracking-[0.4px] text-white/50">
            Profile
          </p>
        )}

        <SideMenuItem
          icon={{ set: "Peoples", name: "user" }}
          label="Introduction"
          showLabel={showLabel}
          fullWidth={!isSmall}
        />

        <SideMenuItem
          icon={{ set: "Edit", name: "list-top" }}
          label="Career"
          showLabel={showLabel}
          fullWidth={!isSmall}
        />

        <SideMenuItem
          icon={{ set: "Charts", name: "ranking" }}
          label="Projects"
          active
          showLabel={showLabel}
          rightIcon={{ set: "Arrows", name: "down" }}
          fullWidth={!isSmall}
        />

        {/* Dropdown links（Projects配下のサブリンク） */}
        {showLabel && (
          <div className="ml-6 mt-1 flex flex-col gap-1">
            <button className="rounded-[8px] px-3 py-2 text-left text-xs tracking-[0.6px] text-[rgba(255,255,255,0.5)]">
              label
            </button>
            <button className="rounded-[8px] bg-[rgba(255,255,255,0.05)] px-3 py-2 text-left text-xs tracking-[0.6px] text-[#E0E0E0]">
              label
            </button>
            <button className="rounded-[8px] px-3 py-2 text-left text-xs tracking-[0.6px] text-[rgba(255,255,255,0.5)]">
              label
            </button>
            <button className="rounded-[8px] px-3 py-2 text-left text-xs tracking-[0.6px] text-[rgba(255,255,255,0.5)]">
              label
            </button>
          </div>
        )}

        {/* Skills item */}
        <SideMenuItem
          icon={{ set: "Charts", name: "radar-chart" }}
          label="Skills"
          showLabel={showLabel}
          fullWidth={!isSmall}
        />

        <div className="mt-4 h-px w-full rounded-[2px] bg-[#424242]" />

        {/* Social section */}
        {!isSmall && (
          <p className="px-3 text-[10px] uppercase tracking-[0.4px] text-white/50">
            Social
          </p>
        )}

        <SideMenuItem
          icon={{ set: "Peoples", name: "user" }}
          label="Profile"
          showLabel={showLabel}
          fullWidth={!isSmall}
        />
      </nav>

      {/* Collapse / expand button */}
      <button
        type="button"
        className="absolute right-[-15px] top-[34px] flex items-center rounded-[8px] border border-[#424242] bg-[#212121] p-[6px]"
        aria-label={isSmall ? "Expand sidebar" : "Collapse sidebar"}
      >
        <Icon
          set="Arrows"
          name={isSmall ? "right" : "left"}
          className="h-[14px] w-[8px]"
        />
      </button>

      {/* Contact item（フッター） */}
      <SideMenuItem
        icon={{ set: "Office", name: "mail" }}
        label="Contact"
        showLabel={showLabel}
        fullWidth={!isSmall}
      />
    </aside>
  );
};

export default SideMenuBar;

