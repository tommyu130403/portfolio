"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/src/lib/supabase";

/** 縮小版の幅。scripts/make-image-variants.mjs と閲覧規則(supabase/migrations の image_variants)の幅と揃える */
export type VariantWidth = 480 | 960;

type ProtectedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
  /** 表示の大きさに合わせた縮小版(WebP)を先に読む。縮小版が無い・読めないときは元の画像に戻る。拡大表示など原寸が要る所では渡さない */
  variantWidth?: VariantWidth;
  /** 表示できない状態（権限なし・署名失敗・読み込み失敗）に入った / 抜けたときに呼ぶ。代わりの表示に切り替える用 */
  onUnavailableChange?: (unavailable: boolean) => void;
};

const BUCKET = "Portfolio";
const SIGNED_URL_SECONDS = 60 * 60;
const REFRESH_BEFORE_SECONDS = 5 * 60;
const examplePublicUrl = new URL(supabase.storage.from(BUCKET).getPublicUrl("__probe__").data.publicUrl);
const publicPathPrefix = examplePublicUrl.pathname.slice(0, -"__probe__".length);
const exampleRenderedUrl = new URL(supabase.storage.from(BUCKET).getPublicUrl("__probe__", { transform: { width: 1 } }).data.publicUrl);
const renderedPathPrefix = exampleRenderedUrl.pathname.slice(0, -"__probe__".length);
const storageRoot = publicPathPrefix.split("/object/public/")[0];

type SignedEntry = { url: string; expiresAt: number };

const RASTER_PATH = /\.(png|jpe?g|webp)$/i;
/** 縮小版の置き場所。元のパスの後ろに .webp を足す(元の拡張子を残し、閲覧規則が元のパスに戻せるようにする) */
const variantPathFor = (path: string, width: VariantWidth) => `_v/${width}/${path}.webp`;
// 縮小版が無い(まだ作っていない新しい画像など)と分かったパス。以後は元の画像を直接読む
const missingVariants = new Set<string>();

// 署名結果は画面全体で共有する。署名 URL は毎回トークンが変わりブラウザのキャッシュが効かないため、
// 同じ画像を別の部品や作り直された部品が署名し直すと、画像の取得まで二重になる
const signedCache = new Map<string, SignedEntry>();
const pendingSigns = new Map<string, Promise<SignedEntry | null>>();
// 読める画像は役割ごとに違うため、ログインし直しで別のユーザーになったら共有を捨てる。
// 前のユーザーの署名が後から届いても共有に入れないよう、世代で見分ける
let cacheGeneration = 0;
let cacheUserId: string | null | undefined;
supabase.auth.onAuthStateChange((_event, session) => {
  const userId = session?.user.id ?? null;
  if (cacheUserId !== undefined && userId !== cacheUserId) {
    cacheGeneration += 1;
    signedCache.clear();
    pendingSigns.clear();
    missingVariants.clear();
  }
  cacheUserId = userId;
});

function isFresh(entry: SignedEntry | undefined): entry is SignedEntry {
  return !!entry && entry.expiresAt > Date.now() + REFRESH_BEFORE_SECONDS * 1000;
}

/** 失効間近（REFRESH_BEFORE_SECONDS 以内）でなければ共有の結果を返し、そうでなければ署名する。同時の依頼は 1 回にまとめる */
function signPath(path: string): Promise<SignedEntry | null> {
  const cached = signedCache.get(path);
  if (isFresh(cached)) return Promise.resolve(cached);
  const pending = pendingSigns.get(path);
  if (pending) return pending;
  const generation = cacheGeneration;
  const request = supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS)
    .then(({ data, error }) => {
      if (error || !data?.signedUrl) return null;
      const entry = { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_SECONDS * 1000 };
      if (generation === cacheGeneration) signedCache.set(path, entry);
      return entry;
    })
    .catch(() => null)
    .finally(() => { if (pendingSigns.get(path) === request) pendingSigns.delete(path); });
  pendingSigns.set(path, request);
  return request;
}

/** Stored public URLs are stable identifiers; only the rendered URL is signed. */
function classifySource(src: string): { protected: boolean; path: string | null } {
  try {
    const image = new URL(src);
    if (image.origin !== examplePublicUrl.origin) return { protected: false, path: null };
    const prefix = [publicPathPrefix, renderedPathPrefix].find((candidate) => image.pathname.startsWith(candidate));
    if (prefix) {
      const path = decodeURIComponent(image.pathname.slice(prefix.length));
      return { protected: true, path: path || null };
    }
    // An unexpected URL from this bucket must not become a raw image request.
    const sameBucket = image.pathname.startsWith(`${storageRoot}/`) && image.pathname.includes(`/${BUCKET}/`);
    return { protected: sameBucket, path: null };
  } catch {
    return { protected: false, path: null };
  }
}

/** Storage の公開 URL から bucket 内のパスを取り出す。Storage の URL でなければ null */
export function storagePathFromUrl(src: string): string | null {
  return classifySource(src).path;
}

export default function ProtectedImage({ src, alt = "", variantWidth, onUnavailableChange, onError, onLoad, ...props }: ProtectedImageProps) {
  const { accessRole } = useAuth();
  const source = classifySource(src);
  const path = source.path;
  const variantPath = path && variantWidth && RASTER_PATH.test(path) ? variantPathFor(path, variantWidth) : null;
  // 署名するパス。縮小版が無いと分かったら元の画像にする(missingVariants への追加は refresh で描き直して反映する)
  const signTarget = variantPath && !missingVariants.has(variantPath) ? variantPath : path;
  const mayRead = accessRole === "owner" || accessRole === "reader";
  const imageRef = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(false);
  const [refresh, setRefresh] = useState(0);
  // 作り直されたときも、共有の署名が生きていれば最初の描画から使う（署名・画像の取り直しを起こさない）
  // source は署名したパス(縮小版か元の画像か)。src が変われば署名するパスも変わる
  const [signed, setSigned] = useState<{ source: string; url: string; expiresAt: number } | null>(() => {
    const cached = signTarget ? signedCache.get(signTarget) : undefined;
    return signTarget && isFresh(cached) ? { source: signTarget, ...cached } : null;
  });
  const [signFailure, setSignFailure] = useState<string | null>(null);
  const [loadErrorSrc, setLoadErrorSrc] = useState<string | null>(null);
  // 一度でも読み込みが終わったか。フェードは最初の 1 回だけ(署名の更新や src の差し替えで消えて見えないように)
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!source.protected || !imageRef.current) return;
    const image = imageRef.current;
    if (typeof IntersectionObserver === "undefined") {
      let active = true;
      queueMicrotask(() => { if (active) setVisible(true); });
      return () => { active = false; };
    }
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "200px" },
    );
    observer.observe(image);
    return () => observer.disconnect();
  }, [source.protected]);

  useEffect(() => {
    if (!signTarget || !mayRead || !visible) return;
    if (signed?.source === signTarget && isFresh(signed)) return;
    let active = true;
    signPath(signTarget).then((entry) => {
      if (!active) return;
      if (!entry && signTarget !== path) {
        // 縮小版が無い・読めない → 元の画像で署名し直す
        missingVariants.add(signTarget);
        setRefresh((value) => value + 1);
      } else if (!entry) setSignFailure(src);
      else {
        setSignFailure(null);
        setSigned({ source: signTarget, ...entry });
      }
    });
    return () => { active = false; };
  }, [signTarget, path, src, mayRead, visible, signed, refresh]);

  useEffect(() => {
    if (!visible || !source.protected || !signed || signed.source !== signTarget) return;
    const remaining = signed.expiresAt - Date.now() - REFRESH_BEFORE_SECONDS * 1000;
    const timer = window.setTimeout(() => setRefresh((value) => value + 1), Math.max(remaining, 1000));
    return () => window.clearTimeout(timer);
  }, [visible, source.protected, signed, signTarget]);

  useEffect(() => {
    if (!signed) return;
    const timer = window.setTimeout(() => {
      setSigned((current) => current === signed ? null : current);
    }, Math.max(signed.expiresAt - Date.now(), 0));
    return () => window.clearTimeout(timer);
  }, [signed]);

  useEffect(() => {
    if (!visible || signFailure !== src) return;
    const timer = window.setTimeout(() => setRefresh((value) => value + 1), 30_000);
    return () => window.clearTimeout(timer);
  }, [visible, signFailure, src]);

  // Never send a private bucket's old public URL to the browser as an image request.
  const renderSrc = source.protected
    ? (mayRead && signed?.source === signTarget ? signed.url : undefined)
    : src || undefined;
  const showingVariant = !!renderSrc && !!variantPath && signTarget === variantPath;
  // 縮小版の読み込みに失敗したら、表示できない扱いにせず元の画像に切り替える
  const handleLoadFailure = (failedSrc: string | null) => {
    if (showingVariant && variantPath) {
      missingVariants.add(variantPath);
      setRefresh((value) => value + 1);
    } else setLoadErrorSrc(failedSrc);
  };
  const handleLoadFailureRef = useRef(handleLoadFailure);
  useEffect(() => { handleLoadFailureRef.current = handleLoadFailure; });
  const failed = source.protected && signFailure === src && !renderSrc;
  // 権限の判定中（loading）と署名待ちは「まだ」であって表示不可ではない
  const unavailable =
    (source.protected && accessRole !== "loading" && !mayRead) ||
    failed ||
    (!source.protected && !renderSrc) ||
    (!!renderSrc && loadErrorSrc === renderSrc);
  // 画面の処理が動く前に読み込みが失敗し終わっていると onError が届かないため、描画後にも確かめる
  useEffect(() => {
    const image = imageRef.current;
    if (!renderSrc || !image?.complete || image.naturalWidth > 0) return;
    let active = true;
    queueMicrotask(() => { if (active) handleLoadFailureRef.current(renderSrc); });
    return () => { active = false; };
  }, [renderSrc]);
  // 画面の処理が動く前に読み込みが終わっている画像は onLoad が届かないため、描画後にも確かめる
  useEffect(() => {
    const image = imageRef.current;
    if (!renderSrc || !image?.complete || image.naturalWidth === 0) return;
    let active = true;
    queueMicrotask(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [renderSrc]);
  // 読み込み完了までは透明にしてフェードインさせる。表示できない画像は代替テキストを見せるため対象外。
  // 優先読み込みの画像(ページの主画像)はフェードさせない(透明の間は表示完了と数えられず、表示速度の計測が遅れるため)
  const pending = !unavailable && !loaded && props.fetchPriority !== "high";
  const onUnavailableChangeRef = useRef(onUnavailableChange);
  useEffect(() => { onUnavailableChangeRef.current = onUnavailableChange; });
  useEffect(() => { onUnavailableChangeRef.current?.(unavailable); }, [unavailable]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      ref={imageRef}
      src={renderSrc}
      data-img-fade=""
      data-pending={pending ? "" : undefined}
      alt={failed ? `${alt || "画像"}を表示できません` : alt}
      title={failed ? "画像を表示できません。再試行中です" : props.title}
      onLoad={(e) => { setLoaded(true); onLoad?.(e); }}
      onError={(e) => {
        // 縮小版から元の画像へ切り替えるときは、呼び出し側には失敗を知らせない(元の画像が届く)
        if (showingVariant) handleLoadFailure(renderSrc ?? null);
        else { setLoadErrorSrc(renderSrc ?? null); onError?.(e); }
      }}
    />
  );
}
