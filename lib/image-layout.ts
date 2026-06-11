/**
 * Work 詳細・本文 markdown 内の画像レイアウト表現の共通ユーティリティ。
 *
 * 正式記法（attrs）: `![caption](url){width=260 align=left scale=1.2}`
 *   - align: full(既定・全幅) / left・right(回り込み) / center(中央・回り込みなし)
 *   - width: px 数値または "60%" など
 *   - scale: 表示倍率（1 = 等倍）
 * 旧記法（fragment）: `![caption](url#align=left&w=260&scale=1.2)` も読み取りのみ互換。
 *
 * エディタ（RichMarkdownEditor の画像ダイアログ）と表示（WorkMarkdown）の双方が
 * このユーティリティを使い、解釈を一致させる。
 */

export type ImageAlign = "full" | "left" | "right" | "center";

export type ImageLayout = {
  /** フラグメント等を除いた実際の画像URL */
  base: string;
  align: ImageAlign;
  /** 表示幅（"260" など px 数値、または "60%"）。未指定は空文字 */
  width: string;
  /** 表示倍率（1 = 等倍） */
  scale: number;
};

const DEFAULT_LAYOUT: Omit<ImageLayout, "base"> = { align: "full", width: "", scale: 1 };

function normalizeAlign(v: string | null | undefined): ImageAlign {
  return v === "left" || v === "right" || v === "center" ? v : "full";
}

/** `{width=260 align=left scale=1.2}` の中身（波括弧なし）を解釈する */
export function parseImageAttrs(attrStr: string | null | undefined, src: string): ImageLayout {
  // 旧 fragment 記法の互換読み取り（src 側に #align=..&w=.. が残っている場合）
  const fromFragment = parseImageSrcFragment(src);
  if (!attrStr) return fromFragment;

  const out: ImageLayout = { ...fromFragment };
  const re = /(\w+)\s*=\s*([^\s,}]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrStr)) !== null) {
    const [, key, value] = m;
    if (key === "align") out.align = normalizeAlign(value);
    else if (key === "width" || key === "w") out.width = value.replace(/px$/i, "");
    else if (key === "scale") {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) out.scale = n;
    }
  }
  return out;
}

/** ImageLayout を `{...}` attrs 文字列へ（既定値は省略。属性なしなら空文字） */
export function buildImageAttrs(layout: Omit<ImageLayout, "base">): string {
  const parts: string[] = [];
  if (layout.width) parts.push(`width=${layout.width}`);
  if (layout.align && layout.align !== "full") parts.push(`align=${layout.align}`);
  if (layout.scale && layout.scale !== 1) parts.push(`scale=${layout.scale}`);
  return parts.length ? `{${parts.join(" ")}}` : "";
}

/** 画像1行分の markdown を生成する */
export function buildImageMarkdown(caption: string, url: string, layout: Omit<ImageLayout, "base">): string {
  return `![${caption}](${url})${buildImageAttrs(layout)}`;
}

/** 旧 fragment 記法 `url#align=..&w=..&scale=..` の互換読み取り */
export function parseImageSrcFragment(src: string): ImageLayout {
  const hashIdx = src.indexOf("#");
  if (hashIdx < 0) return { base: src, ...DEFAULT_LAYOUT };
  const base = src.slice(0, hashIdx);
  const params = new URLSearchParams(src.slice(hashIdx + 1));
  const scaleNum = Number(params.get("scale"));
  return {
    base,
    align: normalizeAlign(params.get("align")),
    width: params.get("w") ?? "",
    scale: Number.isFinite(scaleNum) && scaleNum > 0 ? scaleNum : 1,
  };
}

/** width 文字列を CSS の幅値へ正規化（数値のみなら px を付与） */
export function widthToCss(width: string): string | undefined {
  const w = width.trim();
  if (!w) return undefined;
  return /^\d+(\.\d+)?$/.test(w) ? `${w}px` : w;
}
