import { type FC, type ReactNode, useId } from "react";

type TooltipProps = {
  label: string;
  children: ReactNode;
  /** true（既定）なら Tab キーで focus でき、focus 中も表示する。リンク等、子が既に focus できるときは false */
  focusable?: boolean;
  className?: string;
};

/**
 * 子要素の下に出る小さな説明ラベル（Figma 900:9214 の Tooltip）。
 * hover / キーボード focus で表示。アイコンだけのツール一覧などで名前を補う。
 *
 * 使用例:
 * ```tsx
 * <Tooltip label="Figma"><ServiceLogo name="figma" className="h-4 w-4" /></Tooltip>
 * ```
 */
const Tooltip: FC<TooltipProps> = ({ label, children, focusable = true, className }) => {
  const id = useId();
  return (
    <span
      className={`group relative inline-flex ${className ?? ""}`}
      tabIndex={focusable ? 0 : undefined}
      aria-describedby={id}
    >
      {children}
      {/* 下 4px・左端そろえ。hover / focus のときだけ表示 */}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden whitespace-nowrap rounded-[4px] border border-border bg-surface px-2 py-[6px] font-en text-[10px] leading-none text-white/80 drop-shadow-[1px_1px_8px_rgba(0,0,0,0.25)] group-hover:block group-focus-visible:block group-focus-within:block"
      >
        {label}
      </span>
    </span>
  );
};

export default Tooltip;
