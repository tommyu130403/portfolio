import type { FC, ReactNode } from "react";

type InfoCardProps = {
  title?: ReactNode;
  children: ReactNode;
};

/** 作品本文の `::: card` で挿入する汎用カード（見出しは任意・本文は Markdown） */
const InfoCard: FC<InfoCardProps> = ({ title, children }) => (
  <div className="flex flex-col gap-2 rounded-[14px] border border-border bg-surface p-4">
    {title ? (
      <p className="text-body-02-jp-bold text-system-white">{title}</p>
    ) : null}
    {children}
  </div>
);

export default InfoCard;
