"use client";

import { type FC, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ProtectedImage from "./ProtectedImage";

/* ------------------------------------------------------------------ *
 * スマホモック（iPhone 風 CSS フレーム）。幅は className で上書きできる（既定 126px）。
 * 枠の高さは画像の比率に合わせる（固定比率で切り取らない。上下の見切れをなくすユーザー指示 2026-11-02）
 * ------------------------------------------------------------------ */

export const PhoneMock: FC<{ src: string; onClick?: () => void; className?: string; browser?: boolean; url?: string }> = ({
  src,
  onClick,
  className = "w-[126px]",
  browser = false,
  url,
}) => (
  // 角丸とベゼルは幅に比例させる（iPhone 13/14: 本体の角丸 ≒ 幅の 12%・ベゼル ≒ 3%。固定 px だと小さい枠が錠剤型に見える。ユーザー指示 2026-11-02）
  <div className={`@container ${className} shrink-0`}>
    <button
      type="button"
      onClick={onClick}
      aria-label="スクリーンショットを拡大表示"
      className="relative block w-full cursor-zoom-in overflow-hidden rounded-[12cqw] border-[3cqw] border-thumbnail bg-thumbnail shadow-xl"
    >
      <ProtectedImage src={src} variantWidth={480} alt="" className="block h-auto w-full rounded-[9cqw] [aspect-ratio:auto_9/19]" />
      {/* iOS Safari 風の下部バー（任意・ダーク配色で PC のバーと統一）。画像の下端に残る帯（切れた端末イラストや背景だけの部分）を隠す（ユーザー指示 2026-11-02） */}
      {browser && (
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-[2cqw] rounded-b-[9cqw] border-t border-white/10 bg-surface/95 px-[5cqw] pb-[4cqw] pt-[3cqw] backdrop-blur-[2px]"
        >
          <div className="flex h-[11cqw] w-full items-center justify-center rounded-[3cqw] bg-white/10 text-[4.5cqw] leading-none text-white/80">
            <span className="truncate px-[2cqw]">{url ?? "example.com"}</span>
          </div>
          <div className="flex w-full items-center justify-between px-[2cqw] text-[6cqw] leading-none text-white/60">
            <span>‹</span>
            <span className="opacity-40">›</span>
            <span>⇧</span>
            <span>▯</span>
            <span>⧉</span>
          </div>
        </div>
      )}
    </button>
  </div>
);

/* ------------------------------------------------------------------ *
 * ノートPCモック（黒ベゼルの画面＋下の土台。ブラウザバーは任意）。親の幅いっぱいに広がる。
 * 比率は 13 インチ級の実機に寄せる（ユーザー指示 2026-11-02）: 蓋は幅 92%・ベゼルは幅の約 3%（下だけ 4%）・画面 16:10、
 * 土台は蓋より広い全幅で高さは幅の 2.5%。画面は object-cover で上端から切り取る（16:10 に収まらない分は下が切れる。
 * contain だと画面に黒い帯が出て「分厚い板」に見えるため）
 * ------------------------------------------------------------------ */

export const LaptopMock: FC<{ src: string; browser?: boolean; url?: string; onClick?: () => void }> = ({
  src,
  browser = false,
  url,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="スクリーンショットを拡大表示"
    className="block w-full cursor-zoom-in"
  >
    {/* 蓋（幅 92%・ベゼルは幅比 3%、下 4%） */}
    <div className="mx-auto w-[92%] overflow-hidden rounded-t-[10px] bg-thumbnail px-[3%] pb-[4%] pt-[3%] shadow-xl">
      <div className="@container overflow-hidden rounded-[3px]">
        {/* ブラウザバーは実寸比率（1440px 幅の Safari / Chrome 相当）: 高さ = 画面幅の 3.5%・信号ドット 0.8%・URL 欄は幅の 32% を中央に。cqw で画面幅に比例（ユーザー指示 2026-11-02） */}
        {browser && (
          <div className="relative flex h-[3.5cqw] items-center justify-center bg-surface">
            <div className="absolute left-[1cqw] flex items-center gap-[0.6cqw]">
              <span className="h-[0.8cqw] w-[0.8cqw] rounded-full bg-[#ff5f57]" />
              <span className="h-[0.8cqw] w-[0.8cqw] rounded-full bg-[#febc2e]" />
              <span className="h-[0.8cqw] w-[0.8cqw] rounded-full bg-[#28c840]" />
            </div>
            <div className="flex h-[2.1cqw] w-[32cqw] items-center justify-center rounded-[0.5cqw] bg-white/10 px-[1cqw] text-[1.6cqw] leading-none text-white/80">
              <span className="truncate">{url}</span>
            </div>
          </div>
        )}
        <ProtectedImage src={src} variantWidth={960} alt="" className="block aspect-[16/10] w-full bg-thumbnail object-cover object-left-top" />
      </div>
    </div>
    {/* 土台（全幅・高さは幅の 2.5%・下角だけ丸い。上中央に小さな切り欠き） */}
    <div className="relative aspect-[40/1] w-full rounded-b-[8px] bg-border">
      <div className="absolute left-1/2 top-0 h-[40%] w-[12%] -translate-x-1/2 rounded-b-[3px] bg-surface-light" />
    </div>
  </button>
);

/* ------------------------------------------------------------------ *
 * スクリーンショット拡大ライトボックス（全画面ボタンで開く）。
 * body 直下へ portal で出す（admin プレビューの zoom 縮小枠の中で開いても全画面を覆うように）。
 * frame=laptop は横長のスクショなので、スマホ用の大きな角丸・黒枠を付けない
 * ------------------------------------------------------------------ */

/**
 * ライトボックスの 1 枚。枠は画像ごとに決める: URL 末尾 `#plain` は枠なし、読み込んだ画像が横長なら laptop（角丸のみ）、
 * 縦長なら phone（大きな角丸 + 黒枠）。読み込み前は呼び出し側の frame に従う（ヒーローは PC と SP が混在するため）
 */
const LightboxShot: FC<{ src: string; frame: "phone" | "laptop" }> = ({ src, frame }) => {
  const hash = src.indexOf("#");
  const plain = hash >= 0 && src.slice(hash + 1) === "plain";
  const cleanSrc = hash >= 0 ? src.slice(0, hash) : src;
  const [landscape, setLandscape] = useState<boolean | null>(null);
  const kind = plain ? "plain" : landscape === null ? frame : landscape ? "laptop" : "phone";
  return (
    <ProtectedImage
      src={cleanSrc}
      alt=""
      onLoad={(e) => setLandscape(e.currentTarget.naturalWidth > e.currentTarget.naturalHeight)}
      className={`max-h-[90vh] w-auto max-w-full object-contain ${
        kind === "plain" ? "" : kind === "laptop" ? "rounded-[8px]" : "rounded-[24px] border-[3px] border-thumbnail"
      }`}
    />
  );
};

export const ScreenshotLightbox: FC<{ shots: string[]; onClose: () => void; frame?: "phone" | "laptop" }> = ({
  shots,
  onClose,
  frame = "phone",
}) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex cursor-pointer items-center justify-center gap-6 overflow-auto p-10"
      style={{ backgroundColor: "color-mix(in srgb, var(--color-system-black) 80%, transparent)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      {shots.map((src, i) => (
        <LightboxShot key={i} src={src} frame={frame} />
      ))}
    </div>,
    document.body,
  );
};
