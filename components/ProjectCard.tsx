import type { FC } from "react";
import Tag from "./Tag";

type ProjectCardProps = {
  category: string;
  title: string;
  tags: string[];
  image: string;
  onClick?: () => void;
};

const ProjectCard: FC<ProjectCardProps> = ({ category, title, tags, image, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={[
        "flex h-[363.5px] w-[280px] flex-col overflow-hidden rounded-[14px] border border-system-800 bg-system-900 shrink-0",
        "shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]",
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
      <div className="flex flex-1 flex-col justify-between min-h-[206px] p-6 min-w-0">
        <div className="flex flex-col gap-1">
          <p className="text-[12px] leading-[1.5] tracking-[0.36px] text-main-100">
            {category}
          </p>
          <p className="font-bold text-[17px] leading-[1.5] tracking-[0.51px] text-system-white">
            {title}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {tags.map((tag) => (
            <Tag key={tag} label={tag} variant="small" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
