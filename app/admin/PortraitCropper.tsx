"use client";

import { useEffect, useRef, useState } from "react";

const VIEWPORT = 320;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const OUTPUT_SIZE = 800;

type Size = { w: number; h: number };
type Offset = { x: number; y: number };

/** 正方形の枠をちょうど覆う倍率（zoom = 1 のときの表示倍率） */
function coverScale(natural: Size): number {
  return VIEWPORT / Math.min(natural.w, natural.h);
}

/** 画像の左上位置を、枠に隙間が出ない範囲へ収める */
function clampOffset(offset: Offset, natural: Size, scale: number): Offset {
  const minX = VIEWPORT - natural.w * scale;
  const minY = VIEWPORT - natural.h * scale;
  return {
    x: Math.min(0, Math.max(minX, offset.x)),
    y: Math.min(0, Math.max(minY, offset.y)),
  };
}

/** 枠の中心にある画像上の点を動かさずに倍率を変える */
function zoomAroundCenter(offset: Offset, oldScale: number, newScale: number): Offset {
  const cx = (VIEWPORT / 2 - offset.x) / oldScale;
  const cy = (VIEWPORT / 2 - offset.y) / oldScale;
  return { x: VIEWPORT / 2 - cx * newScale, y: VIEWPORT / 2 - cy * newScale };
}

/** zoom = 1・中央のときの位置 */
function centeredOffset(natural: Size, scale: number): Offset {
  return { x: (VIEWPORT - natural.w * scale) / 2, y: (VIEWPORT - natural.h * scale) / 2 };
}

/** 枠に映っている範囲を、元画像のピクセル座標で返す */
function sourceRect(offset: Offset, scale: number) {
  return { sx: -offset.x / scale, sy: -offset.y / scale, size: VIEWPORT / scale };
}

export default function PortraitCropper({
  open,
  source,
  onClose,
  onCropped,
}: {
  open: boolean;
  source: Blob | null;
  onClose: () => void;
  onCropped: (file: File) => void;
}) {
  if (!open || !source) return null;
  return <CropperBody source={source} onClose={onClose} onCropped={onCropped} />;
}

function CropperBody({
  source,
  onClose,
  onCropped,
}: {
  source: Blob;
  onClose: () => void;
  onCropped: (file: File) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const drag = useRef<{ pointerX: number; pointerY: number; origin: Offset } | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(source);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [source]);

  const scale = natural ? coverScale(natural) * zoom : 1;

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const size = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight };
    setNatural(size);
    setZoom(MIN_ZOOM);
    setOffset(centeredOffset(size, coverScale(size)));
  };

  const handleZoom = (next: number) => {
    if (!natural) return;
    const nextScale = coverScale(natural) * next;
    setZoom(next);
    setOffset((o) => clampOffset(zoomAroundCenter(o, scale, nextScale), natural, nextScale));
  };

  const handleReset = () => {
    if (!natural) return;
    setZoom(MIN_ZOOM);
    setOffset(centeredOffset(natural, coverScale(natural)));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!natural || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointerX: e.clientX, pointerY: e.clientY, origin: offset };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!natural || !drag.current) return;
    const { pointerX, pointerY, origin } = drag.current;
    setOffset(clampOffset({ x: origin.x + e.clientX - pointerX, y: origin.y + e.clientY - pointerY }, natural, scale));
  };

  const handlePointerEnd = () => {
    drag.current = null;
  };

  const handleSave = async () => {
    if (!natural) return;
    setSaving(true);
    setError("");
    try {
      const { sx, sy, size } = sourceRect(offset, scale);
      const outSize = Math.round(Math.min(OUTPUT_SIZE, size));
      const bitmap = await createImageBitmap(source);
      const canvas = document.createElement("canvas");
      canvas.width = outSize;
      canvas.height = outSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, outSize, outSize);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
      if (!blob) throw new Error("blob");
      // WebP に書き出せないブラウザ（古い Safari など）は PNG を返すため、実際の形式で名前を付ける
      const ext = blob.type === "image/webp" ? "webp" : "png";
      onCropped(new File([blob], `portrait-${Date.now()}.${ext}`, { type: blob.type || "image/png" }));
    } catch {
      setError("切り抜きに失敗しました。別の画像でもう一度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => { if (!saving) onClose(); }}>
      <div
        className="flex w-[380px] max-w-[94vw] flex-col overflow-hidden rounded-[12px] border border-border-light bg-[#1a1a1a]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-5 py-4">
          <p className="text-[14px] font-semibold text-white">写真を切り抜く</p>
          <button type="button" onClick={onClose} disabled={saving} className="text-[18px] text-system-700 hover:text-white disabled:opacity-40">
            ✕
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 px-5 py-5">
          <div
            className="relative cursor-grab touch-none overflow-hidden rounded-[16%] bg-black active:cursor-grabbing"
            style={{ width: VIEWPORT, height: VIEWPORT, touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
            {url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt=""
                draggable={false}
                onLoad={handleLoad}
                onError={() => setError("この画像は表示できません。JPEG・PNG・WebP の画像を選んでください。")}
                className="pointer-events-none absolute left-0 top-0 max-w-none select-none"
                style={
                  natural
                    ? { width: natural.w * scale, height: natural.h * scale, transform: `translate(${offset.x}px, ${offset.y}px)` }
                    : { visibility: "hidden" }
                }
              />
            )}
          </div>
          <p className="text-[11px] text-fg-muted">ドラッグで位置、スライダーで拡大を調整します（角の丸みは公開ページの見た目です）。反映後、ページ下の「保存」で確定します</p>

          <label className="flex w-full items-center gap-3 text-[12px] text-fg-muted">
            <span className="shrink-0">拡大</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              disabled={!natural}
              onChange={(e) => handleZoom(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </label>
          {error && <p className="w-full text-[11px] text-danger-300" role="alert">{error}</p>}
        </div>

        <div className="flex items-center justify-between border-t border-[#2a2a2a] px-5 py-4">
          <button
            type="button"
            onClick={handleReset}
            disabled={!natural || saving}
            className="rounded-[8px] border border-border-light px-3 py-2 text-[12px] text-fg-muted transition-colors hover:border-primary hover:text-white disabled:opacity-40"
          >
            リセット
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-[8px] border border-border-light px-4 py-2 text-[13px] text-fg-muted transition-colors hover:border-primary hover:text-white disabled:opacity-40"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!natural || saving}
              className="rounded-[8px] bg-primary px-4 py-2 text-[13px] font-semibold text-black transition-opacity disabled:opacity-40"
            >
              {saving ? "処理中…" : "切り抜いて反映"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
