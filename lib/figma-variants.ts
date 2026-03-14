/**
 * Figma Library SideMenuBar バリアント定義
 * https://www.figma.com/design/KpNwkdFy1usaO1sBR0dycv/Library?node-id=55-296
 *
 * _Item: Size (default|small), Status (defalut|hover|Active), Width (default|short)
 */

export type ItemStatus = "defalut" | "hover" | "Active";
export type ItemWidth = "default" | "short";
export type ItemSize = "default" | "small";

/** _Item Status に応じたスタイル（CSS） */
export const ITEM_STATUS_CLASSES: Record<ItemStatus, string> = {
  defalut: "text-white/50",
  hover: "hover:bg-[rgba(255,255,255,0.05)] hover:text-[#E0E0E0]",
  Active: "bg-[rgba(255,255,255,0.05)] text-[#E0E0E0]",
};

/** _Item Width に応じたスタイル */
export const ITEM_WIDTH_CLASSES: Record<ItemWidth, string> = {
  default: "w-full",
  short: "w-10",
};

/** _Item 共通ベース */
export const ITEM_BASE =
  "flex cursor-pointer items-center rounded-[8px] shrink-0 transition-all duration-300 overflow-hidden gap-3 px-3 py-[10px]";

/** フォーカス時のアクセシビリティ */
export const ITEM_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#424242] focus-visible:ring-offset-2 focus-visible:ring-offset-[#212121]";

/**
 * _Item の Status を動作から解決
 * - アクティブ（セクション表示中）→ Active
 * - それ以外 → defalut（hover は CSS :hover で適用）
 */
export function resolveItemStatus(active: boolean): ItemStatus {
  return active ? "Active" : "defalut";
}

/**
 * Status と Width から _Item のクラス名を生成
 */
export function getItemClasses(status: ItemStatus, width: ItemWidth): string {
  const statusClasses =
    status === "Active"
      ? ITEM_STATUS_CLASSES[status] + " " + ITEM_FOCUS
      : ITEM_STATUS_CLASSES.defalut + " " + ITEM_STATUS_CLASSES.hover + " " + ITEM_FOCUS;
  return [ITEM_BASE, ITEM_WIDTH_CLASSES[width], statusClasses].join(" ");
}
