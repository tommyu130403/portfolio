"use client";

import type { FC } from "react";
import Icon from "./Icon";
import ButtonFunction from "./ButtonFunction";

type WorkBreadcrumbProps = {
  /** 現在の作品名（md 以上でパンくずに表示） */
  title: string;
  /** 現在位置（0 始まり） */
  index: number;
  /** 全件数。1 以下なら件数・矢印を出さない */
  total: number;
  onBack: () => void;
  /** 無いとき（先頭）は前ボタンを描画しない */
  onPrev?: () => void;
  /** 無いとき（最後）は次ボタンを描画しない */
  onNext?: () => void;
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 矢印ボタンを 44px の押下領域で包む。ButtonFunction は 36px 固定で className を
 * 受け取らないため、外側の 44px 要素がクリックを受け、内側ボタンのクリックは
 * バブリングで同じハンドラに届く（onClick は外側だけに付ける）。
 */
const HitArea: FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <div
    onClick={onClick}
    className="flex h-11 w-11 cursor-pointer items-center justify-center"
  >
    {children}
  </div>
);

const WorkBreadcrumb: FC<WorkBreadcrumbProps> = ({
  title,
  index,
  total,
  onBack,
  onPrev,
  onNext,
}) => {
  const showCounter = total > 1;

  return (
    <div className="flex min-h-11 min-w-0 items-center justify-between gap-3">
      <nav aria-label="パンくず" className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="relative flex shrink-0 items-center gap-1 text-system-500 after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] transition-colors hover:text-white"
          aria-label="Works一覧へ戻る"
        >
          <span className="flex shrink-0 md:hidden" aria-hidden>
            <Icon
              set="Arrows"
              name="left"
              tintColor="currentColor"
              className="h-2 w-2 shrink-0"
              aria-hidden
            />
          </span>
          <span className="font-guide text-[12px] leading-[1.3] tracking-[0.6px]">Works</span>
        </button>
        <span
          className="hidden font-guide text-[12px] leading-[1.3] tracking-[0.6px] text-border-light md:inline"
          aria-hidden
        >
          /
        </span>
        <span
          className="hidden min-w-0 truncate font-guide text-[12px] leading-[1.3] tracking-[0.6px] text-fg-caption md:inline"
          aria-current="page"
        >
          {title}
        </span>
      </nav>

      {showCounter && (
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-guide text-[12px] leading-[1.3] tracking-[0.6px] tabular-nums text-system-500">
            <span className="text-system-white">{pad(index + 1)}</span> / {pad(total)}
          </span>
          <div className="hidden items-center md:flex">
            {onPrev && (
              <HitArea onClick={onPrev}>
                <ButtonFunction direction="left" border="on" aria-label="前のWork" />
              </HitArea>
            )}
            {onNext && (
              <HitArea onClick={onNext}>
                <ButtonFunction direction="right" border="on" aria-label="次のWork" />
              </HitArea>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkBreadcrumb;
