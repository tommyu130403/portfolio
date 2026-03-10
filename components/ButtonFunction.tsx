"use client";

import type { FC, ReactNode } from "react";
import Icon from "./Icon";
import { BUTTON_FUNCTION, type ButtonFunctionBorder } from "@/lib/figma-button-variants";

type ButtonFunctionProps = {
  /** アイコン向き（children 指定時は不要） */
  direction?: "left" | "right";
  /** カスタムアイコン（指定時は direction を無視） */
  children?: ReactNode;
  border?: ButtonFunctionBorder;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  "aria-label"?: string;
};

export const ButtonFunction: FC<ButtonFunctionProps> = ({
  direction,
  children,
  border = "on",
  onClick,
  "aria-label": ariaLabel,
}) => {
  const className = [
    BUTTON_FUNCTION.base,
    BUTTON_FUNCTION.border[border],
    BUTTON_FUNCTION.status.default,
    BUTTON_FUNCTION.status.hover,
  ].join(" ");

  const iconContent =
    children ??
    (direction && (
      <Icon
        set="Arrows"
        name={direction}
        className="h-6 w-6 min-h-6 min-w-6 shrink-0 text-[#9e9e9e]"
        style={{ minWidth: 24, minHeight: 24 }}
        aria-hidden
      />
    ));

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      aria-label={ariaLabel}
    >
      {iconContent}
    </button>
  );
};

export default ButtonFunction;
