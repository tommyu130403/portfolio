"use client";

import { useState, type FC } from "react";
import Icon, { type IconProps } from "./Icon";

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
    <div className="flex items-start overflow-hidden rounded-[8px] bg-[rgba(255,255,255,0.05)]">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleClick(tab.id)}
            className={[
              "flex h-[40px] items-center justify-center gap-3 rounded-[8px] px-6 text-[14px] tracking-[0.7px] transition-colors whitespace-nowrap",
              isActive
                ? "border border-[#424242] bg-[rgba(255,255,255,0.05)] font-semibold text-white"
                : "text-[#9e9e9e]",
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
