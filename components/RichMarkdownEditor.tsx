"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { WorkMarkdownDocument } from "./WorkMarkdown";
import { buildImageMarkdown, widthToCss, type ImageAlign } from "@/lib/image-layout";
import { container, type DeviceMode } from "@/lib/design-tokens";

/**
 * Work 本文用のリッチ Markdown エディタ（リファレンス「リッチマークダウンエディタ実装」準拠）。
 *
 * - 生 Markdown の textarea ＋ ツールバー ＋ 編集 / 分割 / プレビュー の3モード
 * - プレビューは公開側と同一の共有レンダラ（WorkMarkdownDocument）で描画
 * - プレビューはデバイス幅切替に対応（Figma Device コレクション = design-tokens の container を参照）
 * - 画像・リンク・グリッドは挿入ダイアログから（画像は幅 / 配置 / 倍率 / キャプション指定）
 */

export type RichMarkdownEditorProps = {
  value: string;
  onChange: (md: string) => void;
  placeholder?: string;
  /** ストレージから画像を選ぶ（resolve した URL を画像ダイアログに反映する） */
  onPickImage?: () => Promise<{ url: string; alt?: string } | null>;
  /** ルート要素の追加クラス（高さは親から指定する） */
  className?: string;
};

type Mode = "edit" | "split" | "preview";

/** プレビューのデバイス幅。"full" はペイン幅いっぱい（実寸指定なし） */
type PreviewDevice = "full" | DeviceMode;

const DEVICE_OPTIONS: { key: PreviewDevice; label: string }[] = [
  { key: "full", label: "フル" },
  { key: "desktop", label: "Desktop" },
  { key: "tablet", label: "Tablet" },
  { key: "mobile", label: "Mobile" },
];

/* ─── 小物 UI ─────────────────────────────────────── */

function TBtn({ label, title, onClick }: { label: ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-8 shrink-0 items-center rounded-[6px] border border-[#424242] px-2 text-[11px] text-[#9e9e9e] transition-colors hover:border-[#616161] hover:text-white"
    >
      {label}
    </button>
  );
}

function TSep() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-[#424242]" />;
}

function DialogShell({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-[12px] border border-[#424242] bg-[#1a1a1a] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 text-[14px] font-semibold text-white">{title}</p>
        <div className="flex flex-col gap-4">{children}</div>
        <div className="mt-5 flex items-center justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

function DLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[12px] tracking-[0.6px] text-[#9e9e9e]">{children}</p>;
}

const dInput =
  "w-full rounded-[8px] border border-[#424242] bg-[#141414] px-3 py-2 text-[13px] text-white placeholder-[#616161] outline-none transition-colors focus:border-[#48f4be]";
const dBtnPrimary =
  "rounded-[8px] bg-[#48f4be] px-4 py-1.5 text-[13px] font-semibold text-[#0a0a0a] hover:opacity-80 disabled:opacity-40";
const dBtnGhost =
  "rounded-[8px] border border-[#424242] px-3 py-1.5 text-[13px] text-[#9e9e9e] hover:border-[#616161] hover:text-white";

/* ─── プレビューペイン（デバイス幅切替）────────────────── */

/**
 * デバイス実寸（Device コレクションの Screen.Width）でプレビューを描画する。
 * コンテンツは Main.Max で中央寄せし、ペインが実寸より狭い場合は縮小表示する。
 */
function PreviewPane({ md, device, half }: { md: string; device: PreviewDevice; half: boolean }) {
  const paneRef = useRef<HTMLDivElement>(null);
  const [paneW, setPaneW] = useState(0);

  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setPaneW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const widthClass = half ? "w-1/2" : "w-full";

  if (device === "full") {
    return (
      <div ref={paneRef} className={`${widthClass} h-full min-h-[320px] overflow-auto bg-[#212121] p-6`}>
        <WorkMarkdownDocument md={md} />
      </div>
    );
  }

  const screenW = container[device].width.screen;
  const mainMax = container[device].width.mainMax;
  const scale = paneW > 0 ? Math.min(1, (paneW - 24) / screenW) : 1;

  return (
    <div ref={paneRef} className={`${widthClass} h-full min-h-[320px] overflow-auto bg-[#141414] p-3`}>
      <p className="pb-2 text-center text-[11px] text-[#616161]">
        {screenW}px × {container[device].height.screen}px
        {scale < 1 && `（${Math.round(scale * 100)}% 縮小表示）`}
      </p>
      {/* デバイスフレーム（Screen.Width 実寸。ペイン幅に収まらない場合は zoom で縮小） */}
      <div
        style={{ width: screenW, zoom: scale }}
        className="mx-auto rounded-[8px] border border-[#2a2a2a] bg-[#212121] py-8"
      >
        {/* メインコンテンツ幅（Main.Max）で中央寄せ */}
        <div style={{ maxWidth: mainMax }} className="mx-auto px-6">
          <WorkMarkdownDocument md={md} />
        </div>
      </div>
    </div>
  );
}

/* ─── 本体 ─────────────────────────────────────────── */

const RichMarkdownEditor: FC<RichMarkdownEditorProps> = ({
  value,
  onChange,
  placeholder,
  onPickImage,
  className,
}) => {
  const [mode, setMode] = useState<Mode>("split");
  const [device, setDevice] = useState<PreviewDevice>("full");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [dialog, setDialog] = useState<null | "link" | "image" | "grid">(null);

  /** 選択範囲を before/after で囲む（未選択時は placeholder を挿入して選択状態にする） */
  const insertAround = useCallback(
    (before: string, after = "", ph = "") => {
      const ta = taRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = value.slice(start, end) || ph;
      const next = value.slice(0, start) + before + selected + after + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + before.length;
        ta.setSelectionRange(pos, pos + selected.length);
      });
    },
    [value, onChange]
  );

  /** カーソル行の前後に改行を補いつつテキストを行として挿入する */
  const insertLine = useCallback(
    (text: string) => {
      const ta = taRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const before = value.slice(0, start);
      const after = value.slice(start);
      const prefix = before.length === 0 || before.endsWith("\n") ? "" : "\n";
      const suffix = after.startsWith("\n") || after.length === 0 ? "" : "\n";
      onChange(before + prefix + text + suffix + after);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = before.length + prefix.length + text.length;
        ta.setSelectionRange(pos, pos);
      });
    },
    [value, onChange]
  );

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-[8px] border border-[#424242] bg-[#1a1a1a] focus-within:border-[#48f4be] ${className ?? ""}`}
    >
      {/* ツールバー */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[#424242] bg-[#141414] px-3 py-2">
        <TBtn label="セクション" title="# セクション見出し（34px）" onClick={() => insertLine("# セクション見出し")} />
        <TBtn label="見出01" title="## 見出し01（24px 白）" onClick={() => insertLine("## 見出し")} />
        <TBtn label="見出02" title="### 見出し02（20px mint）" onClick={() => insertLine("### 見出し")} />
        <TBtn label="見出03" title="#### 見出し03（17px gray）" onClick={() => insertLine("#### 見出し")} />
        <TBtn label="小本文" title="##### 小本文（13px）" onClick={() => insertLine("##### 小本文")} />
        <TSep />
        <TBtn label={<strong>B</strong>} title="太字 (Ctrl+B)" onClick={() => insertAround("**", "**", "太字")} />
        <TBtn label={<em>I</em>} title="斜体 (Ctrl+I)" onClick={() => insertAround("*", "*", "斜体")} />
        <TBtn label={<s>S</s>} title="取り消し線" onClick={() => insertAround("~~", "~~", "取消")} />
        <TBtn label={<code className="text-[10px]">{"</>"}</code>} title="インラインコード" onClick={() => insertAround("`", "`", "code")} />
        <TSep />
        <TBtn label="・リスト" title="箇条書き" onClick={() => insertLine("- 項目")} />
        <TBtn label="1. リスト" title="番号付きリスト" onClick={() => insertLine("1. 項目")} />
        <TBtn label="引用" title="> 引用（13px system-400）" onClick={() => insertLine("> 引用文")} />
        <TBtn label="――" title="区切り線" onClick={() => insertLine("---")} />
        <TSep />
        <TBtn label="リンク" title="リンクを挿入" onClick={() => setDialog("link")} />
        <TBtn label="画像" title="画像を挿入（幅 / 配置 / 倍率 / キャプション）" onClick={() => setDialog("image")} />
        <TBtn label="グリッド" title="複数カラムのグリッドを挿入" onClick={() => setDialog("grid")} />

        {/* デバイス幅切替（プレビュー表示時のみ。Device コレクション = container トークン参照） */}
        <div className="ml-auto flex items-center gap-2">
          {mode !== "edit" && (
            <div className="flex items-center gap-0.5 rounded-[8px] border border-[#424242] bg-[#1a1a1a] p-0.5">
              {DEVICE_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  title={
                    key === "full"
                      ? "ペイン幅いっぱいで表示"
                      : `${container[key].width.screen}px（Device/${label} Screen.Width）`
                  }
                  onClick={() => setDevice(key)}
                  className={`rounded-[6px] px-2.5 py-1 text-[11px] transition-colors ${
                    device === key ? "bg-[#48f4be]/10 text-[#48f4be]" : "text-[#9e9e9e] hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* モード切替 */}
          <div className="flex items-center gap-0.5 rounded-[8px] border border-[#424242] bg-[#1a1a1a] p-0.5">
            {(
              [
                ["edit", "編集"],
                ["split", "分割"],
                ["preview", "プレビュー"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-[6px] px-2.5 py-1 text-[11px] transition-colors ${
                  mode === m ? "bg-[#48f4be]/10 text-[#48f4be]" : "text-[#9e9e9e] hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 本体 */}
      <div className="flex min-h-0 flex-1">
        {(mode === "edit" || mode === "split") && (
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            placeholder={placeholder ?? "# セクション見出し\n\n本文テキストをここに入力..."}
            className={`${
              mode === "split" ? "w-1/2 border-r border-[#424242]" : "w-full"
            } h-full min-h-[320px] resize-none bg-[#141414] p-5 font-mono text-[13px] leading-[1.7] text-white/90 outline-none placeholder-[#3a3a3a]`}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
                e.preventDefault();
                insertAround("**", "**", "太字");
              }
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
                e.preventDefault();
                insertAround("*", "*", "斜体");
              }
            }}
          />
        )}
        {(mode === "preview" || mode === "split") && (
          <PreviewPane md={value} device={device} half={mode === "split"} />
        )}
      </div>

      {/* ダイアログ */}
      {dialog === "link" && <LinkDialog onClose={() => setDialog(null)} onInsert={(md) => insertAround(md)} />}
      {dialog === "image" && (
        <ImageDialog onClose={() => setDialog(null)} onInsert={(md) => insertLine(md)} onPickImage={onPickImage} />
      )}
      {dialog === "grid" && <GridDialog onClose={() => setDialog(null)} onInsert={(md) => insertLine(md)} />}
    </div>
  );
};

/* ─── リンクダイアログ ─────────────────────────────── */

function LinkDialog({ onClose, onInsert }: { onClose: () => void; onInsert: (md: string) => void }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("https://");
  const submit = () => {
    onInsert(`[${label || url}](${url})`);
    onClose();
  };
  return (
    <DialogShell
      title="リンクを挿入"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={dBtnGhost} onClick={onClose}>キャンセル</button>
          <button type="button" className={dBtnPrimary} onClick={submit} disabled={!url}>挿入</button>
        </>
      }
    >
      <div>
        <DLabel>表示テキスト</DLabel>
        <input className={dInput} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="リンクのテキスト" />
      </div>
      <div>
        <DLabel>URL（外部リンクはアイコン付きで表示されます）</DLabel>
        <input className={dInput} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
      </div>
    </DialogShell>
  );
}

/* ─── 画像ダイアログ ───────────────────────────────── */

function ImageDialog({
  onClose,
  onInsert,
  onPickImage,
}: {
  onClose: () => void;
  onInsert: (md: string) => void;
  onPickImage?: () => Promise<{ url: string; alt?: string } | null>;
}) {
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [align, setAlign] = useState<ImageAlign>("full");
  const [width, setWidth] = useState(320);
  const [scale, setScale] = useState(1);

  const useWidth = align !== "full";
  const submit = () => {
    onInsert(buildImageMarkdown(caption, url, { align, width: useWidth ? String(width) : "", scale }));
    onClose();
  };

  return (
    <DialogShell
      title="画像を挿入"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={dBtnGhost} onClick={onClose}>キャンセル</button>
          <button type="button" className={dBtnPrimary} onClick={submit} disabled={!url}>挿入</button>
        </>
      }
    >
      <div>
        <DLabel>画像 URL</DLabel>
        <div className="flex items-center gap-2">
          <input className={dInput} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          {onPickImage && (
            <button
              type="button"
              className={`${dBtnGhost} shrink-0 whitespace-nowrap`}
              onClick={async () => {
                const picked = await onPickImage();
                if (picked) {
                  setUrl(picked.url);
                  if (picked.alt && !caption) setCaption(picked.alt);
                }
              }}
            >
              📁 選択
            </button>
          )}
        </div>
      </div>
      <div>
        <DLabel>キャプション（10px・任意）</DLabel>
        <input className={dInput} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="図1: …" />
      </div>
      <div>
        <DLabel>配置</DLabel>
        <div className="flex items-center gap-1.5">
          {(
            [
              ["full", "全幅"],
              ["left", "左回り込み"],
              ["right", "右回り込み"],
              ["center", "中央"],
            ] as const
          ).map(([a, label]) => (
            <button
              key={a}
              type="button"
              onClick={() => setAlign(a)}
              className={`rounded-[6px] border px-2.5 py-1 text-[11px] transition-colors ${
                align === a
                  ? "border-[#48f4be] bg-[#48f4be]/10 text-[#48f4be]"
                  : "border-[#424242] text-[#9e9e9e] hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {useWidth && (
        <div>
          <div className="flex items-center justify-between">
            <DLabel>横幅</DLabel>
            <span className="text-[12px] text-[#9e9e9e]">{width}px</span>
          </div>
          <input
            type="range"
            min={120}
            max={864}
            step={10}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="w-full accent-[#48f4be]"
          />
        </div>
      )}
      <div>
        <div className="flex items-center justify-between">
          <DLabel>表示倍率（scale）</DLabel>
          <span className="text-[12px] text-[#9e9e9e]">×{scale}</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
          className="w-full accent-[#48f4be]"
        />
      </div>
      {url && (
        <div className="rounded-[8px] border border-[#424242] bg-[#141414] p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={caption}
            style={{ width: useWidth ? widthToCss(String(width)) : "100%", maxWidth: "100%" }}
            className="mx-auto rounded-[6px]"
          />
        </div>
      )}
    </DialogShell>
  );
}

/* ─── グリッドダイアログ ───────────────────────────── */

function GridDialog({ onClose, onInsert }: { onClose: () => void; onInsert: (md: string) => void }) {
  const [cols, setCols] = useState(2);
  const [gap, setGap] = useState(4);
  const submit = () => {
    const cells = Array.from({ length: cols }, (_, i) => `カラム ${i + 1} の内容`).join("\n---\n");
    onInsert(`::: grid cols=${cols} gap=${gap}\n${cells}\n:::`);
    onClose();
  };
  return (
    <DialogShell
      title="グリッドレイアウトを挿入"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={dBtnGhost} onClick={onClose}>キャンセル</button>
          <button type="button" className={dBtnPrimary} onClick={submit}>挿入</button>
        </>
      }
    >
      <div>
        <div className="flex items-center justify-between">
          <DLabel>カラム数</DLabel>
          <span className="text-[12px] text-[#9e9e9e]">{cols}</span>
        </div>
        <input type="range" min={2} max={4} step={1} value={cols} onChange={(e) => setCols(Number(e.target.value))} className="w-full accent-[#48f4be]" />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <DLabel>ギャップ</DLabel>
          <span className="text-[12px] text-[#9e9e9e]">{gap * 4}px</span>
        </div>
        <input type="range" min={0} max={10} step={1} value={gap} onChange={(e) => setGap(Number(e.target.value))} className="w-full accent-[#48f4be]" />
      </div>
      <div
        className="grid rounded-[8px] border border-[#424242] bg-[#141414] p-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: `${gap * 4}px` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className="flex aspect-video items-center justify-center rounded border border-dashed border-[#424242] text-[11px] text-[#616161]"
          >
            {i + 1}
          </div>
        ))}
      </div>
    </DialogShell>
  );
}

export default RichMarkdownEditor;
