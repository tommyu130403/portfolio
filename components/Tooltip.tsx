"use client";

import { type FC, type ReactNode, useId, useRef, useState } from "react";

type TooltipProps = {
  label: string;
  children: ReactNode;
  /** true（既定）なら Tab キーで focus でき、focus 中も表示する。リンク等、子が既に focus できるときは false */
  focusable?: boolean;
  className?: string;
};

/**
 * 子要素の下に出る小さな説明ラベル（Figma Library Tooltip 60:558: 余白 10/12・角丸 4・Background/Default + Border/Default・影 shadow）。
 * hover / キーボード focus で表示。アイコンだけのツール一覧などで名前を補う。
 *
 * 使用例:
 * ```tsx
 * <Tooltip label="Figma"><ServiceLogo name="figma" className="h-4 w-4" /></Tooltip>
 * ```
 */
const Tooltip: FC<TooltipProps> = ({ label, children, focusable = true, className }) => {
  const id = useId();
  const tipRef = useRef<HTMLSpanElement>(null);
  // 画面右端からはみ出すときだけ右端そろえに切り替える（表示された直後に実測する）
  const [alignRight, setAlignRight] = useState(false);
  const measure = () =>
    requestAnimationFrame(() => {
      const tip = tipRef.current;
      if (!tip) return;
      const wrapLeft = tip.parentElement?.getBoundingClientRect().left ?? 0;
      setAlignRight(wrapLeft + tip.offsetWidth > document.documentElement.clientWidth - 8);
    });

  return (
    // 名前付き group: 祖先に別の group があっても、この要素の hover / focus だけに反応させる
    <span
      className={`group/tooltip relative inline-flex ${className ?? ""}`}
      tabIndex={focusable ? 0 : undefined}
      aria-describedby={id}
      onMouseEnter={measure}
      onFocus={measure}
    >
      {children}
      {/* 下 4px・左端そろえ（右端ではみ出すときは右端そろえ）。hover / キーボード focus のときだけ表示。
          focus-within は使わない（マウスでクリックすると focus が残り、離しても出たままになるため） */}
      <span
        ref={tipRef}
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute top-full z-10 mt-1 hidden whitespace-nowrap rounded-[4px] border border-border bg-surface px-3 py-[10px] font-en text-[10px] leading-none text-white/80 shadow-base group-hover/tooltip:block group-focus-visible/tooltip:block ${alignRight ? "right-0" : "left-0"}`}
      >
        {label}
      </span>
    </span>
  );
};

export default Tooltip;
