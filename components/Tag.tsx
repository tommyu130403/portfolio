import type { FC, ReactNode } from "react";

type TagProps = {
  label: string;
  className?: string;
  /**
   * default: 従来の main 系（プロジェクトカード等）
   * small:   Figma Tag/Small（bg black/25・12px white）
   * content:  作品の制作内容タグ（Figma Master 494:1363 のカード・作品詳細）。背景なし・border-main 1px・10px main-050・折り返さない
   * category: Figma Library Tag-single。カードのカテゴリ表示
   * tool:    Figma Slot-Tool（border付き・グレー文字・16pxアイコン前置。スキル展開パネル用）
   */
  variant?: "default" | "small" | "tool" | "content" | "category";
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** tool のみ: 背景を bg-surface で塗る（Figma 900:9214 の役割・関係者タグ。未指定は背景なし） */
  filled?: boolean;
  /** tool のみ: 末尾に人数バッジ（16x16・bg-surface-light）を付ける。指定時は pl10 pr8・gap6 になる */
  count?: number;
};

/** content / tool 共通: 内側に枠線を描く疑似要素（枠の色は呼び出し側でリテラルのまま足す。Tailwind が拾えるように） */
const INNER_RING = "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:content-['']";

const Tag: FC<TagProps> = ({ label, className, variant = "default", prefix, suffix, filled, count }) => {
  if (variant === "category") {
    return (
      <div className={`flex max-w-full items-center justify-center rounded-r8 bg-main-600 p-2 ${className ?? ""}`}>
        {/* Figma は text-box-trim で行の上下余白を字の高さ（cap）まで削る。対応ブラウザではチップが 23px、
            未対応では leading-none の 26px に収まる（leading 1.6 のままだと 32px に太る） */}
        <p
          className="min-w-0 truncate text-[10px] leading-none tracking-[0.3px] text-primary [text-box:trim-both_cap_alphabetic]"
          title={label}
        >
          {label}
        </p>
      </div>
    );
  }

  if (variant === "content") {
    return (
      <div
        className={`relative flex max-w-full shrink-0 items-center rounded-full px-[10px] py-[6px] ${INNER_RING} after:border-border-main ${className ?? ""}`}
      >
        {/* 行より長い名前は省略し、全文を title で補う（filled の tool と同じ）。
            truncate の overflow:hidden が leading-none だと g / y の下端を切るため、
            行を 14px に広げて -my-[2px] で相殺し、タグの高さ 22px（Figma）を保つ */}
        <p className="-my-[2px] min-w-0 truncate font-en text-[10px] leading-[14px] text-main-050" title={label}>{label}</p>
      </div>
    );
  }

  if (variant === "tool") {
    const hasCount = count !== undefined;
    const spacing = hasCount ? "gap-[6px] pl-[10px] pr-2" : "gap-[4px] px-[10px]";
    return (
      <div
        className={`relative flex items-center rounded-full py-[6px] shrink-0 ${spacing} ${filled ? "max-w-full bg-surface" : ""} ${INNER_RING} after:border-border ${className ?? ""}`}
      >
        {prefix}
        {/* filled（作品詳細の役割・関係者）だけ、容器より長いラベルを省略して全文を title で補う
            （375px 未満で人数バッジが切れないように）。それ以外は従来どおり折り返さず全文を出す */}
        {filled ? (
          <p className="min-w-0 truncate font-en text-[10px] leading-none text-fg-muted" title={label}>{label}</p>
        ) : (
          <p className="font-en text-[10px] leading-none text-fg-muted whitespace-nowrap">{label}</p>
        )}
        {hasCount && (
          <span className="flex size-4 shrink-0 items-center justify-center rounded-[8px] bg-surface-light p-0.5 font-en text-[10px] font-bold leading-none text-system-700">
            {count}
          </span>
        )}
        {suffix}
      </div>
    );
  }

  const isSmall = variant === "small";
  return (
    <div
      className={
        isSmall
          ? `bg-[rgba(0,0,0,0.25)] flex gap-2 items-center px-3 py-1 rounded-full shrink-0 ${className ?? ""}`
          : `flex items-center justify-center rounded-full bg-main-700 px-3 py-[3px] ${className ?? ""}`
      }
    >
      {prefix}
      <p
        className={
          isSmall
            ? "font-en text-[11px] leading-none text-system-white whitespace-nowrap"
            : "font-en text-[12px] leading-4 text-main-200"
        }
      >
        {label}
      </p>
      {suffix}
    </div>
  );
};

export default Tag;
