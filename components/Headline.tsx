import type { FC } from "react";

type HeadlineProps = {
  /** 英語ラベル（小さい緑テキスト） */
  label?: string;
  /** 日本語タイトル */
  title: string;
  /** 見出しタイプ（default: セクション見出し / sub: 小見出し / markdown-h1 / markdown-h2） */
  variant?: "default" | "sub" | "markdown-h1" | "markdown-h2";
};

const Headline: FC<HeadlineProps> = ({ label, title, variant = "default" }) => {
  if (variant === "sub") {
    return (
      <div className="flex items-center justify-center pb-3 w-full">
        <p className="flex-1 text-[18px] font-bold leading-[1.5] tracking-[0.9px] text-[#9e9e9e]">
          {title}
        </p>
      </div>
    );
  }

  if (variant === "markdown-h2") {
    return (
      <p className="text-[20px] font-bold leading-[1.5] tracking-[1px] text-white w-full">
        {title}
      </p>
    );
  }

  if (variant === "markdown-h1") {
    return (
      <div className="flex items-start gap-2 w-full">
        <div className="flex items-center self-stretch py-2 shrink-0">
          <div className="w-[3px] h-full rounded-[2px] bg-[#48f4be]" />
        </div>
        <p className="flex-1 text-[24px] font-bold leading-[1.5] tracking-[1.2px] text-white">
          {title}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pb-6 w-full">
      <div className="flex flex-col w-full">
        <p className="font-guide text-[12px] leading-normal tracking-[0.6px] text-[#48f4be] w-full">{label ?? ""}</p>
        <p className="font-mplus text-[32px] font-bold leading-[1.5] tracking-[1.6px] text-white w-full">{title}</p>
      </div>
      <div className="h-[2px] w-10 rounded bg-[#424242]" />
    </div>
  );
};

export default Headline;
