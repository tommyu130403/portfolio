import type { FC, ReactNode } from "react";

type TagProps = {
  label: string;
  className?: string;
  /** Figma Tag/Small: bg black/25, 12px white. 未指定時は従来の main 系 */
  variant?: "default" | "small";
  prefix?: ReactNode;
  suffix?: ReactNode;
};

const Tag: FC<TagProps> = ({ label, className, variant = "default", prefix, suffix }) => {
  const isSmall = variant === "small";
  return (
    <div
      className={
        isSmall
          ? `bg-[rgba(0,0,0,0.25)] flex gap-2 items-center px-2 py-1 rounded-[8px] shrink-0 ${className ?? ""}`
          : `flex items-center justify-center rounded-full bg-[#02140d] px-3 py-[3px] ${className ?? ""}`
      }
    >
      {prefix}
      <p
        className={
          isSmall
            ? "text-[10px] leading-none text-system-white whitespace-nowrap"
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
