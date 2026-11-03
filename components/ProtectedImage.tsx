"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/src/lib/supabase";

type ProtectedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
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

export default function ProtectedImage({ src, alt = "", onUnavailableChange, onError, ...props }: ProtectedImageProps) {
  const { accessRole } = useAuth();
  const source = classifySource(src);
  const path = source.path;
  const mayRead = accessRole === "owner" || accessRole === "reader";
  const imageRef = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(false);
  const [refresh, setRefresh] = useState(0);
  // 作り直されたときも、共有の署名が生きていれば最初の描画から使う（署名・画像の取り直しを起こさない）
  const [signed, setSigned] = useState<{ source: string; url: string; expiresAt: number } | null>(() => {
    const cached = path ? signedCache.get(path) : undefined;
    return isFresh(cached) ? { source: src, ...cached } : null;
  });
  const [signFailure, setSignFailure] = useState<string | null>(null);
  const [loadErrorSrc, setLoadErrorSrc] = useState<string | null>(null);

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
    if (!path || !mayRead || !visible) return;
    if (signed?.source === src && isFresh(signed)) return;
    let active = true;
    signPath(path).then((entry) => {
      if (!active) return;
      if (!entry) setSignFailure(src);
      else {
        setSignFailure(null);
        setSigned({ source: src, ...entry });
      }
    });
    return () => { active = false; };
  }, [path, src, mayRead, visible, signed, refresh]);

  useEffect(() => {
    if (!visible || !source.protected || !signed || signed.source !== src) return;
    const remaining = signed.expiresAt - Date.now() - REFRESH_BEFORE_SECONDS * 1000;
    const timer = window.setTimeout(() => setRefresh((value) => value + 1), Math.max(remaining, 1000));
    return () => window.clearTimeout(timer);
  }, [visible, source.protected, signed, src]);

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
    ? (mayRead && signed?.source === src ? signed.url : undefined)
    : src || undefined;
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
    queueMicrotask(() => { if (active) setLoadErrorSrc(renderSrc); });
    return () => { active = false; };
  }, [renderSrc]);
  const onUnavailableChangeRef = useRef(onUnavailableChange);
  useEffect(() => { onUnavailableChangeRef.current = onUnavailableChange; });
  useEffect(() => { onUnavailableChangeRef.current?.(unavailable); }, [unavailable]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      ref={imageRef}
      src={renderSrc}
      alt={failed ? `${alt || "画像"}を表示できません` : alt}
      title={failed ? "画像を表示できません。再試行中です" : props.title}
      onError={(e) => { setLoadErrorSrc(renderSrc ?? null); onError?.(e); }}
    />
  );
}
