"use client";

import { type FC, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import ProtectedImage from "./ProtectedImage";
import { GUIDE_TEXT } from "./WorkBreadcrumb";

type WorkPagerCardProps = {
  /** 省略時は方向の行（矢印＋Prev / Next）を出さない（作品本文に埋め込む作品カード用） */
  direction?: "prev" | "next";
  /** null / 空のときはカテゴリ行ごと出さない */
  category?: string | null;
  title: string;
  /** 値があるとき左（next は md 以上で右）にサムネイルを出す */
  thumbnail?: string | null;
  href: string;
};

const WorkPagerCard: FC<WorkPagerCardProps> = ({ direction, category, title, thumbnail, href }) => {
  const isNext = direction === "next";
  // 画像の読み込みに失敗したら画像なしの形に落とす
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const thumbSrc = thumbnail && failedSrc !== thumbnail ? thumbnail : null;
  const arrow = (
    <Icon
      set="Arrows"
      name={isNext ? "right" : "left"}
      tintColor="currentColor"
      className="h-2 w-2 shrink-0"
      aria-hidden
    />
  );

  const align = isNext ? "items-start text-left md:items-end md:text-right" : "items-start text-left";

  const body = (
    <>
      {direction && (
        <span className={`flex items-center gap-1 ${GUIDE_TEXT} text-system-500`}>
          {!isNext && arrow}
          {isNext ? "Next" : "Prev"}
          {isNext && arrow}
        </span>
      )}
      {category && (
        <span className="w-full min-w-0 truncate text-[10px] leading-[12px] tracking-[0.3px] text-main-100">{category}</span>
      )}
      <span className="line-clamp-2 w-full min-w-0 text-body-02-jp-bold text-system-white [overflow-wrap:anywhere]">{title}</span>
    </>
  );

  return (
    <Link
      href={href}
      aria-label={direction ? `${isNext ? "次" : "前"}のWork: ${title}` : `Work: ${title}`}
      className={`flex h-full min-h-[44px] w-full min-w-0 overflow-hidden rounded-r8 border border-border bg-surface-light transition-colors hover:border-system-500 ${
        thumbSrc
          ? `items-stretch ${isNext ? "md:flex-row-reverse" : ""}`
          : `flex-col gap-[6px] px-4 py-[14px] ${align}`
      }`}
    >
      {thumbSrc ? (
        <>
          <ProtectedImage
            src={thumbSrc}
            alt=""
            loading="lazy"
            onError={() => setFailedSrc(thumbSrc)}
            className="hidden w-[128px] shrink-0 self-stretch object-cover md:block"
          />
          <div className={`flex min-w-0 flex-1 flex-col justify-center gap-[6px] px-4 py-[14px] md:gap-1 md:py-[10px] ${align}`}>{body}</div>
        </>
      ) : (
        body
      )}
    </Link>
  );
};

export default WorkPagerCard;
