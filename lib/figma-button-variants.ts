/**
 * Figma Library Button バリアント定義
 * https://www.figma.com/design/KpNwkdFy1usaO1sBR0dycv/Library?node-id=15-276
 * Button/Function: https://www.figma.com/design/KpNwkdFy1usaO1sBR0dycv/Library?node-id=120-395
 *
 * Button/Action: Status (default, hover), Type (primary, secondary, ghost)
 * Button/Function: Status (default, hover), Border (on, off)
 */

export type ButtonActionType = "primary" | "secondary" | "ghost";
export type ButtonActionStatus = "default" | "hover";

/** Button/Action のスタイルクラス */
export const BUTTON_ACTION = {
  base: "inline-flex w-fit cursor-pointer items-center justify-center rounded-full px-6 py-2 text-[16px] font-bold leading-6 transition-colors",
  type: {
    primary: {
      default: "bg-[#48F4BE] text-[#062D20]",
      hover: "hover:bg-[#1E765A] hover:text-[#062D20]",
    },
    secondary: {
      default: "border border-[#48F4BE] text-[#48F4BE] bg-transparent",
      hover: "hover:bg-white/5 hover:border-[#48F4BE] hover:text-[#48F4BE]",
    },
    ghost: {
      default: "bg-transparent text-[#48F4BE]",
      hover: "hover:bg-white/5 hover:text-[#48F4BE]",
    },
  },
} as const;

export type ButtonFunctionBorder = "on" | "off";
export type ButtonFunctionStatus = "default" | "hover";

/** Button/Function のスタイルクラス（Figma node 120-395 準拠） */
export const BUTTON_FUNCTION = {
  base: "flex h-[36px] min-w-[36px] shrink-0 cursor-pointer items-center justify-center rounded-[8px] transition-colors",
  border: {
    on: "border border-[#424242] bg-[#212121] hover:bg-[#2c2c2c]",
    off: "border border-transparent bg-transparent hover:bg-white/5",
  },
  status: {
    default: "",
    hover: "",
  },
} as const;
