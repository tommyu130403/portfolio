"use client";

import {
  type FC,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { SHEET_CLOSE_DRAG, SHEET_MEDIA_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { ButtonFunction } from "./ButtonFunction";
import { MODAL_CLOSE_ICON } from "@/lib/figma-button-variants";
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
  /** ダイアログの名前になる見出しの id（読み上げで「何のダイアログか」を伝える）。省略可 */
  ariaLabelledBy?: string;
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
  ariaLabelledBy,
}) => {
  const isSheet = useMediaQuery(SHEET_MEDIA_QUERY);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // シート: 開いた直後に translateY(100%) → 0 へ動かすためのフラグ / ドラッグ量
  const [entered, setEntered] = useState(false);
  const [dragY, setDragY] = useState<number | null>(null);
  const dragStartRef = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  // ダイアログ本体 + 閉じるボタンをまとめて包むラッパー（フォーカストラップの境界）
  const trapRef = useRef<HTMLDivElement>(null);
  // 閉じるときはフェードアウトを待ってから onClose を呼ぶ
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const requestClose = useCallback(() => {
    if (closeTimerRef.current !== null) return;
    setClosing(true);
    // 動きを減らす設定ではフェードが即時なので待たない
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    closeTimerRef.current = window.setTimeout(onClose, reduced ? 0 : 200);
  }, [onClose]);
  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // 2フレーム後に表示位置へ（transition を確実に効かせる）
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, []);

  useEffect(() => {
    // 開く前の値を保存し、閉じるときに復元する（モーダルが重なった場合でも
    // 下のモーダルが開いている間はロックが外れないように）
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
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

  // 開いたまま幅が 727px をまたぐと木が入れ替わりフォーカスが body に落ちるので、ダイアログへ戻す
  const prevIsSheetRef = useRef(isSheet);
  useEffect(() => {
    if (prevIsSheetRef.current === isSheet) return;
    prevIsSheetRef.current = isSheet;
    if (!trapRef.current?.contains(document.activeElement)) {
      dialogRef.current?.focus({ preventScroll: true });
    }
  }, [isSheet]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) {
        // モーダルが重なっている場合、最前面（DOM 上で最後）のものだけが閉じる
        const dialogs = document.querySelectorAll('[role="dialog"]');
        if (dialogs.length > 0 && dialogs[dialogs.length - 1] !== dialogRef.current) return;
        requestClose();
        return;
      }
      if (e.key === "Tab") {
        const root = trapRef.current;
        if (!root || !root.contains(document.activeElement)) return;
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || active === dialogRef.current) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [requestClose]);

  const onHandleDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = e.clientY;
    setDragY(0);
  };
  const onHandleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragY === null) return;
    setDragY(Math.max(0, e.clientY - dragStartRef.current));
  };
  const onHandleUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragY === null) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const dy = dragY;
    setDragY(null);
    if (dy > SHEET_CLOSE_DRAG) requestClose();
  };

  const prevButton =
    carousel && onPrev ? (
      <ButtonFunction
        direction="left"
        border="on"
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        aria-label="Previous"
      />
    ) : null;
  const nextButton =
    carousel && onNext ? (
      <ButtonFunction
        direction="right"
        border="on"
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        aria-label="Next"
      />
    ) : null;
  const closeButton = (
    <ButtonFunction border="off" onClick={requestClose} aria-label="Close">
      <Icon set="Character" name="close" alt="" aria-hidden tintColor="currentColor" className={`h-6 w-6 shrink-0 ${MODAL_CLOSE_ICON}`} />
    </ButtonFunction>
  );
  const dots =
    carousel && total > 1 ? (
      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={[
              "h-1 w-10 rounded-r2 transition-colors",
              i === currentIndex
                ? "bg-primary"
                : // Figma の非アクティブは 白 2% だが 2% のトークンが無いため 5% のまま（依頼書 §6）
                  "bg-action-hover",
            ].join(" ")}
          />
        ))}
      </div>
    ) : null;

  const scrimStyle = {
    backgroundColor: "color-mix(in srgb, var(--color-system-black) 25%, transparent)",
    backdropFilter: "blur(8px)",
  };
  // 開いてすぐ閉じたときも、出てくる途中の濃さからフェードアウトさせる(アニメーションを外して遷移に引き継ぐ)。
  // フェード中もクリックは受け止める(下のページへ抜けると、開き直したモーダルが古い閉じる予約で消えるため)
  const scrimFade = closing ? "opacity-0" : "animate-[card-fade-in_200ms_ease-out]";

  if (isSheet) {
    const hidden = closing || !entered;
    return (
      <>
        <div
          className={`fixed inset-0 z-50 cursor-pointer transition-opacity duration-200 ease-out ${scrimFade}`}
          style={scrimStyle}
          onClick={requestClose}
        />
        <div
          ref={trapRef}
          className="fixed right-0 bottom-0 left-0 z-50 flex max-h-[86dvh] flex-col rounded-t-r16 border border-b-0 border-border bg-surface shadow-wisper"
          style={{
            transform: hidden ? "translateY(100%)" : `translateY(${dragY ?? 0}px)`,
            transition: dragY !== null || reducedMotion ? "none" : "transform 200ms ease-out",
          }}
          // portal 越しでも React の木では親へ伝わる(モバイルメニューの onClick が閉じる)ので止める
          onClick={(e) => e.stopPropagation()}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={ariaLabelledBy}
            tabIndex={-1}
            style={{ outline: "none" }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {/* 閉じるボタン: シート右上の外（背景の上）。aria-modal の内側に置き（VoiceOver 対策）、dialog は position なしなので位置はシート基準 */}
            <div
              className={`absolute right-2 bottom-[calc(100%+8px)] ${hidden ? "pointer-events-none opacity-0" : "opacity-100"}`}
              style={{ transition: reducedMotion ? "none" : "opacity 200ms ease-out" }}
            >
              {closeButton}
            </div>
            {/* ドラッグ領域（つまみだけ）。閉じるボタンはシートの外（右上）に出す */}
            <div
              className="shrink-0 px-2 pt-2 pb-3"
              style={{ touchAction: "none" }}
              onPointerDown={onHandleDown}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              onPointerCancel={() => setDragY(null)}
            >
              <div className="mx-auto h-1 w-10 rounded-r2 bg-border-light" />
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
              style={carousel ? undefined : { paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              {children}
            </div>
            {carousel && (prevButton || nextButton || dots) && (
              <div
                className="flex shrink-0 items-center justify-between border-t border-border px-4 pt-3"
                style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
              >
                {prevButton ?? <span />}
                {dots}
                {nextButton ?? <span />}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      className={[
        "fixed top-0 right-0 bottom-0 z-50 flex cursor-pointer items-center justify-center p-10 [transition:left_300ms_ease-in-out,opacity_200ms_ease-out]",
        scrimFade,
      ].join(" ")}
      style={{ left: sidebarOffset, ...scrimStyle }}
      onClick={requestClose}
    >
      <div ref={trapRef} className="relative flex w-full flex-col items-center gap-4">
        {/* Prev arrow */}
        {prevButton && <div className="absolute left-[-53px] top-1/2 -translate-y-1/2">{prevButton}</div>}

        {/* Next arrow */}
        {nextButton && <div className="absolute right-[-53px] top-1/2 -translate-y-1/2">{nextButton}</div>}

        {/* Modal container + Close button wrapper (overflow-visible でボタンが切れないように) */}
        <div
          className={
            width === "content"
              ? "relative max-w-[min(var(--container-main),calc(100%_-_10px))]"
              : "relative w-full max-w-[min(var(--container-main),calc(100%_-_10px))]"
          }
        >
          {/* 容器の地色は surface */}
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={ariaLabelledBy}
            tabIndex={-1}
            style={{ outline: "none" }}
            className="after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:content-[''] after:border-border relative flex w-full flex-col min-h-[400px] max-h-[90vh] rounded-r16 bg-surface shadow-wisper"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-1 flex-col overflow-y-auto">
              <div className="my-auto w-full">{children}</div>
            </div>
          </div>
          {/* Close button — Figma の描画位置: right -44px / top 0（node 120:413 の数値 -45/-1 ではなく実際の描画位置に合わせる）・border=off */}
          <div className="absolute top-0 -right-[44px]">{closeButton}</div>
        </div>

        {/* Dot indicators */}
        {dots}
      </div>
    </div>
  );
};

export default Modal;
