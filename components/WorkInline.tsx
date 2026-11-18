import type { FC, ReactNode } from "react";
import React from "react";
import { parseImageAttrs, widthToCss } from "@/lib/image-layout";
import ProtectedImage from "./ProtectedImage";

/** 作品本文のインライン記法（画像 / リンク / `コード` / **太字** / *斜体* / 裸 URL）の描画。WorkMarkdown と図版ブロックが共有する */


const ExternalIcon: FC = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 12 12"
    fill="none"
    className="ml-0.5 inline-block shrink-0"
    aria-hidden
  >
    <path d="M4 2h6v6M10 2 4.5 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export function renderInlineLine(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const push = (n: ReactNode) =>
    nodes.push(<React.Fragment key={`${keyBase}-${key++}`}>{n}</React.Fragment>);

  while (i < text.length) {
    const rest = text.slice(i);

    // 画像（インライン）: ![alt](url){attrs}
    const img = rest.match(/^!\[([^\]]*)\]\(([^)\s]+)\)(\{[^}]*\})?/);
    if (img) {
      const layout = parseImageAttrs(img[3]?.slice(1, -1), img[2]);
      push(
        <ProtectedImage
          src={layout.base}
          alt={img[1]}
          style={{ width: widthToCss(layout.width), maxWidth: "100%" }}
          className="my-2 inline-block h-auto rounded-r16 align-top [aspect-ratio:auto_16/10]"
        />
      );
      i += img[0].length;
      continue;
    }

    // リンク: [text](url)
    const link = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/);
    if (link) {
      const external = /^https?:\/\//i.test(link[2]);
      push(
        <a
          href={link[2]}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="text-main-100 underline decoration-main-100-a50 underline-offset-4 transition-colors hover:decoration-main-100"
        >
          {link[1]}
          {external && <ExternalIcon />}
        </a>
      );
      i += link[0].length;
      continue;
    }

    // インラインコード
    const code = rest.match(/^`([^`]+)`/);
    if (code) {
      push(
        <code className="rounded bg-action-hover px-1.5 py-0.5 font-mono text-[13px] text-main-050">
          {code[1]}
        </code>
      );
      i += code[0].length;
      continue;
    }

    // 太字 / 斜体
    const bold = rest.match(/^\*\*([^*]+)\*\*/);
    if (bold) {
      push(<strong className="font-bold">{renderInlineLine(bold[1], `${keyBase}-b${key}`)}</strong>);
      i += bold[0].length;
      continue;
    }
    const italic = rest.match(/^\*([^*]+)\*/);
    if (italic) {
      push(<em className="italic">{renderInlineLine(italic[1], `${keyBase}-i${key}`)}</em>);
      i += italic[0].length;
      continue;
    }

    // 裸URL
    const url = rest.match(/^(https?:\/\/[^\s<]+)/);
    if (url) {
      push(
        <a
          href={url[1]}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-main-100 underline decoration-main-100-a50 underline-offset-4 hover:decoration-main-100"
        >
          {url[1]}
          <ExternalIcon />
        </a>
      );
      i += url[1].length;
      continue;
    }

    // プレーンテキスト（次の特殊トークンまで）
    let next = text.length;
    for (const s of ["![", "[", "`", "**", "*", "http"]) {
      const idx = text.indexOf(s, i + 1);
      if (idx !== -1 && idx < next) next = idx;
    }
    push(text.slice(i, next));
    i = next;
  }
  return nodes;
}

/** 複数行テキストを <br> 区切りでインライン描画する */
export function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  text.split("\n").forEach((line, li) => {
    if (li > 0) out.push(<br key={`${keyBase}-br${li}`} />);
    out.push(...renderInlineLine(line, `${keyBase}-l${li}`));
  });
  return out;
}
