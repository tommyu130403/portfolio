"use client";

import type { FC } from "react";
import Link from "next/link";
import Icon from "./Icon";
import { BUTTON_FUNCTION } from "@/lib/figma-button-variants";

/** ガイド文字（EN 12px / 行間 1.3 / 字間 0.6px）。WorkPagerCard と共用 */
export const GUIDE_TEXT = "font-guide text-[12px] leading-[1.3] tracking-[0.6px]";

type WorkBreadcrumbProps = {
  /** 現在の作品名（md 以上でパンくずに表示） */
  title: string;
  /** 現在位置（0 始まり） */
  index: number;
  /** 全件数。1 以下なら件数・矢印を出さない */
  total: number;
  /** 無いとき（先頭）は前ボタンを描画しない */
  prevHref?: string;
  /** 無いとき（最後）は次ボタンを描画しない */
  nextHref?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 前後の矢印リンク。ButtonFunction は <button> で <a> の中に入れられないため、
 * 44×44 の Link の中に BUTTON_FUNCTION と同じクラスの span を置いて見た目を揃える。
 */
const ArrowLink: FC<{ href: string; direction: "left" | "right"; label: string }> = ({
  href,
  direction,
  label,
}) => (
  <Link href={href} aria-label={label} className="flex h-11 w-11 items-center justify-center">
    <span
      className={[
        BUTTON_FUNCTION.base,
        BUTTON_FUNCTION.border.on,
        BUTTON_FUNCTION.status.default,
        BUTTON_FUNCTION.status.hover,
      ].join(" ")}
    >
      <Icon
        set="Arrows"
        name={direction}
        className="h-6 w-6 min-h-6 min-w-6 shrink-0 text-fg-muted"
        style={{ minWidth: 24, minHeight: 24 }}
        aria-hidden
      />
    </span>
  </Link>
);

const WorkBreadcrumb: FC<WorkBreadcrumbProps> = ({
  title,
  index,
  total,
  prevHref,
  nextHref,
}) => {
  const showCounter = total > 1;

  return (
    <div className="flex min-h-11 min-w-0 items-center justify-between gap-3">
      <nav aria-label="パンくず" className="flex min-w-0 items-center gap-2">
        <Link
          href="/#works"
          className="relative flex shrink-0 items-center gap-1 text-system-500 after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] transition-colors hover:text-system-white"
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
          <span className={GUIDE_TEXT}>Works</span>
        </Link>
        <span
          className={`hidden ${GUIDE_TEXT} text-border-light md:inline`}
          aria-hidden
        >
          /
        </span>
        <span
          className={`hidden min-w-0 truncate ${GUIDE_TEXT} text-fg-caption md:inline`}
          aria-current="page"
        >
          {title}
        </span>
      </nav>

      {showCounter && (
        <div className="flex shrink-0 items-center gap-2">
          <span className={`${GUIDE_TEXT} tabular-nums text-system-500`}>
            <span className="text-system-white">{pad(index + 1)}</span> / {pad(total)}
          </span>
          <div className="hidden items-center md:flex">
            {prevHref && <ArrowLink href={prevHref} direction="left" label="前のWork" />}
            {nextHref && <ArrowLink href={nextHref} direction="right" label="次のWork" />}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkBreadcrumb;
