import type { FC } from "react";

type HeadlineProps = {
  /** default の小見出し（日本語サブテキスト・グレー 12px）。SectionTitle のエピグラフ部分 */
  label?: string;
  /** 見出し本文。default では英語見出し（32px Avenir Heavy 白）、その他 variant では各見出しテキスト */
  title: string;
  /**
   * 見出しタイプ
   * - default: ページ上部のセクション見出し（JP サブ + EN 32px。Figma SectionTitle 836:3312）
   * - sub: 小見出し
   * - section: Work詳細のセクションタイトル（Headline/Section = Avenir Heavy 34px white）
   * - markdown-h1 / -h2 / -h3: コンテンツ内見出し（Library 304:313 = 01/02（03 は Figma に無い））
   */
  variant?: "default" | "sub" | "section" | "markdown-h1" | "markdown-h2" | "markdown-h3";
};

const Headline: FC<HeadlineProps> = ({ label, title, variant = "default" }) => {
  if (variant === "sub") {
    return (
      <div className="flex items-center justify-center pb-3 w-full">
        <p className="flex-1 text-[18px] font-bold leading-[1.5] tracking-[0.9px] text-fg-muted">
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
  // ※ Figma の Headline セットは 01 / 02 の2バリアントのみで 03 は存在しない（Library 304:313 で確認・2026-09-08）。実装側のみの見出し。
  if (variant === "markdown-h3") {
    return (
      <p className="w-full text-[17px] font-extrabold leading-normal tracking-[0.85px] text-fg-muted">
        {title}
      </p>
    );
  }

  // Library 304:312 / 02: Noto Sans JP Bold 17px 行間AUTO System/500(#9E9E9E)
  if (variant === "markdown-h2") {
    return (
      <p className="w-full text-headline-02-jp text-system-500">
        {title}
      </p>
    );
  }

  // Library 305:265 / 01: Noto Sans JP Bold 24px white（装飾バー無し）
  if (variant === "markdown-h1") {
    return (
      <p className="w-full text-headline-01-jp text-white">
        {title}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start pb-8 w-full">
      <div className="flex flex-col gap-3 w-full [word-break:break-word]">
        <p className="font-body text-[12px] font-normal leading-normal tracking-[0.36px] text-system-500 w-full">{label ?? ""}</p>
        <p className="text-title-pj text-white w-full [text-box-trim:trim-both] [text-box-edge:cap_alphabetic]">{title}</p>
      </div>
    </div>
  );
};

export default Headline;
