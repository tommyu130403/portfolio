import type { FC, ReactNode } from "react";
import { normalizeWorkCategoryHue, workCategoryTagStyle } from "@/lib/work-category-color";

type TagProps = {
  label: string;
  className?: string;
  /**
   * default: 従来の main 系（プロジェクトカード等）
   * small:   Figma Tag/Small（bg black/25・12px white）
   * content:  作品の制作内容タグ（Figma Master 494:1045 / 989:4803 の Tag-multi Color=default）。地 surface・border 1px・10px fg-muted・折り返さない
   * category: Figma Library Tag-single（581:444）。作品カテゴリの表示
   * tool:    Figma Slot-Tool（border付き・グレー文字・16pxアイコン前置。スキル展開パネル用）
   */
  variant?: "default" | "small" | "tool" | "content" | "category";
  /** category のみ: 文字の大きさだけを変える（書体・字間は共通）。md = 13px・高さ 29（作品詳細上部・Library Tag-single 581:444）/
   * sm = 10px・高さ 26（前後ナビ・Master 973:2190）/ card = 10px・高さ 26（作品カード・Master 494:1045）。既定 md */
  size?: "sm" | "md" | "card";
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** tool のみ: 背景を bg-surface で塗る（Figma 900:9214 の役割・関係者タグ。未指定は背景なし） */
  filled?: boolean;
  /** tool のみ: 末尾に人数バッジ（16x16・bg-surface-light）を付ける。指定時は pl10 pr8・gap6 になる */
  count?: number;
  /** category のみ: カテゴリ色の色相（0〜359）。未指定は Main/600 地に Main/base */
  hue?: number | null;
};

/** content / tool 共通: 内側に枠線を描く疑似要素（枠の色は呼び出し側でリテラルのまま足す。Tailwind が拾えるように） */
const INNER_RING = "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:content-['']";

const Tag: FC<TagProps> = ({ label, className, variant = "default", size = "md", prefix, suffix, filled, count, hue }) => {
  if (variant === "category") {
    /* Figma Tag-single（Library 581:444・2026-11-08 照合）: 全サイズ共通で Avenir Heavy・字間 5%・行の上下は削らない。
       違うのは文字の大きさだけ: md 13px（高さ 29）/ sm・card 10px（高さ 26） */
    const fs = `font-en font-extrabold tracking-[0.05em] ${size === "md" ? "text-[13px]" : "text-[10px]"}`;
    // 範囲外・NaN は「色なし」に倒す（クラスと style の判定を同じ値から決める）
    const safeHue = normalizeWorkCategoryHue(hue);
    const colored = safeHue !== null;
    return (
      <div
        className={`flex max-w-full items-center justify-center rounded-r4 ${colored ? "" : "bg-main-600 "}p-2 ${className ?? ""}`}
        style={workCategoryTagStyle(safeHue)}
      >
        {/* 角丸 4・余白 8・Main/600 地に Main/base（色相ありは lib/work-category-color.ts のインディゴ用の色。Figma の色見本より新しい） */}
        <p
          className={`min-w-0 truncate ${fs} leading-none ${colored ? "" : "text-primary"}`}
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
        className={`relative flex max-w-full shrink-0 items-center rounded-full bg-surface px-[10px] py-[6px] ${INNER_RING} after:border-border ${className ?? ""}`}
      >
        {/* Figma Tag-multi（Master 494:1045・2026-11-03）は Background/Default の地を持つ。
            行より長い名前は省略し、全文を title で補う（filled の tool と同じ）。
            truncate の overflow:hidden が leading-none だと g / y の下端を切るため、
            行を 14px に広げて -my-[2px] で相殺し、タグの高さ 22px（Figma）を保つ */}
        <p className="-my-[2px] min-w-0 truncate font-en text-[10px] leading-[14px] text-fg-muted" title={label}>{label}</p>
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
          <span className="flex size-4 shrink-0 items-center justify-center rounded-[8px] bg-surface-light p-0.5 font-en text-[10px] font-bold leading-none text-fg-muted">
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
          ? `bg-system-black/25 flex gap-2 items-center px-3 py-1 rounded-full shrink-0 ${className ?? ""}`
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
