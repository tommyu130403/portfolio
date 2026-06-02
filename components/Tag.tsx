import type { FC, ReactNode } from "react";

type TagProps = {
  label: string;
  className?: string;
  /**
   * default: 従来の main 系（プロジェクトカード等）
   * small:   Figma Tag/Small（bg black/25・12px white）
   * tool:    Figma Slot-Tool（border付き・グレー文字・16pxアイコン前置。スキル展開パネル用）
   */
  variant?: "default" | "small" | "tool";
  prefix?: ReactNode;
  suffix?: ReactNode;
};

const Tag: FC<TagProps> = ({ label, className, variant = "default", prefix, suffix }) => {
  if (variant === "tool") {
    return (
      <div
        className={`flex gap-[4px] items-center rounded-full border border-[#424242] bg-[rgba(0,0,0,0.25)] px-[10px] py-[4px] shrink-0 ${className ?? ""}`}
      >
        {prefix}
        <p className="text-[11px] leading-none text-[#9E9E9E] whitespace-nowrap">{label}</p>
        {suffix}
      </div>
    );
  }

  const isSmall = variant === "small";
  return (
    <div
      className={
        isSmall
          ? `bg-[rgba(0,0,0,0.25)] flex gap-2 items-center px-3 py-1 rounded-full shrink-0 ${className ?? ""}`
          : `flex items-center justify-center rounded-full bg-[#02140d] px-3 py-[3px] ${className ?? ""}`
      }
    >
      {prefix}
      <p
        className={
          isSmall
            ? "text-[11px] leading-none text-system-white whitespace-nowrap"
            : "text-[12px] leading-4 text-[#1e765a]"
        }
      >
        {label}
      </p>
      {suffix}
    </div>
  );
};

export default Tag;
