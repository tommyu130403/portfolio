import type { FC, ImgHTMLAttributes } from "react";

export type ServiceLogoProps = ImgHTMLAttributes<HTMLImageElement> & {
  /**
   * ロゴ名（public/logos/ 配下のファイル名から .svg を除いた部分）。
   * 例: "figma", "github", "notion"
   */
  name: string;
};

/**
 * `public/logos` 配下のサービスロゴ SVG を表示する汎用コンポーネント。
 *
 * 使用例:
 * ```tsx
 * <ServiceLogo name="figma" className="h-8 w-8" />
 * <ServiceLogo name="github" className="h-6 w-6" />
 * ```
 */
export const ServiceLogo: FC<ServiceLogoProps> = ({ name, alt, ...imgProps }) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const src = `${basePath}/logos/${name}.svg`;
  const computedAlt = alt ?? `${name} logo`;

  return <img src={src} alt={computedAlt} {...imgProps} />;
};

export default ServiceLogo;
