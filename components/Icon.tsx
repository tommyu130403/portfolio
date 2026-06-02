import type { FC, ImgHTMLAttributes } from "react";

type IconSet =
  | "Abstract"
  | "Animals"
  | "Arrows"
  | "Base"
  | "Brand"
  | "Build"
  | "Character"
  | "Charts"
  | "Clothes"
  | "Communicate"
  | "Components"
  | "Connect"
  | "Constellation"
  | "Datas"
  | "Edit"
  | "Emoji"
  | "Energy"
  | "Graphics"
  | "Hands"
  | "Hardware"
  | "Health"
  | "Industry"
  | "Makeups"
  | "Measurement"
  | "Money"
  | "Music"
  | "Office"
  | "Operate"
  | "Others"
  | "Peoples"
  | "Safe"
  | "Sports"
  | "Time"
  | "Travels"
  | "Weather";

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
  /**
   * 色を指定した場合、SVG をマスクとして適用し、この色で表示する。
   * 例: "var(--color-main-100)"
   */
  tintColor?: string;
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
export const Icon: FC<IconProps> = ({
  set = "Base",
  name,
  alt,
  tintColor,
  className,
  ...imgProps
}) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const src = `${basePath}/icons/${set}/${name}.svg`;
  const computedAlt = alt ?? `${set} ${name} icon`;

  if (tintColor) {
    return (
      <span
        className={className}
        style={{
          display: "inline-block",
          backgroundColor: tintColor,
          maskImage: `url(${src})`,
          maskRepeat: "no-repeat",
          maskPosition: "center",
          maskSize: "contain",
          WebkitMaskImage: `url(${src})`,
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          WebkitMaskSize: "contain",
        }}
        role="img"
        aria-label={typeof computedAlt === "string" ? computedAlt : undefined}
        {...imgProps}
      />
    );
  }

  return <img src={src} alt={computedAlt} className={className} {...imgProps} />;
};

export default Icon;



