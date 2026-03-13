import type { FC } from "react";
import Icon from "./Icon";
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
        "flex h-[363.5px] w-[280px] flex-col overflow-hidden rounded-[14px] border border-[#424242] bg-[#212121]",
        "shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] shrink-0",
        onClick ? "hover:border-[#9e9e9e] hover:bg-[rgba(255,255,255,0.05)] transition-colors cursor-pointer" : "",
      ].join(" ")}
    >
      <div className="relative aspect-[339/190.6875] w-full shrink-0">
        <img
          src={image}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        />
      </div>
      <div className="flex flex-1 flex-col justify-between p-6 min-h-0">
        <div className="flex flex-col gap-1">
          <div className="flex h-5 items-center justify-between">
            <p className="flex-1 text-[12px] leading-[1.5] tracking-[0.36px] text-[#b3ffe7] min-w-0">
              {category}
            </p>
            {onClick ? (
              <Icon set="Base" name="link" className="h-4 w-4 shrink-0" />
            ) : (
              <Icon set="Base" name="more" className="h-4 w-4 shrink-0" />
            )}
          </div>
          <p className="text-[17px] leading-[1.5] tracking-[0.51px] text-white">{title}</p>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {tags.map((tag) => (
            <Tag key={tag} label={tag} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
