import type { FC } from "react";

type HeadlineProps = {
  /** default の小見出し（日本語サブテキスト・グレー 12px）。SectionTitle のエピグラフ部分 */
  label?: string;
  /** 見出し本文。default では英語見出し（32px Avenir Heavy 白）、その他 variant では各見出しテキスト */
  title: string;
  /**
   * 見出しタイプ
   * - default: ページ上部のセクション見出し（JP サブ + EN 32px + 緑下線。Figma SectionTitle 836:3312）
   * - sub: 小見出し
   * - section: Work詳細のセクションタイトル（Headline/Section = Avenir Heavy 34px white）
   * - markdown-h1 / -h2 / -h3: コンテンツ内見出し（Library 305:265 = 01/02/03）
   */
  variant?: "default" | "sub" | "section" | "markdown-h1" | "markdown-h2" | "markdown-h3";
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

  // Headline/Section（Work詳細セクションタイトル）: Avenir Heavy 34px white
  if (variant === "section") {
    return (
      <p className="w-full text-[34px] font-extrabold leading-[1.2] text-white [word-break:break-word]">
        {title}
      </p>
    );
  }

  // Library 305:265 / 03: Avenir(Body/EN) Heavy 17px #9e9e9e
  if (variant === "markdown-h3") {
    return (
      <p className="w-full text-[17px] font-extrabold leading-normal tracking-[0.85px] text-[#9e9e9e]">
        {title}
      </p>
    );
  }

  // Library 305:265 / 02: Noto Sans JP Bold 20px main-050(#b3ffe7)
  if (variant === "markdown-h2") {
    return (
      <p className="w-full font-body text-[20px] font-bold leading-[1.5] tracking-[1px] text-main-050">
        {title}
      </p>
    );
  }

  // Library 305:265 / 01: Noto Sans JP Bold 24px white（装飾バー無し）
  if (variant === "markdown-h1") {
    return (
      <p className="w-full font-body text-[24px] font-bold leading-[1.5] tracking-[1.2px] text-white">
        {title}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-6 pb-6 w-full">
      <div className="flex flex-col gap-3 w-full [word-break:break-word]">
        <p className="font-body text-[12px] font-normal leading-normal tracking-[0.36px] text-system-500 w-full">{label ?? ""}</p>
        <p className="font-body text-[32px] font-extrabold leading-[1.3] text-white w-full [text-box-trim:trim-both] [text-box-edge:cap_alphabetic]">{title}</p>
      </div>
      <div className="h-[2px] w-6 rounded-[2px] bg-main-base" />
    </div>
  );
};

export default Headline;
