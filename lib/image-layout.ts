/**
 * Work 詳細・本文 markdown 内の画像レイアウトを URL フラグメントで表現するための共通ユーティリティ。
 *
 * markdown では画像は `![caption](url)` の形でしか表現できないため、配置・幅・倍率を
 * URL のフラグメント（`url#align=left&w=260&scale=1.2`）に埋め込んで往復させる。
 * 既定値（align=full / width 無し / scale=1）はフラグメントに出力しない。
 *
 * - エディタ側（MarkdownEditor の Image NodeView）と表示側（WorkModalContent）の双方が
 *   このユーティリティを使い、解釈を一致させる。
 */

export type ImageAlign = "full" | "left" | "right";

export type ImageLayout = {
  /** フラグメントを除いた実際の画像URL */
  base: string;
  align: ImageAlign;
  /** 表示幅（"260" など px 数値、または "60%"）。未指定は空文字 */
  width: string;
  /** 表示倍率（1 = 等倍） */
  scale: number;
};

/** `url#align=..&w=..&scale=..` を ImageLayout へ分解する */
export function parseImageSrc(src: string): ImageLayout {
  const hashIdx = src.indexOf("#");
  if (hashIdx < 0) return { base: src, align: "full", width: "", scale: 1 };
  const base = src.slice(0, hashIdx);
  const params = new URLSearchParams(src.slice(hashIdx + 1));
  const align = params.get("align");
  const scaleNum = Number(params.get("scale"));
  return {
    base,
    align: align === "left" || align === "right" ? align : "full",
    width: params.get("w") ?? "",
    scale: Number.isFinite(scaleNum) && scaleNum > 0 ? scaleNum : 1,
  };
}

/** ImageLayout を `url#align=..&w=..&scale=..` へ再構成する（既定値は省略） */
export function buildImageSrc(layout: ImageLayout): string {
  const params = new URLSearchParams();
  if (layout.align && layout.align !== "full") params.set("align", layout.align);
  if (layout.width) params.set("w", layout.width);
  if (layout.scale && layout.scale !== 1) params.set("scale", String(layout.scale));
  const q = params.toString();
  return q ? `${layout.base}#${q}` : layout.base;
}

/** width 文字列を CSS の幅値へ正規化（数値のみなら px を付与） */
export function widthToCss(width: string): string | undefined {
  const w = width.trim();
  if (!w) return undefined;
  return /^\d+(\.\d+)?$/.test(w) ? `${w}px` : w;
}
