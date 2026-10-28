import type { CSSProperties, FC } from "react";
import ProtectedImage from "./ProtectedImage";
import type { ThumbnailLayout } from "@/lib/work-content";

/* 構成サムネイル（works.thumbnail）。親の箱（position 指定済み・16:9）を埋める。
 * 1280×720 を基準 px として書き、大きさ・文字は cqw、位置は % に変換する。
 * 根要素が container-type: inline-size のため cqh は使えない（高さも cqw で表す）。
 * cqw は container 宣言した要素自身では祖先基準になるので、縞などは子の層に付ける */

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

const SHADOW = `0 ${u(16)} ${u(40)} rgb(0 0 0 / 0.5)`;

type Box = { left: number; top: number; width: number; height: number };

const boxStyle = ({ left, top, width, height }: Box): CSSProperties => ({
  left: x(left),
  top: y(top),
  width: x(width),
  height: y(height),
});

/** 画像が空なら何も描かない（枠の bg-system-900 が空き枠として見える） */
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
    className="absolute flex flex-col overflow-hidden bg-system-800"
    style={{ ...boxStyle(box), borderRadius: u(16), boxShadow: SHADOW }}
  >
    <div className="flex items-center" style={{ height: u(32), gap: u(8), paddingLeft: u(16) }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((color) => (
        <span
          key={color}
          className="rounded-full"
          style={{ width: u(10), height: u(10), backgroundColor: color }}
        />
      ))}
    </div>
    <div className="relative flex-1 bg-system-900">
      <Shot src={src} />
    </div>
  </div>
);

const PhoneFrame: FC<Box & { src: string | null }> = ({ src, ...box }) => (
  <div
    className="absolute overflow-hidden border-solid bg-system-900"
    style={{
      ...boxStyle(box),
      borderWidth: u(6),
      borderColor: "#0a0a0a",
      borderRadius: u(28),
      boxShadow: SHADOW,
    }}
  >
    <div className="relative h-full w-full">
      <Shot src={src} />
    </div>
  </div>
);

const CaptureFrame: FC<Box & { src: string | null }> = ({ src, ...box }) => (
  <div
    className="absolute overflow-hidden bg-system-900 ring-1 ring-white/10"
    style={{ ...boxStyle(box), borderRadius: u(12), boxShadow: SHADOW }}
  >
    <Shot src={src} />
  </div>
);

const Logo: FC<{ src: string | null; size: number; left: number; top: number; radius: number }> = ({
  src,
  size,
  left,
  top,
  radius,
}) => (
  <div
    className={`absolute overflow-hidden ${
      src ? "" : "flex items-center justify-center border border-dashed border-system-700 font-bold text-system-500"
    }`}
    style={{
      left: x(left),
      top: y(top),
      width: u(size),
      height: u(size),
      borderRadius: u(radius),
      ...(src ? {} : { fontSize: u(size * 0.22) }),
    }}
  >
    {src ? <Shot src={src} /> : "LOGO"}
  </div>
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
  const capture = (i: number) => captureUrls[i] || null;
  const isD = layout === "d";

  return (
    <div aria-hidden className={`@container absolute inset-0 overflow-hidden bg-system-950 ${className ?? ""}`}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.035) 0 0.15cqw, transparent 0.15cqw 1.6cqw)",
        }}
      />

      {layout === "a1" && (
        <>
          <Logo src={logoUrl} size={64} left={48} top={48} radius={12} />
          <DesktopFrame src={desktopUrl} left={640} top={180} width={704} height={612} />
          <PhoneFrame src={mobile(0)} left={550} top={274} width={218} height={518} />
        </>
      )}
      {layout === "a2" && (
        <>
          <Logo src={logoUrl} size={64} left={48} top={48} radius={12} />
          <DesktopFrame src={desktopUrl} left={640} top={216} width={768} height={576} />
        </>
      )}
      {layout === "a3" && (
        <>
          <Logo src={logoUrl} size={64} left={48} top={48} radius={12} />
          <PhoneFrame src={mobile(0)} left={640} top={100} width={300} height={780} />
          <PhoneFrame src={mobile(1)} left={980} top={-60} width={300} height={780} />
        </>
      )}
      {isD && (
        <>
          <Logo src={logoUrl} size={160} left={48} top={48} radius={24} />
          <CaptureFrame src={capture(0)} left={640} top={86} width={538} height={432} />
          <CaptureFrame src={capture(1)} left={794} top={324} width={461} height={360} />
        </>
      )}

      {serviceName ? (
        <p
          className="absolute min-w-0 font-bold text-system-white"
          style={
            isD
              ? { left: x(48), top: y(224), width: x(512), fontSize: u(28) }
              : {
                  left: x(128),
                  top: y(48),
                  width: x(512),
                  height: u(64),
                  display: "flex",
                  alignItems: "center",
                  fontSize: u(28),
                }
          }
        >
          {/* flex 要素では text-overflow が効かないため、省略記号は内側の block 要素に付ける */}
          <span className="block min-w-0 max-w-full truncate">{serviceName}</span>
        </p>
      ) : null}
      <p
        className="absolute line-clamp-3 font-bold text-system-white [overflow-wrap:anywhere]"
        style={{
          left: x(48),
          bottom: y(48),
          width: x(layout === "a1" ? 480 : 576),
          fontSize: u(56),
          lineHeight: 1.25,
        }}
      >
        {title}
      </p>
    </div>
  );
};

export default WorkThumbnail;
