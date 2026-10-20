/** 長辺の上限（px）。これを超える画像は縮小する */
const MAX_EDGE = 2000;
const WEBP_QUALITY = 0.85;

/**
 * アップロード前に画像を WebP へ圧縮する（ブラウザ専用）。
 * - 画像以外・GIF（アニメ）・SVG（ベクター）はそのまま返す
 * - 長辺 2000px まで縮小（拡大はしない）
 * - 失敗時、または WebP が元のファイル以上のサイズになる場合（縮小の有無を問わず）は元のファイルを返す
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const longEdge = Math.max(bitmap.width, bitmap.height);
    const ratio = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1;
    const w = Math.max(1, Math.round(bitmap.width * ratio));
    const h = Math.max(1, Math.round(bitmap.height * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
    if (!blob || blob.type !== "image/webp") return file;
    if (blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^./\\]+$/, "") || "image";
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
