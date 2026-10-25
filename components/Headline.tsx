import type { FC } from "react";

type HeadlineProps = {
  /** default の小見出し（日本語サブテキスト・mint-050 12px）。SectionTitle のエピグラフ部分 */
  label?: string;
  /** 見出し本文。default では英語見出し（Title/EN 38px Avenir Heavy・fg）、その他 variant では各見出しテキスト */
  title: string;
  /**
   * 見出しタイプ
   * - default: ページ上部のセクション見出し（Library SectionTitle 20:37・2026-10-25 確認: JP ラベル 12px Noto Regular・ls 3%・Main/050 + Title/EN 38px Avenir Heavy・Text/Body/Primary、gap 12・下余白 24）
   * - sub: 小見出し
   * - section: Work詳細のセクションタイトル（Headline/Section = Avenir Heavy 34px white）
   * - section-aside: 作品詳細のセクション見出し（Library Headline type=01・425:416・2026-10-25 確認: 24px Noto Sans JP Bold 白・lh 150%・ls 5% + 右へ伸びる 1px 罫線 border、gap 16）
   * - markdown-h1 / -h2 / -h3: コンテンツ内見出し（h1・h2 は Library Headline type=02・304:302 の 16px mint。03 は Figma に無い）
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

  // 作品詳細のセクション見出し（Library Headline type=01・425:416・2026-10-25 確認: 24px Noto Sans JP Bold 白・lh 150%・ls 5% + 右へ伸びる 1px 罫線 border、gap 16）
  if (variant === "section-aside") {
    return (
      <div className="flex w-full items-center gap-4">
        <p className="min-w-0 text-[24px] font-bold leading-[1.5] tracking-[0.05em] text-white [word-break:break-word]">
          {title}
        </p>
        <span aria-hidden className="h-px min-w-4 flex-1 bg-border" />
      </div>
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

  // Library Headline type=02（304:302・2026-10-25 確認）: 横線 16×1px Main/050 + Noto Sans JP Bold 16px・lh 150%・ls 5%・Main/050、gap 8。h1・h2 とも同形
  if (variant === "markdown-h1" || variant === "markdown-h2") {
    return (
      <div className="flex w-full items-center gap-2">
        <span aria-hidden className="h-px w-4 shrink-0 bg-main-050" />
        <p className="flex-1 text-[16px] font-bold leading-[1.5] tracking-[0.05em] text-main-050">
          {title}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start pb-6 w-full">
      <div className="flex flex-col gap-3 w-full [word-break:break-word]">
        <p className="font-body text-[12px] font-normal leading-[14px] tracking-[0.36px] text-main-050 w-full">{label ?? ""}</p>
        <p className="text-title-en text-fg w-full">{title}</p>
      </div>
    </div>
  );
};

export default Headline;
