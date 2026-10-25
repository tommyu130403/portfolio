"use client";

import { type FC, useEffect } from "react";
import { createPortal } from "react-dom";
import ProtectedImage from "./ProtectedImage";

/* ------------------------------------------------------------------ *
 * スマホモック（iPhone 風 CSS フレーム）。幅は className で上書きできる（既定 126px）
 * ------------------------------------------------------------------ */

export const PhoneMock: FC<{ src: string; onClick?: () => void; className?: string }> = ({
  src,
  onClick,
  className = "w-[126px]",
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="スクリーンショットを拡大表示"
    className={`${className} shrink-0 aspect-[126/257] cursor-zoom-in overflow-hidden rounded-[24px] border-[3px] border-[#0a0a0a] bg-[#0a0a0a] shadow-xl`}
  >
    <ProtectedImage src={src} alt="" className="h-full w-full object-cover" />
  </button>
);

/* ------------------------------------------------------------------ *
 * ノートPCモック（黒ベゼルの画面＋下の土台。ブラウザバーは任意）。親の幅いっぱいに広がる。
 * 画像は 16:10 に固定し上端から切り取る（縦長の全ページスクショでも枠の形を保つ）
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
    {/* 画面（幅 88%・ベゼル 上左右 8px / 下 10px） */}
    <div className="mx-auto w-[88%] overflow-hidden rounded-t-[12px] bg-[#0a0a0a] px-2 pb-2.5 pt-2 shadow-xl">
      <div className="overflow-hidden rounded-[4px]">
        {browser && (
          <div className="flex h-7 items-center gap-2 bg-[#0a0a0a] px-2.5">
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
              <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
              <span className="h-2 w-2 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex h-[18px] min-w-0 flex-1 items-center justify-center rounded-[5px] bg-[#1f1f1f] px-2 text-[11px] text-[#9a9a9a]">
              <span className="truncate">{url}</span>
            </div>
          </div>
        )}
        <ProtectedImage src={src} alt="" className="block aspect-[16/10] w-full object-cover object-top" />
      </div>
    </div>
    {/* 土台（上中央に小さな切り欠き） */}
    <div className="relative h-3 w-full rounded-b-[10px] bg-[#2b2b2b]">
      <div className="absolute left-1/2 top-0 h-[5px] w-[60px] -translate-x-1/2 rounded-b-[4px] bg-[#1a1a1a]" />
    </div>
  </button>
);

/* ------------------------------------------------------------------ *
 * スクリーンショット拡大ライトボックス（全画面ボタンで開く）。
 * body 直下へ portal で出す（admin プレビューの zoom 縮小枠の中で開いても全画面を覆うように）。
 * frame=laptop は横長のスクショなので、スマホ用の大きな角丸・黒枠を付けない
 * ------------------------------------------------------------------ */

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
      style={{ backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      {shots.map((src, i) => (
        <ProtectedImage
          key={i}
          src={src}
          alt=""
          className={`max-h-[90vh] w-auto max-w-full object-contain ${
            frame === "laptop" ? "rounded-[8px]" : "rounded-[24px] border-[3px] border-[#0a0a0a]"
          }`}
        />
      ))}
    </div>,
    document.body,
  );
};
