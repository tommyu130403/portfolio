import type { FC } from "react";

type HeadlineProps = {
  /** 英語ラベル（小さい緑テキスト） */
  label: string;
  /** 日本語タイトル */
  title: string;
};

const Headline: FC<HeadlineProps> = ({ label, title }) => (
  <div className="flex flex-col gap-2 pb-6 w-full">
    <p className="text-[12px] leading-normal tracking-[0.6px] text-[#48f4be]">{label}</p>
    <p className="font-mplus text-[32px] leading-[1.5] tracking-[1.6px] text-white">{title}</p>
    <div className="h-[2px] w-10 rounded bg-[#424242]" />
  </div>
);

export default Headline;
