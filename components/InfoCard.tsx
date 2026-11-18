import type { FC, ReactNode } from "react";
import { WORK_FIGURE_TONE } from "@/lib/work-figure-tone";
import { useWorkLayout } from "./WorkLayoutContext";

// v1 は凍結: 直すのは v2 だけ
const CARD_CLASS = {
  v1: {
    default: "flex flex-col gap-2 rounded-[14px] border p-4 border-border",
    accent: "flex flex-col gap-2 rounded-[14px] border p-4 border-border-main bg-main-100-a10",
  },
  v2: {
    default: `flex flex-col gap-2 p-4 ${WORK_FIGURE_TONE.cell}`,
    accent: `flex flex-col gap-2 rounded-r8 p-4 ${WORK_FIGURE_TONE.accent}`,
  },
} as const;

type InfoCardProps = {
  title?: ReactNode;
  /** accent = 強調カード（`::: card tone=accent`。Border/Main・main-100 10% の地・見出しは primary。inFigure でも見出しは primary のまま） */
  tone?: "default" | "accent";
  /** `::: figure` の内側（図版の panel 地の上）。地と枠は外と同じ（Figma InfoCard Tone=in-figure）。見出しは外と同じ Text/Headline-01 */
  inFigure?: boolean;
  /** v2 だけ。見出しなしの強調カードで本文が 1 段落のとき、中央に置いて文字を main-050 にする（コンセプトの中央カード） */
  centered?: boolean;
  children: ReactNode;
};

/**
 * 作品本文の `::: card` で挿入する汎用カード（見出しは任意・本文は Markdown）。
 * Figma Library InfoCard（574:503）に合わせる: 角丸 14・余白 四辺 16・gap 8・見出し Body/02/JP/Bold（13px）。
 * (2026-11-17 オーナー判断で、図版カード 578:498 にそろえていた余白 上28 左右32 下24・gap 20 から Figma の値へ戻した)
 * 地と枠: default / in-figure = 地なし + 枠 Indigo/750(2026-11-17 Figma 更新で地を廃止)、
 * accent = bg-main-100-a10（Main/100-α10）+ 枠 Border/Main（2026-11-13 照合）。
 */
const InfoCard: FC<InfoCardProps> = ({ title, tone = "default", centered, children }) => {
  const layout = useWorkLayout();
  // items-center は付けない: 子（MarkdownBody）は @container なので、幅が中身基準になると 0 に潰れて 1 文字ずつ折り返す
  const center = layout === "v2" && centered ? " justify-center text-center [text-wrap:balance] [&_p]:text-main-050" : "";
  return (
    <div className={`${CARD_CLASS[layout][tone]}${center}`}>
      {title ? (
        <p
          className={`text-body-02-jp-bold ${
            tone === "accent" ? "text-primary" : "text-fg-headline-01"
          }`}
        >
          {title}
        </p>
      ) : null}
      {children}
    </div>
  );
};

export default InfoCard;
