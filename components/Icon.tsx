import type { FC, ImgHTMLAttributes } from "react";

type IconSet =
  | "Arrows"
  | "Base"
  | "Build"
  | "Charts"
  | "Components"
  | "Connect"
  | "Constellation"
  | "Edit"
  | "Emoji"
  | "Graphics"
  | "Makeups"
  | "Office"
  | "Peoples";

export type IconProps = ImgHTMLAttributes<HTMLImageElement> & {
  /**
   * アイコンカテゴリ（フォルダ名）。
   * 例: "Base", "Arrows" など。デフォルトは "Base"。
   */
  set?: IconSet;
  /**
   * アイコン名（ファイル名の .svg を除いた部分）。
   * 例: "home", "search" など。
   */
  name: string;
};

/**
 * `public/icons` 配下の SVG を React コンポーネントとして扱うための汎用アイコン。
 *
 * 使用例:
 * ```tsx
 * <Icon name="home" />                // /public/icons/Base/home.svg
 * <Icon set="Arrows" name="up" />     // /public/icons/Arrows/up.svg
 * ```
 */
export const Icon: FC<IconProps> = ({ set = "Base", name, alt, ...imgProps }) => {
  const src = `/icons/${set}/${name}.svg`;
  const computedAlt = alt ?? `${set} ${name} icon`;

  return <img src={src} alt={computedAlt} {...imgProps} />;
};

export default Icon;



