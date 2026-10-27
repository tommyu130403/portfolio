import type { FC } from "react";
import Tag from "./Tag";
import ProtectedImage from "./ProtectedImage";

type WorkCardProps = {
  category?: string | null;
  title: string;
  contents: string[];
  period?: string | null;
  image: string;
  onClick?: () => void;
};

const WorkCard: FC<WorkCardProps> = ({ category, title, contents, period, image, onClick }) => {
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
      {/* Figma Master 494:1363: 本文 p16・gap24。上段（カテゴリチップ＋期間 / 作品名）gap4、下段に制作内容タグ */}
      <div className="flex min-h-[160px] min-w-0 flex-col gap-6 p-4">
        <div className="flex flex-col gap-1">
          {/* カテゴリも期間も無ければ行ごと出さない（親の gap-1 で 4px の空きが残らないように）。
              長いカテゴリは省略し、期間（右端）は折り返さない */}
          {(category || period) && (
            <div className="flex items-center justify-between gap-2">
              {category ? <Tag variant="category" label={category} className="min-w-0" /> : null}
              {period ? (
                <p className="ml-auto shrink-0 font-en text-[11px] font-extrabold leading-none tracking-[0.33px] text-fg-subtle whitespace-nowrap [text-box:trim-both_cap_alphabetic]">
                  {period}
                </p>
              ) : null}
            </div>
          )}
          <p className="text-[15px] font-bold leading-[1.6] tracking-[0.45px] text-fg">
            {title}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {contents.map((content) => (
            <Tag key={content} label={content} variant="content" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkCard;
