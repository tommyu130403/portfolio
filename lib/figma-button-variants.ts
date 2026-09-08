/**
 * Figma Library Button バリアント定義
 * https://www.figma.com/design/KpNwkdFy1usaO1sBR0dycv/Library?node-id=15-276
 * Button/Function: https://www.figma.com/design/KpNwkdFy1usaO1sBR0dycv/Library?node-id=120-395
 *
 * Button/Action: Status (default, hover), Type (primary, secondary, ghost)
 * Button/Function: Status (default, hover), Border (on, off)
 *
 * Button/Action の実ノード: 15:297（Library）/ Button/Function: 120:395（Library）
 * Figma の hover 背景は rgba(255,255,255,0.02) だが、対応するトークンが無いため Action/hover（白5%）を使っている。2% のトークン化は Figma 側に依頼中。
 */

export type ButtonActionType = "primary" | "secondary" | "ghost";
export type ButtonActionStatus = "default" | "hover";

/**
 * Button/Action のスタイルクラス
 *
 * primary の `h-10 max-w-[200px]` は Figma の実値（node 15:293）。
 * **ラベルが 200px に収まらないと折り返して h-10 の外へはみ出す**（クリップはされない）。
 * 長いラベルを入れる場合は max-w を外すか、Figma 側で幅の方針を決めること。
 */
export const BUTTON_ACTION = {
  base: "inline-flex w-fit cursor-pointer items-center justify-center rounded-full px-6 py-2 text-[16px] font-bold leading-6 transition-colors",
  type: {
    primary: {
      default: "bg-primary text-main-600 h-10 max-w-[200px]",
      hover: "hover:bg-main-400 hover:text-main-600",
    },
    secondary: {
      default: "border border-primary text-primary bg-transparent",
      hover: "hover:bg-action-hover hover:border-primary hover:text-primary",
    },
    ghost: {
      default: "bg-transparent text-primary",
      hover: "hover:bg-action-hover hover:text-primary",
    },
  },
} as const;

export type ButtonFunctionBorder = "on" | "off";
export type ButtonFunctionStatus = "default" | "hover";

/**
 * Button/Function のスタイルクラス（Figma node 120:395 準拠）
 *
 * Figma は 36px の箱に padding 6px + アイコンが残り 24px を埋める指定だが、
 * 実装はアイコンが 24px 固定なので padding を足すと border 2px と合わせて 38px になる。
 * 見た目を Figma と揃えるため padding は付けず、36px の箱の中央にアイコンを置いている。
 */
export const BUTTON_FUNCTION = {
  base: "flex h-[36px] min-w-[36px] shrink-0 cursor-pointer items-center justify-center rounded-[8px] transition-colors",
  border: {
    on: "border border-border bg-surface hover:bg-action-hover hover:border-border-light",
    off: "border border-transparent bg-transparent hover:bg-action-hover",
  },
  status: {
    default: "",
    hover: "",
  },
} as const;
