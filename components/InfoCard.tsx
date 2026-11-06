import type { FC, ReactNode } from "react";

type InfoCardProps = {
  title?: ReactNode;
  /** accent = 強調カード（`::: card tone=accent`。Border/Main・main-100 の薄い地・見出しは primary） */
  tone?: "default" | "accent";
  /** `::: figure` の内側（図版の panel 地の上）。地は surface-light・見出しは fg-muted（文字は外と同じ Body/02 Bold 13px） */
  inFigure?: boolean;
  children: ReactNode;
};

/** 作品本文の `::: card` で挿入する汎用カード（見出しは任意・本文は Markdown） */
const InfoCard: FC<InfoCardProps> = ({ title, tone = "default", inFigure = false, children }) => (
  <div
    className={`flex flex-col gap-2 rounded-[14px] border p-4 ${
      tone === "accent" ? "border-border-main bg-main-100/10" : inFigure ? "border-border bg-surface-light" : "border-border bg-surface"
    }`}
  >
    {title ? (
      <p
        className={`text-body-02-jp-bold ${
          tone === "accent" ? "text-primary" : inFigure ? "text-fg-muted" : "text-system-white"
        }`}
      >
        {title}
      </p>
    ) : null}
    {children}
  </div>
);

export default InfoCard;
