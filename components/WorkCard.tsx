import type { FC } from "react";
import Tag from "./Tag";

type WorkCardProps = {
  category: string;
  title: string;
  tags: string[];
  image: string;
  onClick?: () => void;
};

const WorkCard: FC<WorkCardProps> = ({ category, title, tags, image, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={[
        "flex w-full min-w-0 flex-col overflow-hidden rounded-[14px] border border-border",
        "shadow-base",
        onClick
          ? "hover:border-system-500 hover:bg-system-800 transition-colors cursor-pointer"
          : "",
      ].join(" ")}
    >
      <div className="relative aspect-[339/190.6875] w-full shrink-0">
        <img
          src={image}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        />
      </div>
      <div className="flex flex-col gap-4 min-h-[160px] p-4 min-w-0">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] leading-[normal] tracking-[0.3px] text-main-100">
            {category}
          </p>
          <p className="text-body-02-jp-bold text-system-white">
            {title}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Tag key={tag} label={tag} variant="small" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkCard;
