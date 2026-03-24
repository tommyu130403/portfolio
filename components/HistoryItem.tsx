import type { FC } from "react";
import Icon from "./Icon";

type HistoryItemProps = {
  role: string;
  company: string;
  period: string;
  description: string;
  /** タイムラインの位置（先頭/中間/末尾） */
  timeline?: "end" | "middle" | "start";
};

const HistoryItem: FC<HistoryItemProps> = ({
  role,
  company,
  period,
  description,
  timeline = "end",
}) => (
  <div className="flex gap-6 items-start">
    {/* タイムライン */}
    <div className="flex flex-col items-center gap-1 self-stretch shrink-0">
      <div
        className={[
          "h-6 w-[2px] shrink-0 rounded-b-[2px]",
          timeline === "middle" || timeline === "start" ? "bg-[#424242]" : "",
        ].join(" ")}
      />
      <div
        className={[
          "size-3 border-2 rounded-full shrink-0",
          timeline === "start" ? "border-[#424242]" : "border-[#48f4be]",
        ].join(" ")}
      />
      <div
        className={[
          "flex-1 min-h-px w-[2px] rounded-t-[2px]",
          timeline === "start" ? "" : "bg-[#424242]",
        ].join(" ")}
      />
    </div>

    {/* コンテンツ */}
    <div className="flex flex-1 flex-col min-h-px min-w-0 pb-4">
      <div className="bg-[#1a1a1a] rounded-[14px] overflow-hidden w-full shrink-0">
        <div className="flex flex-col gap-3 p-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Icon set="Time" name="calendar-three-mint" className="h-4 w-4 shrink-0" />
              <p className="text-[11px] leading-[1.5] tracking-[0.33px] text-[#b3ffe7] whitespace-nowrap">
                {period}
              </p>
            </div>
            <p className="text-[17px] font-bold leading-[1.5] tracking-[0.51px] text-[#48f4be]">
              {role}
            </p>
            <p className="text-[11px] leading-[1.5] tracking-[0.33px] text-[#9e9e9e]">
              {company}
            </p>
          </div>
          <p className="text-[11px] leading-[1.5] tracking-[0.33px] text-white">
            {description}
          </p>
        </div>
      </div>
    </div>
  </div>
);

export default HistoryItem;
