import type { FC, ReactNode } from "react";

type InfoCardProps = {
  title?: ReactNode;
  /** accent = 強調カード（`::: card tone=accent`。Border/Main・main-100 10% の地・見出しは primary。inFigure より優先） */
  tone?: "default" | "accent";
  /** `::: figure` の内側（図版の panel 地の上）。地は indigo-800・枠なし。見出しは外と同じ Body/01 Bold */
  inFigure?: boolean;
  children: ReactNode;
};

/**
 * 作品本文の `::: card` で挿入する汎用カード（見出しは任意・本文は Markdown）。
 * Figma Library WorkFigure Kind=figure（578:498）に合わせる:
 * 角丸 16・余白 上28 左右32 下24・gap 20・地 Background/Light・枠なし・見出し Body/01 Bold。
 * 本文の容器が 560px 未満では左右 16px（図版の中の横棒グラフ・カード本文の幅を確保。8 の倍数に寄せる）。
 */
const InfoCard: FC<InfoCardProps> = ({ title, tone = "default", inFigure = false, children }) => (
  <div
    className={`flex flex-col gap-5 rounded-2xl px-4 pb-6 pt-7 @min-[560px]:px-8 ${
      tone === "accent"
        ? "border border-border-main bg-main-100/10"
        : inFigure
          ? "bg-indigo-800"
          : "bg-surface-light"
    }`}
  >
    {title ? (
      <p className={`text-body-01-jp-bold ${tone === "accent" ? "text-primary" : "text-fg"}`}>{title}</p>
    ) : null}
    {children}
  </div>
);

export default InfoCard;
