"use client";

import { type FC, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

export type WorkTocItem = {
  label: string;
  /** 1 = セクション見出し(h2) / 2 = 本文中の小見出し(h3) */
  level: 1 | 2;
};

/** CSS 変数 --work-header-h を px に解決する。取れなければ 56 */
const readHeaderHeight = (): number => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--work-header-h").trim();
  const value = parseFloat(raw);
  if (Number.isNaN(value)) return 56;
  if (raw.endsWith("rem")) return value * parseFloat(getComputedStyle(document.documentElement).fontSize);
  return value;
};

/**
 * 本文コンテナ内の h2 / h3 から目次を作り、スクロール位置に応じて「読んでいる見出し」を返す。
 * key が変わる（作品が切り替わる）たびに見出しを取り直す。
 */
export const useWorkToc = (containerRef: RefObject<HTMLElement | null>, key: unknown) => {
  const [items, setItems] = useState<WorkTocItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const headingsRef = useRef<HTMLElement[]>([]);
  /** 目次から選んだ直後は、スクロール中も選んだ見出しを active に固定する（利用者の操作で解除） */
  const pinnedRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const found: HTMLElement[] = [];
    const next: WorkTocItem[] = [];
    container?.querySelectorAll<HTMLElement>("h2, h3").forEach((el) => {
      const label = el.textContent?.trim();
      if (!label) return;
      found.push(el);
      next.push({ label, level: el.tagName === "H2" ? 1 : 2 });
    });
    headingsRef.current = found;
    setItems(next);

    const offset = readHeaderHeight() + 24;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (pinnedRef.current !== null) {
        setActiveIndex(pinnedRef.current);
        return;
      }
      let current = 0;
      found.forEach((el, i) => {
        if (el.getBoundingClientRect().top <= offset) current = i;
      });
      // ページ末尾では最後の見出しが基準線に届かないため、末尾まで来たら最後を active にする
      if (found.length > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        current = found.length - 1;
      }
      setActiveIndex(current);
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };
    const unpin = () => {
      pinnedRef.current = null;
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("wheel", unpin, { passive: true });
    window.addEventListener("touchstart", unpin, { passive: true });
    window.addEventListener("keydown", unpin, { passive: true });
    // 選んだ見出しへのスクロールが終わったら固定を外す（スクロールバーのドラッグでも追従に戻すため）
    window.addEventListener("scrollend", unpin, { passive: true });
    // 画像の読み込みなどで高さが変わったときも位置を取り直す
    const observer = container ? new ResizeObserver(schedule) : null;
    observer?.observe(container!);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("wheel", unpin);
      window.removeEventListener("touchstart", unpin);
      window.removeEventListener("keydown", unpin);
      window.removeEventListener("scrollend", unpin);
      observer?.disconnect();
      pinnedRef.current = null;
      if (frame !== 0) cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key の変化だけで取り直す（containerRef は不変）
  }, [key]);

  const scrollTo = useCallback((index: number) => {
    pinnedRef.current = index;
    setActiveIndex(index);
    headingsRef.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return { items, activeIndex, scrollTo };
};

type WorkTocProps = {
  items: WorkTocItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
};

/**
 * 作品詳細の目次（シークエリア）。閉じているときは見出しごとの短い横線の縦並び、
 * 開くと見出し名の一覧パネルになる。位置は決めない（呼び出し側が包む）。
 * マウスはホバーで開閉するポップオーバー、キーボードは線の列のボタンで開閉するポップオーバー、
 * タッチ・ペンは線の列をタップすると左からのドロワー（タップしやすい 44px 行）で開く。見出しが 1 つ以下なら何も出さない。
 */
const WorkToc: FC<WorkTocProps> = ({ items, activeIndex, onSelect }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pointerTypeRef = useRef("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  /** スクロールを止める前の body の overflow。null = 止めていない */
  const prevOverflowRef = useRef<string | null>(null);

  const unlockScroll = () => {
    if (prevOverflowRef.current === null) return;
    document.body.style.overflow = prevOverflowRef.current;
    prevOverflowRef.current = null;
  };

  // 閉じると同時にスクロールを戻し、開いたボタンへフォーカスを返す（見出しへの移動はこの後に始める）
  const closeDrawer = () => {
    unlockScroll();
    setDrawerOpen(false);
    setDrawerVisible(false);
    buttonRef.current?.focus({ preventScroll: true });
  };

  // ドロワー: 開いた次のフレームでスライドインし、フォーカスを移す。開いている間は本文のスクロールを止める。
  // Esc で閉じ、Tab はドロワーの中で循環させる（aria-modal のため裏のページへ抜けない）
  useEffect(() => {
    if (!drawerOpen) return;
    const frame = requestAnimationFrame(() => setDrawerVisible(true));
    drawerRef.current?.focus();
    prevOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeDrawer();
        return;
      }
      if (e.key !== "Tab") return;
      const root = drawerRef.current;
      if (!root) return;
      const focusables = Array.from(root.querySelectorAll<HTMLElement>("button"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!root.contains(active) || (e.shiftKey && (active === first || active === root))) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      unlockScroll();
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closeDrawer / unlockScroll は ref と setState だけを触る
  }, [drawerOpen]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      // フォーカスが目次の中にあるときだけ戻す（ライトボックス等、他の Escape 処理のフォーカスを奪わない）
      if (wrapperRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  if (items.length <= 1) return null;

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onBlur={(e) => {
        if (!wrapperRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={open || drawerOpen ? "目次を閉じる" : "目次を開く"}
        aria-expanded={open || drawerOpen}
        onPointerDown={(e) => {
          pointerTypeRef.current = e.pointerType;
        }}
        // マウスはホバーで既に開いているので、クリックで閉じないよう開いたままにする。
        // タッチ・ペンはドロワーを開閉し、キーボードはポップオーバーを開閉する
        onClick={() => {
          const type = pointerTypeRef.current;
          pointerTypeRef.current = "";
          if (type === "touch" || type === "pen") {
            setOpen(false);
            setDrawerVisible(false);
            setDrawerOpen((v) => !v);
          } else if (type === "mouse") {
            setOpen(true);
          } else {
            setOpen((v) => !v);
          }
        }}
        className="flex w-8 flex-col items-start gap-2.5 py-2 pl-2.5 md:w-10 md:pl-3 lg:w-auto lg:gap-3.5 lg:px-2"
      >
        {items.map((item, i) => (
          <span
            key={i}
            aria-hidden
            className={`h-0.5 rounded-full ${item.level === 1 ? "w-3.5 md:w-4 lg:w-5" : "w-2 md:w-2.5 lg:w-3.5"} ${
              i === activeIndex ? "bg-primary" : "bg-fg-placeholder"
            }`}
          />
        ))}
      </button>
      {open && (
        <div className="absolute left-full top-1/2 max-h-[70vh] w-[280px] max-w-[calc(100vw-40px)] -translate-y-1/2 overflow-y-auto rounded-r16 border border-border-light bg-surface p-4 shadow-base">
          <nav aria-label="目次">
            <ul>
              {items.map((item, i) => (
                <li key={i}>
                  <button
                    type="button"
                    aria-current={i === activeIndex ? "location" : undefined}
                    onClick={() => {
                      onSelect(i);
                      setOpen(false);
                      // 押した項目は閉じると消えるため、選択の位置を目次ボタンへ戻す（ページ全体に落ちて枠が消えないように。ドロワーと同じ）
                      buttonRef.current?.focus({ preventScroll: true });
                    }}
                    className={`block w-full truncate py-1.5 text-left text-[14px] leading-[1.5] ${
                      item.level === 2 ? "pl-4" : ""
                    } ${i === activeIndex ? "font-bold text-primary" : "text-fg hover:text-system-white"}`}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
      {drawerOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--color-system-black)_25%,transparent)]" onClick={closeDrawer} aria-hidden />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="目次"
              tabIndex={-1}
              className={`fixed inset-y-0 left-0 z-[51] flex w-[300px] max-w-[85vw] flex-col border-r border-border-light bg-surface shadow-base outline-none transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
                drawerVisible ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
                <span className="text-[14px] font-bold text-fg">目次</span>
                <button
                  type="button"
                  aria-label="目次を閉じる"
                  onClick={closeDrawer}
                  className="-mr-3 flex h-11 w-11 items-center justify-center text-fg"
                >
                  <Icon set="Character" name="close" alt="" aria-hidden tintColor="currentColor" className="h-6 w-6 shrink-0" />
                </button>
              </div>
              <nav aria-label="目次" className="flex-1 overflow-y-auto overscroll-contain py-2 pb-[env(safe-area-inset-bottom)]">
                <ul>
                  {items.map((item, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        aria-current={i === activeIndex ? "location" : undefined}
                        onClick={() => {
                          // 先にスクロールの停止を解いてから移動する（止めたまま始めると iOS で移動が止まりうる）
                          closeDrawer();
                          onSelect(i);
                        }}
                        className={`flex min-h-11 w-full items-center px-6 text-left text-[15px] leading-[1.5] ${
                          item.level === 2 ? "pl-10" : ""
                        } ${i === activeIndex ? "font-bold text-primary" : "text-fg active:bg-action-hover"}`}
                      >
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
};

export default WorkToc;
