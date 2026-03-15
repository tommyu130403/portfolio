import type { FC } from "react";

type TagProps = {
  label: string;
  className?: string;
  /** Figma Tag/Small: bg black/25, 10px white. 未指定時は従来の main 系 */
  variant?: "default" | "small";
};

const Tag: FC<TagProps> = ({ label, className, variant = "default" }) => {
  const isSmall = variant === "small";
  return (
    <div
      className={
        isSmall
          ? `flex items-center justify-center rounded-full bg-black/25 px-3 py-[3px] ${className ?? ""}`
          : `flex items-center justify-center rounded-full bg-[#02140d] px-3 py-[3px] ${className ?? ""}`
      }
    >
      <p
        className={
          isSmall
            ? "text-[10px] leading-4 text-system-white whitespace-nowrap"
            : "text-[12px] leading-4 text-[#1e765a]"
        }
      >
        {label}
      </p>
    </div>
  );
};

export default Tag;
