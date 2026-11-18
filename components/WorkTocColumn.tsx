"use client";

import type { FC } from "react";
import type { WorkTocItem } from "./WorkToc";

type WorkTocColumnProps = {
  items: WorkTocItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
};

/**
 * 作品詳細 v2 の目次カラム（PC の本文の左に置く、流れの中の sticky 一覧）。
 * セクション見出しだけを並べ、読んでいる位置を左線と文字色で示す。目次のデータ（useWorkToc）は呼び出し側が持ち、ここは表示だけ。
 */
const WorkTocColumn: FC<WorkTocColumnProps> = ({ items, activeIndex, onSelect }) => {
  const sections = items.flatMap((item, i) => (item.level === 1 && item.number ? [{ label: item.label, index: i, number: item.number }] : []));
  if (sections.length <= 1) return null;

  // 読んでいる見出しが h3 のときは、その手前のセクション（level 1）を active にする
  const activeSection = sections.reduce((acc, s) => (s.index <= activeIndex ? s.index : acc), sections[0].index);

  return (
    <nav aria-label="目次" className="sticky top-[calc(var(--work-header-h)+24px)] max-h-[calc(100vh-var(--work-header-h)-48px)] w-[200px] overflow-y-auto">
      <p className="font-guide mb-2 px-3 text-body-03-jp text-fg-muted">Contents</p>
      <ul>
        {sections.map((s) => {
          const active = s.index === activeSection;
          return (
            <li key={s.index}>
              <button
                type="button"
                aria-current={active ? "location" : undefined}
                onClick={() => onSelect(s.index)}
                className={`flex min-h-11 w-full items-start gap-3 border-l-2 px-3 py-3 text-left text-[13px] leading-5 ${
                  active ? "border-primary text-fg" : "border-border text-fg-muted hover:text-fg"
                }`}
              >
                <span className={`font-guide shrink-0 ${active ? "text-main-050" : ""}`}>{s.number}</span>
                <span className="line-clamp-2 min-w-0">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default WorkTocColumn;
