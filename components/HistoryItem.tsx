import type { FC } from "react";
import Icon from "./Icon";

type HistoryItemProps = {
  role: string;
  company: string;
  period: string;
  description: string;
};

const HistoryItem: FC<HistoryItemProps> = ({ role, company, period, description }) => (
  <div className="flex gap-6 items-start">
    {/* タイムライン */}
    <div className="flex flex-col items-center gap-1 self-stretch shrink-0">
      <div className="h-6 w-[2px] shrink-0 bg-[#424242] rounded-b-[2px]" />
      <div className="size-3 border-2 border-[#48f4be] rounded-full shrink-0" />
      <div className="flex-1 min-h-px w-[2px] bg-[#424242] rounded-t-[2px]" />
    </div>

    {/* コンテンツ */}
    <div className="flex flex-1 flex-col min-h-px min-w-0 pb-4">
      <div className="bg-[rgba(0,0,0,0.25)] rounded-[14px] overflow-hidden w-full shrink-0">
        <div className="flex flex-col gap-3 p-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Icon set="Time" name="calendar-three" className="h-4 w-4 shrink-0" />
              <p className="text-[14px] leading-5 tracking-[-0.15px] text-[#9e9e9e] whitespace-nowrap">
                {period}
              </p>
            </div>
            <p className="text-[20px] leading-[1.5] font-bold text-[#48f4be]">{role}</p>
            <p className="text-[14px] leading-[1.5] tracking-[0.42px] text-[#b3ffe7]">{company}</p>
          </div>
          <p className="text-[14px] leading-[1.5] tracking-[0.42px] text-white">{description}</p>
        </div>
      </div>
    </div>
  </div>
);

export default HistoryItem;
