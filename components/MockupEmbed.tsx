"use client";

import { type FC, useState } from "react";
import { LaptopMock, PhoneMock, ScreenshotLightbox } from "./DeviceMock";

type MockupEmbedProps = {
  device: "phone" | "laptop";
  srcs: string[];
  browser: boolean;
  url: string | null;
};

/**
 * 作品本文に埋め込むデバイスモック（`::: mockup phone|laptop src=…`）。
 * クリックでその塊の画像をライトボックスで拡大する
 */
const MockupEmbed: FC<MockupEmbedProps> = ({ device, srcs, browser, url }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4 mt-10">
      {device === "phone" ? (
        <div className="flex w-full items-start justify-center gap-6">
          {srcs.map((src, i) => (
            <PhoneMock key={i} src={src} className={srcs.length > 1 ? "w-[180px] max-w-[calc(50%-12px)]" : "w-[180px] max-w-full"} onClick={() => setOpen(true)} />
          ))}
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[640px]">
          <LaptopMock src={srcs[0]} browser={browser} url={url ?? undefined} onClick={() => setOpen(true)} />
        </div>
      )}
      {open && <ScreenshotLightbox shots={srcs} frame={device} onClose={() => setOpen(false)} />}
    </div>
  );
};

export default MockupEmbed;
