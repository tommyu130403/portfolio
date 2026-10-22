import type { FC } from "react";
import Tag from "./Tag";
import ProtectedImage from "./ProtectedImage";

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
        "relative flex w-full min-w-0 flex-col overflow-hidden rounded-[14px]",
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-border after:transition-colors after:content-['']",
        // Figma: 通常時の影は内側 _ProjectCard に付くが外側 Card の clip で切れて画面に出ない → 影なし。
        // ホバー（Library Card Status=hover）は外側に 背景 Action/hover・枠 Border/Light・影 shadow を付ける。
        // 影が gap 16px を越えて隣のカードの下に隠れないよう、ホバー中は1段手前に出す
        onClick
          ? "hover:z-[1] hover:bg-action-hover hover:after:border-border-light hover:shadow-base transition-[background-color,box-shadow] cursor-pointer"
          : "",
      ].join(" ")}
    >
      <div className="relative aspect-[339/190.6875] w-full shrink-0">
        <ProtectedImage
          src={image}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        />
      </div>
      <div className="flex flex-col gap-4 min-h-[160px] p-4 min-w-0">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] leading-[12px] tracking-[0.3px] text-main-100">
            {category}
          </p>
          <p className="text-body-02-jp-bold text-system-white">
            {title}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Tag key={tag} label={tag} variant="skill" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkCard;
