"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/src/lib/supabase";

type ProtectedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
};

const BUCKET = "Portfolio";
const SIGNED_URL_SECONDS = 60 * 60;
const REFRESH_BEFORE_SECONDS = 5 * 60;
const examplePublicUrl = new URL(supabase.storage.from(BUCKET).getPublicUrl("__probe__").data.publicUrl);
const publicPathPrefix = examplePublicUrl.pathname.slice(0, -"__probe__".length);
const exampleRenderedUrl = new URL(supabase.storage.from(BUCKET).getPublicUrl("__probe__", { transform: { width: 1 } }).data.publicUrl);
const renderedPathPrefix = exampleRenderedUrl.pathname.slice(0, -"__probe__".length);
const storageRoot = publicPathPrefix.split("/object/public/")[0];

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

export default function ProtectedImage({ src, alt = "", ...props }: ProtectedImageProps) {
  const { accessRole } = useAuth();
  const source = classifySource(src);
  const path = source.path;
  const mayRead = accessRole === "owner" || accessRole === "reader";
  const imageRef = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [signed, setSigned] = useState<{ source: string; url: string; expiresAt: number } | null>(null);
  const [signFailure, setSignFailure] = useState<string | null>(null);

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
    if (signed?.source === src && signed.expiresAt > Date.now() + REFRESH_BEFORE_SECONDS * 1000) return;
    let active = true;
    supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS)
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data?.signedUrl) setSignFailure(src);
        else {
          setSignFailure(null);
          setSigned({ source: src, url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_SECONDS * 1000 });
        }
      })
      .catch(() => { if (active) setSignFailure(src); });
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
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} ref={imageRef} src={renderSrc} alt={failed ? `${alt || "画像"}を表示できません` : alt} title={failed ? "画像を表示できません。再試行中です" : props.title} />;
}
