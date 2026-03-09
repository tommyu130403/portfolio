import type { FC } from "react";

type TagProps = {
  label: string;
  className?: string;
};

const Tag: FC<TagProps> = ({ label, className }) => (
  <div
    className={`flex items-center justify-center rounded-full bg-[#02140d] px-3 py-[3px] ${className ?? ""}`}
  >
    <p className="text-[12px] leading-4 text-[#1e765a]">{label}</p>
  </div>
);

export default Tag;
