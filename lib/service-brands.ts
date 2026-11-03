/* 作品に紐づけるサービスのブランド（構成サムネイルの地とロゴに使う）。
 * 色はロゴファイルの塗りを基に決めた値（ロゴに副色が無いサービスは主色に合う色を選んだ）。サービスごとのデータでありデザイントークンではないため hex を直書きする。
 * ロゴは public/service-logos/ に置く。main = 主色、sub = 副色 */

export type ServiceBrand = {
  key: string;
  name: string;
  file: string;
  main: string;
  sub: string;
};

export const SERVICE_BRANDS: readonly ServiceBrand[] = [
  { key: "leverages", name: "レバレジーズ", file: "leverages.svg", main: "#3F3F3F", sub: "#A0A0A0" },
  { key: "careerticket", name: "キャリアチケット就職", file: "careerticket.svg", main: "#1C50A0", sub: "#6EC2ED" },
  { key: "careerticket-scout", name: "キャリアチケット就職スカウト", file: "careerticket-scout.webp", main: "#1C50A0", sub: "#6EC2ED" },
  { key: "careerticket-cafe", name: "キャリアチケットカフェ", file: "careerticket-cafe.svg", main: "#FF9D24", sub: "#3A9ADF" },
  { key: "careerticket-tenshoku", name: "キャリアチケット転職", file: "careerticket-tenshoku.svg", main: "#1C50A0", sub: "#6EC2ED" },
  { key: "hataractive", name: "ハタラクティブ", file: "hataractive.svg", main: "#6CB52D", sub: "#F29419" },
  { key: "factboard", name: "FactBoard", file: "factboard.svg", main: "#14B3B3", sub: "#292929" },
  { key: "levtech-direct", name: "レバテックダイレクト", file: "levtech-direct.svg", main: "#F75D19", sub: "#FFB38F" },
  { key: "levtech", name: "レバテック", file: "levtech.svg", main: "#26919F", sub: "#154F56" },
  { key: "levwell-kango", name: "レバウェル看護", file: "levwell-kango.svg", main: "#E96081", sub: "#6EC2ED" },
];

/** key からブランドを引く。未設定・不明な key は null */
export function getServiceBrand(key: unknown): ServiceBrand | null {
  if (typeof key !== "string") return null;
  return SERVICE_BRANDS.find((b) => b.key === key) ?? null;
}

export function serviceLogoSrc(brand: ServiceBrand): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/service-logos/${brand.file}`;
}
