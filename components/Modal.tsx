"use client";

import { type FC, type ReactNode, useEffect, useRef } from "react";
import { ButtonFunction } from "./ButtonFunction";
import Icon from "./Icon";

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
  /** full = 常に最大 800px いっぱい / content = 中身の幅に合わせる（上限 800px）。既定 full */
  width?: "full" | "content";
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
  width = "full",
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed top-0 right-0 bottom-0 z-50 flex cursor-pointer items-center justify-center p-10 transition-[left] duration-300 ease-in-out"
      style={{
        left: sidebarOffset,
        backgroundColor: "rgba(0,0,0,0.25)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div className="relative flex w-full flex-col items-center gap-4">
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
        <div
          className={
            width === "content"
              ? "relative max-w-[min(var(--container-main),calc(100%_-_10px))]"
              : "relative w-full max-w-[min(var(--container-main),calc(100%_-_10px))]"
          }
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            style={{ outline: "none" }}
            className="after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:content-[''] after:border-border relative flex w-full flex-col min-h-[400px] max-h-[90vh] rounded-r16 bg-surface shadow-[0_1px_1.5px_0_rgba(0,0,0,0.1),0_1px_1px_0_rgba(0,0,0,0.1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-1 flex-col overflow-y-auto">
              <div className="my-auto w-full">{children}</div>
            </div>
          </div>
          {/* Close button（Figma node 120:413: right -45px / top -1px・border=off） */}
          <div className="absolute -top-px -right-[45px]">
            <ButtonFunction
              border="off"
              onClick={onClose}
              aria-label="Close"
            >
              <Icon set="Character" name="close" alt="" aria-hidden className="h-6 w-6 shrink-0" />
            </ButtonFunction>
          </div>
        </div>

        {/* Dot indicators */}
        {carousel && total > 1 && (
          <div className="flex items-center gap-1">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className={[
                  "h-1 w-10 rounded-r2 transition-colors",
                  i === currentIndex
                    ? "bg-primary"
                    : // Figma の非アクティブは rgba(255,255,255,0.02) だが 2% のトークンが無いため 5% のまま（依頼書 §6）
                      "bg-white/5",
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
