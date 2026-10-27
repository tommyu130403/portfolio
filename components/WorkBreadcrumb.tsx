"use client";

import type { FC } from "react";
import Link from "next/link";
import Icon from "./Icon";
import { BUTTON_FUNCTION, BUTTON_FUNCTION_ICON } from "@/lib/figma-button-variants";

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
  // hover は 44px のリンク全体で反応させる（group をリンクに付け、見た目の span は group-hover で変える）
  <Link href={href} aria-label={label} className="group flex h-11 w-11 items-center justify-center">
    <span
      className={[
        BUTTON_FUNCTION.base,
        BUTTON_FUNCTION.borderGroupHover.on,
        BUTTON_FUNCTION.status.default,
        BUTTON_FUNCTION.status.hover,
      ].join(" ")}
    >
      <Icon
        set="Arrows"
        name={direction}
        tintColor="currentColor"
        className={`h-6 w-6 min-h-6 min-w-6 shrink-0 ${BUTTON_FUNCTION_ICON}`}
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
    // 高さは --work-header-h（既定 56px）。パンくずと「件数＋前後矢印」を、それぞれ半透明＋ぼかしの囲みに入れる
    // （Library 414:296、Background/Dark-α25 = System/900 #212121 の 25%。ページ背景 surface は System/925 なので surface ではなく system-900 を参照する）。後ろを通る本文はぼかして透ける。
    // 上部固定は呼び出し側（WorkDetailClient）の sticky ラッパーが持つ
    // 高さは作品詳細ページの --work-header-h（globals.css）。変数の無い場所（スタイルガイド）は既定値 3.5rem（globals.css と同値）
    <div className="flex h-[var(--work-header-h,3.5rem)] min-w-0 items-center justify-between gap-3">
      <nav
        aria-label="パンくず"
        className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-r8 bg-system-900/25 backdrop-blur-[2px] md:py-2"
      >
        {/* 「Works」は枠なしの Button/Function（文字版・Library 458:442 / md 未満は矢印付き 458:449）。
            高さ 36px の見た目に対し、当たり判定だけ縦 44px に広げる */}
        <Link
          href="/#works"
          className={`${BUTTON_FUNCTION.base} ${BUTTON_FUNCTION.border.off} relative px-[6px] text-system-500 hover:text-system-white after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']`}
          aria-label="Works一覧へ戻る"
        >
          <span className="flex size-6 shrink-0 items-center justify-center md:hidden" aria-hidden>
            <Icon
              set="Arrows"
              name="left"
              tintColor="currentColor"
              className="h-3 w-3 shrink-0"
              aria-hidden
            />
          </span>
          <span className="pr-2 font-guide text-[14px] leading-[1.3] tracking-[0.42px] md:pr-0">Works</span>
        </Link>
        <span
          className={`hidden ${GUIDE_TEXT} text-border-light md:inline`}
          aria-hidden
        >
          /
        </span>
        <span
          className="hidden min-w-0 truncate px-2 font-body text-[12px] leading-[1.3] tracking-[0.6px] text-fg md:inline"
          aria-current="page"
        >
          {title}
        </span>
      </nav>

      {showCounter && (
        // 囲みは行の高さ（--work-header-h）いっぱいにし、44px の矢印リンクを中に収める。前後矢印は全幅で出す
        // （Figma は md 未満を件数のみとしているが、幅に余裕があるため 2026-10-18 にユーザー判断で全幅表示）。
        // 矢印リンクは見た目(36px)より左右 4px 大きいので、右の余白は pr-1 で見た目 8px に揃える
        <div className="pointer-events-auto flex shrink-0 items-center gap-2 self-stretch rounded-r8 bg-system-900/25 py-0 pl-2 pr-1 backdrop-blur-[2px]">
          <span className={`${GUIDE_TEXT} tabular-nums text-system-500`}>
            <span className="text-fg">{pad(index + 1)}</span> / {pad(total)}
          </span>
          <div className="flex items-center">
            {prevHref && <ArrowLink href={prevHref} direction="left" label="前のWork" />}
            {nextHref && <ArrowLink href={nextHref} direction="right" label="次のWork" />}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkBreadcrumb;
