"use client";

import { useState, type FC } from "react";
import Icon, { type IconProps } from "./Icon";

/**
 * TabBar — Figma Library node 70:441（_TabBarItem: 70:392）
 *
 * 外枠: Background/Light(#292929) / radius 8 / overflow-clip / 枠線なし
 * item: h40 / gap12 / pl16 pr24 / radius 8 / 14px Avenir / tracking 0.7px
 *   default: 背景なし・Text/Body/Sub(#9E9E9E)・Roman(400)
 *   Active : Background/Default(#212121) + Border/Default(#3A3A3A)・白・Heavy(800)
 *   hover  : Figma は rgba(255,255,255,0.02) だが 2% のトークンが無いため
 *            Action/hover(白5%)を使っている（差分は依頼書 §6 に記載）
 */

type TabItem = {
  id: string;
  label: string;
  icon: Pick<IconProps, "set" | "name">;
};

type TabBarProps = {
  tabs: TabItem[];
  defaultActiveId?: string;
  onChange?: (id: string) => void;
};

const TabBar: FC<TabBarProps> = ({ tabs, defaultActiveId, onChange }) => {
  const [activeId, setActiveId] = useState(defaultActiveId ?? tabs[0]?.id);

  const handleClick = (id: string) => {
    setActiveId(id);
    onChange?.(id);
  };

  return (
    <div className="flex items-start overflow-hidden rounded-[8px] bg-surface-light">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleClick(tab.id)}
            className={[
              "flex h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[8px] pl-4 pr-6 text-[14px] tracking-[0.7px] transition-colors whitespace-nowrap hover:bg-action-hover",
              isActive
                ? "border border-border bg-surface font-extrabold text-white"
                : "text-fg-muted",
            ].join(" ")}
          >
            <Icon set={tab.icon.set} name={tab.icon.name} className="h-[18px] w-[18px] shrink-0" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default TabBar;
