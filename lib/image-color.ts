/** 画像の代表色（サムネイルの地のグラデーション用）を取り出す。
 * 表示中の <img> とは別に読み直す（表示側に crossOrigin を付けると、キャッシュ次第で表示そのものが失敗しうるため）。
 * 32×32 に縮めて、白・黒に近い画素を除き、彩度の高い画素ほど重く平均する。読めないときは null。 */
const cache = new Map<string, Promise<string | null>>();

export function pickImageColor(url: string): Promise<string | null> {
  const key = url.split("?")[0];
  const hit = cache.get(key);
  if (hit) return hit;
  const job = (async () => {
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) return null;
      const bitmap = await createImageBitmap(await res.blob());
      const size = 32;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      let r = 0, g = 0, b = 0, total = 0;
      for (let i = 0; i < data.length; i += 4) {
        const [pr, pg, pb, pa] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
        if (pa < 128) continue;
        const max = Math.max(pr, pg, pb);
        const min = Math.min(pr, pg, pb);
        if (max < 24 || min > 232) continue; // 黒・白に近い画素は地色として使わない
        const weight = 0.1 + (max - min) / 255; // 彩度が高いほど重く
        r += pr * weight;
        g += pg * weight;
        b += pb * weight;
        total += weight;
      }
      if (total === 0) return null;
      const hex = (v: number) => Math.round(v / total).toString(16).padStart(2, "0");
      return `#${hex(r)}${hex(g)}${hex(b)}`;
    } catch {
      return null;
    }
  })();
  cache.set(key, job);
  return job;
}
