"use client";

import { type FC, type ReactNode, useEffect } from "react";
import { ButtonFunction } from "./ButtonFunction";

type ModalProps = {
  children: ReactNode;
  onClose: () => void;
  /** サイドバー幅（px）。オーバーレイの左オフセットに使用。省略時は 0 */
  sidebarOffset?: number;
  /** カルーセルナビゲーションを表示する場合 true */
  carousel?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  /** 現在のインデックス（ドット表示用） */
  currentIndex?: number;
  /** 総アイテム数（ドット表示用） */
  total?: number;
};

const Modal: FC<ModalProps> = ({
  children,
  onClose,
  sidebarOffset = 0,
  carousel = false,
  onPrev,
  onNext,
  currentIndex = 0,
  total = 1,
}) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fixed top-0 right-0 bottom-0 z-50 flex cursor-pointer items-center justify-center transition-[left] duration-300 ease-in-out"
      style={{
        left: sidebarOffset,
        backgroundColor: "rgba(0,0,0,0.25)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div className="relative flex flex-col items-center gap-4">
        {/* Prev arrow */}
        {carousel && onPrev && (
          <div className="absolute left-[-53px] top-1/2 -translate-y-1/2">
            <ButtonFunction
              direction="left"
              border="on"
              onClick={(e) => {
                e.stopPropagation();
                onPrev();
              }}
              aria-label="Previous"
            />
          </div>
        )}

        {/* Next arrow */}
        {carousel && onNext && (
          <div className="absolute right-[-53px] top-1/2 -translate-y-1/2">
            <ButtonFunction
              direction="right"
              border="on"
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              aria-label="Next"
            />
          </div>
        )}

        {/* Modal container + Close button wrapper (overflow-visible でボタンが切れないように) */}
        <div className="relative w-[728px]">
          <div
            className="relative max-h-[90vh] overflow-y-auto rounded-[14px] border border-[#424242] bg-[#212121] px-10 py-10"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
          {/* Close button（Figma node 120-332: top 0, 右端から16px外側） */}
          <div className="absolute top-0 -right-[52px]">
            <ButtonFunction
              border="off"
              onClick={onClose}
              aria-label="Close"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0"
                aria-hidden
              >
                <path
                  d="M12 4L4 12M4 4L12 12"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </ButtonFunction>
          </div>
        </div>

        {/* Dot indicators */}
        {carousel && total > 1 && (
          <div className="flex items-center gap-2">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className={[
                  "h-1.5 rounded-full transition-all",
                  i === currentIndex
                    ? "w-4 bg-[#b3ffe7]"
                    : "w-1.5 bg-white/20",
                ].join(" ")}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
