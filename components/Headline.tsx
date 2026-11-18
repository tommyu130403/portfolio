import type { FC } from "react";

type HeadlineProps = {
  /** default の小見出し（日本語サブテキスト・Main/base 12px）。SectionTitle のエピグラフ部分 */
  label?: string;
  /** 見出し本文。default では英語見出し（Title/EN 42px Afacad Bold・fg）、その他 variant では各見出しテキスト */
  title: string;
  /**
   * 見出しタイプ
   * - default: ページ上部のセクション見出し（Library SectionTitle 20:37・2026-10-25 確認: JP ラベル 12px Noto Regular・ls 3%・Main/base + Title/EN（2026-11-10〜 Afacad Bold 42px・行 100%）・Text/Body/Primary、gap 8・下余白 24。2026-11-09 再照合）
   * - sub: 小見出し
   * - section: Work詳細のセクションタイトル（Headline/Section = Avenir Heavy 34px text-fg）
   * - section-aside: 作品詳細のセクション見出し（Library Headline type=01・425:416: 22px Noto Sans JP Bold 白・lh 150%・ls 5% + 右へ伸びる 1px 罫線 border、gap 16）
   * - markdown-h1 / -h2: コンテンツ内見出し（Noto Sans JP Bold 18px・Main/050・線なし。2026-11-11 G3 の読みやすさ調整でオーナーが画面で決定。Library 304:302 は要更新）
   * - section-numbered: 作品詳細 v2 のセクション見出し（先頭に 2 桁の番号・下に 1px 罫線。見出し本体は section-aside と同じ h2 22px Bold）
   */
  variant?: "default" | "sub" | "section" | "section-aside" | "section-numbered" | "markdown-h1" | "markdown-h2";
  /** section-numbered の番号（"01" など）。見出し要素の外に置くので目次の見出し文字には入らない */
  number?: string;
};

const Headline: FC<HeadlineProps> = ({ label, title, variant = "default", number }) => {
  if (variant === "sub") {
    return (
      <div className="flex items-center justify-center pb-3 w-full">
        <p className="flex-1 text-[18px] font-bold leading-[1.5] tracking-[0.9px] text-fg-muted">
          {title}
        </p>
      </div>
    );
  }

  // Headline/Section（Work詳細セクションタイトル）: Avenir Heavy 34px text-fg
  if (variant === "section") {
    return (
      <p className="font-en w-full text-[34px] font-extrabold leading-[1.2] text-fg [word-break:break-word]">
        {title}
      </p>
    );
  }

  // 作品詳細のセクション見出し（Library Headline type=01・425:416: 22px Noto Sans JP Bold 白・lh 150%・ls 5% + 右へ伸びる 1px 罫線 border、gap 16）
  if (variant === "section-aside") {
    return (
      <div className="flex w-full items-center gap-4">
        <h2 className="min-w-0 text-[22px] font-bold leading-[1.5] tracking-[0.05em] text-fg [word-break:break-word]">
          {title}
        </h2>
        <span aria-hidden className="h-px min-w-4 flex-1 bg-border" />
      </div>
    );
  }

  // 作品詳細 v2: 番号（aria-hidden・h2 の外）+ 見出し + 下罫線
  if (variant === "section-numbered") {
    return (
      <div className="flex w-full items-baseline gap-3 border-b border-border pb-3">
        {number && (
          <span aria-hidden className="font-guide text-[17px] text-main-050">
            {number}
          </span>
        )}
        <h2 data-section-number={number} className="min-w-0 text-[22px] font-bold leading-[1.5] tracking-[0.05em] text-fg [word-break:break-word]">
          {title}
        </h2>
      </div>
    );
  }

  // Headline type=02（Library 304:302 は未更新・要反映）。2026-11-11 にコードを変更: 線なし・Noto Sans JP Bold 18px・lh 150%・ls 5%・文字 Main/050（背景との差 16.8:1）。h1・h2 とも同形の h3
  if (variant === "markdown-h1" || variant === "markdown-h2") {
    return (
      <div className="flex w-full items-center">
        <h3 className="flex-1 text-[18px] font-bold leading-[1.5] tracking-[0.05em] text-main-050">
          {title}
        </h3>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start pb-6 w-full">
      <div className="flex flex-col gap-2 w-full [word-break:break-word]">
        <p className="font-body text-[12px] font-normal leading-[14px] tracking-[0.05em] text-primary w-full">{label ?? ""}</p>
        <h2 className="text-title-en text-fg w-full">{title}</h2>
      </div>
    </div>
  );
};

export default Headline;
