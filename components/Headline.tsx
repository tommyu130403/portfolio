import type { FC } from "react";

type HeadlineProps = {
  /** default の小見出し（日本語サブテキスト・グレー 12px）。SectionTitle のエピグラフ部分 */
  label?: string;
  /** 見出し本文。default では英語見出し（Title/EN 38px Avenir Heavy 白）、その他 variant では各見出しテキスト */
  title: string;
  /**
   * 見出しタイプ
   * - default: ページ上部のセクション見出し（JP サブ + Title/EN 38px Avenir Heavy。Figma SectionTitle 836:3312）
   * - sub: 小見出し
   * - section: Work詳細のセクションタイトル（Headline/Section = Avenir Heavy 34px white）
   * - section-aside: 作品詳細の左列見出し（Figma Master 994:4821・16px Noto Sans JP Bold 白）。幅は親が指定する
   * - markdown-h1 / -h2 / -h3: コンテンツ内見出し（h1・h2 は Library 304:302 の Headline 1種類。03 は Figma に無い）
   */
  variant?: "default" | "sub" | "section" | "section-aside" | "markdown-h1" | "markdown-h2" | "markdown-h3";
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
      <p className="font-en w-full text-[34px] font-extrabold leading-[1.2] text-white [word-break:break-word]">
        {title}
      </p>
    );
  }

  // Figma Master 994:4821: 作品詳細の左列見出し（16px Bold・lh1.5・tracking 0.8px・白）
  if (variant === "section-aside") {
    return (
      <p className="w-full text-[16px] font-bold leading-[1.5] tracking-[0.8px] text-white [word-break:break-word]">
        {title}
      </p>
    );
  }

  // Library 305:265 / 03: Avenir(Body/EN) Heavy 17px #9e9e9e
  // ※ Figma の Headline に 03 は存在しない。実装側のみの見出し。
  if (variant === "markdown-h3") {
    return (
      <p className="font-en w-full text-[17px] font-extrabold leading-normal tracking-[0.85px] text-fg-muted">
        {title}
      </p>
    );
  }

  // Library 304:302（Headline は1種類のみ・2026-10-14 確認）: 横線 16×1px + Noto Sans JP Bold 13px System/500。h1・h2 とも同形
  if (variant === "markdown-h1" || variant === "markdown-h2") {
    return (
      <div className="flex w-full items-center gap-2">
        <span aria-hidden className="h-px w-4 shrink-0 bg-system-500" />
        <p className="flex-1 text-[13px] font-bold leading-[1.5] tracking-[0.05em] text-system-500">
          {title}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start pb-8 w-full">
      <div className="flex flex-col gap-3 w-full [word-break:break-word]">
        <p className="font-body text-[12px] font-normal leading-[14px] tracking-[0.36px] text-system-500 w-full">{label ?? ""}</p>
        <p className="text-title-en text-white w-full">{title}</p>
      </div>
    </div>
  );
};

export default Headline;
