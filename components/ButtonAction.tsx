"use client";

import type { FC, ReactNode } from "react";
import Icon, { type IconProps } from "./Icon";
import { BUTTON_ACTION, type ButtonActionType } from "@/lib/figma-button-variants";

type ButtonActionProps = {
  label: string;
  type?: ButtonActionType;
  href?: string;
  onClick?: () => void;
  iconRight?: { set: NonNullable<IconProps["set"]>; name: string };
  children?: ReactNode;
};

export const ButtonAction: FC<ButtonActionProps> = ({
  label,
  type = "primary",
  href,
  onClick,
  iconRight,
  children,
}) => {
  const t = BUTTON_ACTION.type[type];
  const className = [
    BUTTON_ACTION.base,
    t.default,
    t.hover,
  ].join(" ");

  const content = (
    <>
      {children ?? label}
      {iconRight && (
        <Icon set={iconRight.set} name={iconRight.name} className="ml-2 h-5 w-5" aria-hidden />
      )}
    </>
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
};

export default ButtonAction;
