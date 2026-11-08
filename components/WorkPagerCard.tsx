"use client";

import { type FC, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import Tag from "./Tag";
import ProtectedImage from "./ProtectedImage";
import WorkThumbnail from "./WorkThumbnail";
import { GUIDE_TEXT } from "./WorkBreadcrumb";
import type { WorkThumbnailData } from "@/lib/work-content";
import { HOVER_CARD } from "@/lib/hover-card";

type WorkPagerCardProps = {
  /** 省略時は方向の行（矢印＋Prev / Next）を出さない（作品本文に埋め込む作品カード用） */
  direction?: "prev" | "next";
  /** null / 空のときはカテゴリ行ごと出さない */
  category?: string | null;
  /** カテゴリタグの色相（0〜359）。未指定は既定色 */
  categoryHue?: number | null;
  title: string;
  /** 値があるとき左（next は md 以上で右）にサムネイルを出す */
  thumbnail?: string | null;
  /** 構成サムネイル。あれば thumbnail（1枚画像）より優先し、128px 枠に 16:9 で縦中央に置く */
  composedThumbnail?: WorkThumbnailData | null;
  /** 構成サムネイルのサービス名 */
  serviceName?: string | null;
  href: string;
};

const WorkPagerCard: FC<WorkPagerCardProps> = ({ direction, category, categoryHue, title, thumbnail, composedThumbnail, serviceName, href }) => {
  const isNext = direction === "next";
  // 画像の読み込みに失敗したら画像なしの形に落とす
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const composed = composedThumbnail ?? null;
  const thumbSrc = !composed && thumbnail && failedSrc !== thumbnail ? thumbnail : null;
  const hasThumb = composed !== null || thumbSrc !== null;
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
        <span className={`flex items-center gap-1 ${GUIDE_TEXT} text-fg-muted`}>
          {!isNext && arrow}
          {isNext ? "Next" : "Prev"}
          {isNext && arrow}
        </span>
      )}
      {/* カテゴリは Tag-single チップ（Figma Master 973:2190） */}
      {category && <Tag variant="category" label={category} size="sm" hue={categoryHue} />}
      <span className="line-clamp-2 w-full min-w-0 text-body-02-jp-bold text-fg [overflow-wrap:anywhere]">{title}</span>
    </>
  );

  return (
    <Link
      href={href}
      aria-label={direction ? `${isNext ? "次" : "前"}のWork: ${title}` : `Work: ${title}`}
      className={`flex h-full min-h-[44px] w-full min-w-0 overflow-hidden rounded-r8 border border-border hover:border-border-light ${HOVER_CARD} ${
        hasThumb
          ? `items-stretch ${isNext ? "md:flex-row-reverse" : ""}`
          : `flex-col gap-[6px] px-4 py-[14px] ${align}`
      }`}
    >
      {hasThumb ? (
        <>
          {composed ? (
            // 16:9 の上下の余りは地と同じ色にする（ブランド地は白基調）
            <div className={`relative hidden w-[128px] shrink-0 self-stretch overflow-hidden md:block ${composed.brand ? "bg-system-white" : "bg-thumbnail"}`}>
              <div className="absolute inset-x-0 top-1/2 aspect-video -translate-y-1/2">
                <WorkThumbnail
                  layout={composed.layout}
                  logoUrl={composed.logo_url}
                  desktopUrl={composed.desktop_url}
                  mobileUrls={composed.mobile_urls}
                  captureUrls={composed.capture_urls}
                  brand={composed.brand}
                  serviceName={serviceName}
                />
              </div>
            </div>
          ) : (
            // 画像は枠いっぱいに絶対配置し、カードの高さは文字側の中身で決める（画像の縦横比で伸ばさない）
            <div className="relative hidden w-[128px] shrink-0 self-stretch overflow-hidden md:block">
              <ProtectedImage
                src={thumbSrc!}
                alt=""
                loading="lazy"
                onError={() => setFailedSrc(thumbSrc)}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          )}
          <div className={`flex min-w-0 flex-1 flex-col justify-center gap-[6px] px-4 py-[14px] md:gap-1 md:py-[10px] ${align}`}>{body}</div>
        </>
      ) : (
        body
      )}
    </Link>
  );
};

export default WorkPagerCard;
