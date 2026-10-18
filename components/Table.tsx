import type { FC, ReactNode } from "react";

/** 外枠（Figma Library 188:355 共通: 1px border・角丸 8px・はみ出しを切る） */
const FRAME = "overflow-hidden rounded-[8px] border border-border";
const ROW_DIVIDER = "[&:not(:last-child)]:border-b [&:not(:last-child)]:border-border";
/** ラベル: 12px / 行間 18px / 字間 0.03em（既存 @utility に一致するものが無いため直書き） */
const LABEL_TYPO = "text-[12px] leading-[18px] tracking-[0.03em]";

type TableKeyValueProps = {
  rows: { label: ReactNode; value: ReactNode }[];
};

/**
 * 項目-値テーブル（Figma 188:355）。
 * コンテナ幅 480px 以上は横（ラベル列は内容幅・高さ 40px）、480px 未満は縦積み（CellStack）。
 * ラベル列の幅は行をまたいで揃える（subgrid）。
 */
export const TableKeyValue: FC<TableKeyValueProps> = ({ rows }) => (
  <div className="@container w-full">
    <div className={`grid grid-cols-1 @min-[480px]:grid-cols-[auto_minmax(0,1fr)] ${FRAME}`}>
      {rows.map((row, i) => (
        <div
          key={i}
          className={`col-span-full grid grid-cols-subgrid gap-y-3 px-4 py-3 @min-[480px]:gap-y-0 @min-[480px]:p-0 ${ROW_DIVIDER}`}
        >
          <div className={`min-w-0 text-fg-muted ${LABEL_TYPO} @min-[480px]:flex @min-[480px]:min-h-10 @min-[480px]:items-center @min-[480px]:px-4`}>
            {row.label}
          </div>
          <div className="min-w-0 break-words text-fg text-body-03-jp @min-[480px]:flex @min-[480px]:min-h-10 @min-[480px]:items-center @min-[480px]:border-l @min-[480px]:border-border @min-[480px]:px-4">
            {row.value}
          </div>
        </div>
      ))}
    </div>
  </div>
);

type TableGridProps = {
  header: ReactNode[];
  rows: ReactNode[][];
};

/** グリッドテーブル（Figma 188:355 Table/Grid）。1行目が見出し、列は等幅、幅は親いっぱい */
export const TableGrid: FC<TableGridProps> = ({ header, rows }) => {
  const cell = "min-h-10 min-w-0 flex-1 break-words px-4 py-2 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-border";
  return (
    <div className={`w-full ${FRAME}`}>
      <div className={`flex ${ROW_DIVIDER}`}>
        {header.map((h, i) => (
          <div key={i} className={`${cell} ${LABEL_TYPO} font-bold text-fg-muted`}>
            {h}
          </div>
        ))}
      </div>
      {rows.map((r, ri) => (
        <div key={ri} className={`flex ${ROW_DIVIDER}`}>
          {header.map((_, ci) => (
            <div key={ci} className={`${cell} text-fg text-body-03-jp`}>
              {r[ci] ?? null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
