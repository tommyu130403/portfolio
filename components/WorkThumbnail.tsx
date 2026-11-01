"use client";

import { useEffect, useRef, useState, type CSSProperties, type FC } from "react";
import ProtectedImage from "./ProtectedImage";
import type { ThumbnailLayout } from "@/lib/work-content";

/* 構成サムネイル（works.thumbnail）。親の箱（position 指定済み・16:9）を埋める。
 * 1280×720 を基準 px として書き、大きさ・文字は cqw、位置は % に変換する。
 * 根要素が container-type: inline-size のため cqh は使えない（高さも cqw で表す）。
 * cqw は container 宣言した要素自身では祖先基準になるので、縞などは子の層に付ける。
 * 数値の正は Claude Design「Works サムネイル 構成案 v2」（Figma: Library の WorkThumbnail）。
 * #1A1A1A / #0A0A0A / 縞の 2 色は対応するトークンが無いため直書き */

type Props = {
  layout: ThumbnailLayout;
  logoUrl: string | null;
  desktopUrl: string | null;
  mobileUrls: string[];
  captureUrls: string[];
  serviceName?: string | null;
  title: string;
  className?: string;
};

const u = (px: number) => `${px / 12.8}cqw`;
const x = (px: number) => `${px / 12.8}%`;
const y = (px: number) => `${px / 7.2}%`;

/** 画像が無いときの空き枠（斜線） */
const STRIPES: CSSProperties = {
  backgroundImage: `repeating-linear-gradient(135deg, #262626 0 ${u(14)}, #2b2b2b ${u(14)} ${u(28)})`,
};

type Box = { left: number; top: number; width: number; height: number };

const boxStyle = ({ left, top, width, height }: Box): CSSProperties => ({
  left: x(left),
  top: y(top),
  width: x(width),
  height: y(height),
});

/** 画像が空なら何も描かない（下の斜線が空き枠として見える） */
const Shot: FC<{ src: string | null }> = ({ src }) =>
  src ? (
    <ProtectedImage
      src={src}
      alt=""
      draggable={false}
      className="absolute inset-0 h-full w-full object-cover object-top"
    />
  ) : null;

const DesktopFrame: FC<Box & { src: string | null }> = ({ src, ...box }) => (
  <div
    className="absolute flex flex-col overflow-hidden border-solid border-system-800 bg-[#0a0a0a]"
    style={{ ...boxStyle(box), borderWidth: u(1), borderRadius: u(16) }}
  >
    <div
      className="flex shrink-0 items-center border-solid border-system-800"
      style={{ height: u(40), gap: u(8), paddingInline: u(18), borderBottomWidth: u(1) }}
    >
      {[0, 1, 2].map((i) => (
        <span key={i} className="rounded-full bg-system-800" style={{ width: u(11), height: u(11) }} />
      ))}
    </div>
    <div className="relative flex-1" style={STRIPES}>
      <Shot src={src} />
    </div>
  </div>
);

const PhoneFrame: FC<Box & { src: string | null }> = ({ src, ...box }) => (
  <div
    className="absolute flex border-solid border-system-800 bg-[#0a0a0a]"
    style={{ ...boxStyle(box), borderWidth: u(1), borderRadius: u(48), padding: u(12) }}
  >
    <div className="relative flex-1 overflow-hidden" style={{ ...STRIPES, borderRadius: u(36) }}>
      <Shot src={src} />
    </div>
  </div>
);

const CaptureFrame: FC<Box & { src: string | null }> = ({ src, ...box }) => (
  <div
    className="absolute overflow-hidden border-solid border-system-800 bg-[#1a1a1a]"
    style={{ ...boxStyle(box), borderWidth: u(1), borderRadius: u(12) }}
  >
    <div className="absolute inset-0" style={STRIPES}>
      <Shot src={src} />
    </div>
  </div>
);

/** ロゴがあればロゴ画像だけ、無ければサービス名だけを出す。
 * ロゴは高さを揃えて幅は比率なり（欄の幅を超えたら縮める）にし、見切れさせない。
 * ロゴは読み込めるまで隠してサービス名を出しておく（URL の署名失敗・画像切れでも名前が残る） */
const Brand: FC<{ logoUrl: string | null; serviceName: string; logoHeight: number; fontSize: number }> = ({
  logoUrl,
  serviceName,
  logoHeight,
  fontSize,
}) => {
  const boxRef = useRef<HTMLSpanElement>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const showLogo = logoUrl !== null && loadedUrl === logoUrl;

  /* 描画前に読み込みが済んでいると onLoad が来ないため、既に読めているかも見る */
  useEffect(() => {
    const img = boxRef.current?.querySelector("img");
    if (!logoUrl || !img?.complete || img.naturalWidth === 0) return;
    let active = true;
    queueMicrotask(() => { if (active) setLoadedUrl(logoUrl); });
    return () => { active = false; };
  }, [logoUrl]);

  return (
    <span ref={boxRef} className="contents">
      {logoUrl && (
        <ProtectedImage
          src={logoUrl}
          alt=""
          draggable={false}
          onLoad={() => setLoadedUrl(logoUrl)}
          onError={() => setLoadedUrl(null)}
          className={showLogo ? "block w-auto max-w-full object-contain object-left" : "invisible absolute w-auto"}
          style={{ height: u(logoHeight) }}
        />
      )}
      {!showLogo && (
        <p
          className="min-w-0 max-w-full truncate font-sans font-semibold text-system-white"
          style={{ fontSize: u(fontSize), letterSpacing: "0.02em" }}
        >
          {serviceName}
        </p>
      )}
    </span>
  );
};

const Title: FC<{ title: string; fontSize: number; style?: CSSProperties }> = ({ title, fontSize, style }) => (
  <p
    className="line-clamp-3 font-mplus font-bold text-system-white [overflow-wrap:anywhere]"
    style={{ fontSize: u(fontSize), lineHeight: 1.35, letterSpacing: u(1.6), ...style }}
  >
    {title}
  </p>
);

const WorkThumbnail: FC<Props> = ({
  layout,
  logoUrl,
  desktopUrl,
  mobileUrls,
  captureUrls,
  serviceName,
  title,
  className,
}) => {
  const mobile = (i: number) => mobileUrls[i] || null;
  /* 資料キャプチャは入っている分だけ数える（空き枠の "" は詰める）。0 枚なら空き枠を 2 つ見せる */
  const captures = captureUrls.filter(Boolean);
  /* 構成案どおり、ロゴもサービス名も未設定なら仮の名前を出す */
  const service = serviceName?.trim() || "Service";

  if (layout === "d") {
    return (
      <div aria-hidden className={`@container absolute inset-0 overflow-hidden bg-[#1a1a1a] ${className ?? ""}`}>
        <div
          className="absolute flex flex-col justify-between border-solid border-system-800 bg-[#0a0a0a]"
          style={{
            left: 0,
            top: 0,
            bottom: 0,
            width: x(520),
            borderRightWidth: u(1),
            paddingBlock: u(80),
            paddingInline: u(72),
          }}
        >
          <div className="flex min-w-0">
            <Brand logoUrl={logoUrl} serviceName={service} logoHeight={120} fontSize={48} />
          </div>
          <Title title={title} fontSize={44} />
        </div>
        {captures.length === 1 ? (
          <CaptureFrame src={captures[0]} left={600} top={120} width={800} height={660} />
        ) : (
          /* 2 枚のときは 1 枚目を手前に重ねるため、2 枚目から描く */
          <>
            <CaptureFrame src={captures[1] ?? null} left={760} top={360} width={620} height={420} />
            <CaptureFrame src={captures[0] ?? null} left={600} top={96} width={620} height={400} />
          </>
        )}
      </div>
    );
  }

  return (
    <div aria-hidden className={`@container absolute inset-0 overflow-hidden bg-[#1a1a1a] ${className ?? ""}`}>
      <div
        className="absolute flex items-center"
        style={{ left: x(80), top: y(80), width: x(520), height: u(64) }}
      >
        <Brand logoUrl={logoUrl} serviceName={service} logoHeight={64} fontSize={34} />
      </div>
      <Title title={title} fontSize={52} style={{ position: "absolute", left: x(80), bottom: y(80), width: x(460) }} />

      {layout === "a1" && (
        <>
          <DesktopFrame src={desktopUrl} left={620} top={120} width={780} height={660} />
          <PhoneFrame src={mobile(0)} left={540} top={300} width={220} height={460} />
        </>
      )}
      {layout === "a2" && <DesktopFrame src={desktopUrl} left={600} top={120} width={800} height={660} />}
      {layout === "a3" && (
        <>
          <PhoneFrame src={mobile(0)} left={620} top={140} width={290} height={620} />
          <PhoneFrame src={mobile(1)} left={950} top={60} width={290} height={620} />
        </>
      )}
    </div>
  );
};

export default WorkThumbnail;
