import type { FC } from "react";
import Icon from "./Icon";

type HistoryItemProps = {
  role: string;
  company: string;
  period: string;
  description: string;
};

const HistoryItem: FC<HistoryItemProps> = ({ role, company, period, description }) => (
  <div className="flex gap-6">
    <div className="flex flex-col items-center gap-2 pt-3 shrink-0">
      <span className="h-2 w-2 rounded-full bg-[#48f4be]" />
      <span className="flex-1 w-[2px] min-h-px rounded bg-[#424242]" />
    </div>
    <div className="flex flex-1 flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between gap-20">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <p className="text-[20px] leading-[1.5] text-[#48f4be]">{role}</p>
          <p className="text-[14px] leading-[1.5] tracking-[0.7px] text-[#b3ffe7]">{company}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Icon set="Time" name="calendar-three" className="h-4 w-4" />
          <p className="text-[14px] leading-5 tracking-[-0.15px] text-[#9e9e9e] whitespace-nowrap">
            {period}
          </p>
        </div>
      </div>
      <p className="text-[14px] leading-[1.5] tracking-[0.7px] text-white">{description}</p>
    </div>
  </div>
);

export default HistoryItem;
