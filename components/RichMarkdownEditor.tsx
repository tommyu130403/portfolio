"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FC,
  type ReactNode,
  type RefObject,
} from "react";
import { WorkMarkdownDocument } from "./WorkMarkdown";
import ProtectedImage from "./ProtectedImage";
import { buildImageMarkdown, widthToCss, type ImageAlign } from "@/lib/image-layout";
import { container, type DeviceMode } from "@/lib/design-tokens";

/**
 * Work 本文用のリッチ Markdown エディタ（リファレンス「リッチマークダウンエディタ実装」準拠）。
 *
 * - 生 Markdown の textarea ＋ ツールバー ＋ 編集 / 分割 / プレビュー の3モード
 * - プレビューは公開側と同一の共有レンダラ（WorkMarkdownDocument）で描画
 * - プレビューはデバイス幅切替に対応（Figma Device コレクション = design-tokens の container を参照）
 * - 画像・リンク・グリッド・表・カードは挿入ダイアログから、作品カード（`::: workcard`）は作品ピッカーから（画像は幅 / 配置 / 倍率 / キャプション指定）
 * - 分割表示では本文欄とプレビューのスクロール位置を割合で連動する
 * - 画像は本文欄への貼り付けでもアップロードできる（onUploadImage を渡した場合）。貼り付け画像は画像ダイアログ（配置・横幅・倍率）を経て挿入する
 *   貼り付け時は本文に仮の行（![画像をアップロード中…](uploading)）を置き、挿入時にその行を置き換える（キャンセル・失敗時は除去）。
 *   仮の行は挿入した断片（前後の改行を含む）をそのまま覚えて除去し、元の本文を正確に復元する。エディタが閉じられた時も除去する
 *   貼り付け処理は同時に1件だけ（処理中は画像ボタンと追加の貼り付けを止める）。クリップボードに表（text/html の <table）がある場合（表計算）は通常のテキスト貼り付けにし、それ以外で画像があればアップロードする
 *   アップロード前の圧縮は呼び出し側（WorkEditor）で行う
 */

export type RichMarkdownEditorProps = {
  value: string;
  onChange: (md: string) => void;
  placeholder?: string;
  /** ストレージから画像を選ぶ（resolve した URL を画像ダイアログに反映する） */
  onPickImage?: () => Promise<{ url: string; alt?: string } | null>;
  /** 本文欄に貼り付けられた画像をアップロードし、公開 URL（または失敗理由）を返す */
  onUploadImage?: (file: File) => Promise<{ url: string | null; error: string | null }>;
  /** 保存済みフローチャートを選び、参照ディレクティブとして挿入する */
  onPickFlowchart?: () => Promise<{
    id: string;
    title: string;
  } | null>;
  /** 公開中の他の作品を選び、作品カード（::: workcard）として挿入する */
  onPickWork?: () => Promise<{
    id: string;
    title: string;
  } | null>;
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

function TBtn({
  label,
  title,
  onClick,
  disabled,
}: {
  label: ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 shrink-0 items-center rounded-[6px] border border-border-light px-2 text-[11px] text-fg-muted transition-colors hover:border-system-700 hover:text-white disabled:opacity-40 disabled:hover:border-border-light disabled:hover:text-fg-muted"
    >
      {label}
    </button>
  );
}

function TSep() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border-light" />;
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
        className="w-full max-w-[480px] rounded-[12px] border border-border-light bg-[#1a1a1a] p-5"
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
  return <p className="mb-1.5 text-[12px] tracking-[0.6px] text-fg-muted">{children}</p>;
}

const dInput =
  "w-full rounded-[8px] border border-border-light bg-[#141414] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-primary";
const dBtnPrimary =
  "rounded-[8px] bg-primary px-4 py-1.5 text-[13px] font-semibold text-[#0a0a0a] hover:opacity-80 disabled:opacity-40";
const dBtnGhost =
  "rounded-[8px] border border-border-light px-3 py-1.5 text-[13px] text-fg-muted hover:border-system-700 hover:text-white";

/** 画像アップロード中の仮の行。本文に置き、挿入・キャンセル・失敗のいずれかで置き換え / 除去する */
export const UPLOAD_PLACEHOLDER = "![画像をアップロード中…](uploading)";

/** text の at 位置に、前後へ改行を補いつつ行として挿入する。挿入後のキャレット位置と、挿入した断片（改行込み）も返す */
function insertLineAt(current: string, line: string, at: number) {
  const start = Math.min(at, current.length);
  const before = current.slice(0, start);
  const after = current.slice(start);
  const prefix = before.length === 0 || before.endsWith("\n") ? "" : "\n";
  const suffix = after.startsWith("\n") || after.length === 0 ? "" : "\n";
  return {
    next: before + prefix + line + suffix + after,
    pos: before.length + prefix.length + line.length,
    segment: prefix + line + suffix,
  };
}

/** 挿入した断片 segment を最初の1件だけ除去して元の本文に戻す。見つからなければ仮の行だけを除去する */
function removeInserted(current: string, segment: string | null) {
  if (segment) {
    const idx = current.indexOf(segment);
    if (idx >= 0) return current.slice(0, idx) + current.slice(idx + segment.length);
  }
  return removePlaceholder(current);
}

/** 仮の行を最初の1件だけ除去する（直後の改行も含む）。無ければそのまま返す */
function removePlaceholder(current: string) {
  const idx = current.indexOf(UPLOAD_PLACEHOLDER);
  if (idx < 0) return current;
  let end = idx + UPLOAD_PLACEHOLDER.length;
  if (current[end] === "\n") end += 1;
  return current.slice(0, idx) + current.slice(end);
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/* ─── プレビューペイン（デバイス幅切替）────────────────── */

/**
 * デバイス実寸（Device コレクションの Screen.Width）でプレビューを描画する。
 * コンテンツは Main.Max で中央寄せし、ペインが実寸より狭い場合は縮小表示する。
 */
function PreviewPane({
  md,
  device,
  half,
  paneRef,
  onScroll,
}: {
  md: string;
  device: PreviewDevice;
  half: boolean;
  paneRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}) {
  const [paneW, setPaneW] = useState(0);

  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setPaneW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [paneRef]);

  const widthClass = half ? "w-1/2" : "w-full";

  if (device === "full") {
    return (
      <div ref={paneRef} onScroll={onScroll} className={`${widthClass} h-full min-h-[320px] overflow-auto bg-surface p-6`}>
        {/* 公開ページと同じ最大幅で表示 */}
        <div className="mx-auto max-w-main">
          <WorkMarkdownDocument md={md} />
        </div>
      </div>
    );
  }

  const screenW = container[device].width.screen;
  const mainMax = container[device].width.mainMax;
  const scale = paneW > 0 ? Math.min(1, (paneW - 24) / screenW) : 1;

  return (
    <div ref={paneRef} onScroll={onScroll} className={`${widthClass} h-full min-h-[320px] overflow-auto bg-[#141414] p-3`}>
      <p className="pb-2 text-center text-[11px] text-system-700">
        {screenW}px × {container[device].height.screen}px
        {scale < 1 && `（${Math.round(scale * 100)}% 縮小表示）`}
      </p>
      {/* デバイスフレーム（Screen.Width 実寸。ペイン幅に収まらない場合は zoom で縮小） */}
      <div
        style={{ width: screenW, zoom: scale }}
        className="mx-auto rounded-[8px] border border-[#2a2a2a] bg-surface py-8"
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
  onPickFlowchart,
  onPickWork,
  onUploadImage,
  className,
}) => {
  const [mode, setMode] = useState<Mode>("split");
  const [device, setDevice] = useState<PreviewDevice>("full");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [uploadStatus, setUploadStatus] = useState<null | { kind: "uploading" } | { kind: "error"; message: string }>(
    null
  );
  const previewRef = useRef<HTMLDivElement>(null);
  // 連動スクロールで直前に値を書き込んだ側。その scroll イベントでは折り返さない
  const syncLock = useRef<HTMLElement | null>(null);
  // 直近に確認したプレビューのスクロール可能量。変わっていたら高さの変化によるブラウザの位置切り詰めとみなす
  const previewMax = useRef<number | null>(null);
  const [dialog, setDialog] = useState<null | "link" | "image" | "grid" | "table" | "card">(null);
  const [linkLabel, setLinkLabel] = useState("");
  // リンクの挿入先。ダイアログ表示中に textarea の選択がブラウザ側で変わっても影響されないよう、ボタン押下時に記録する
  const [linkRange, setLinkRange] = useState({ start: 0, end: 0 });
  // 画像ダイアログの初期 URL と開いた経路。貼り付け経由は仮の行を置き換えて挿入する。key は開くたびに作り直して初期 URL を反映させる
  const [imageInitialUrl, setImageInitialUrl] = useState("");
  const [imageFromPaste, setImageFromPaste] = useState(false);
  const [imageKey, setImageKey] = useState(0);
  // 貼り付け画像の処理中（貼り付けからダイアログを閉じるまで）。ref は連続貼り付けの即時判定用、state はボタンの無効化用
  const [pasteBusy, setPasteBusyState] = useState(false);
  const pasteBusyRef = useRef(false);
  const setPasteBusy = (busy: boolean) => {
    pasteBusyRef.current = busy;
    setPasteBusyState(busy);
  };
  // 常に最新の本文。非同期処理（アップロード後）でも textarea なしで最新の本文を編集できるようにする
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  // 仮の行として本文に挿入した断片（前後の改行を含む）。取り消し時に元の本文へ正確に戻すために覚える
  const segmentRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const mountedRef = useRef(true);
  // 貼り付け処理中にエディタが閉じられた（タブ切替など）時は、仮の行を除去して非同期の続きを無効にする
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pasteBusyRef.current) {
        onChangeRef.current(removeInserted(valueRef.current, segmentRef.current));
        pasteBusyRef.current = false;
      }
    };
  }, []);
  /** 本文を更新する。再描画を待たず valueRef にも即時反映する（続けて編集しても取りこぼさない） */
  const commit = useCallback(
    (next: string) => {
      valueRef.current = next;
      onChange(next);
    },
    [onChange]
  );

  /** from のスクロール割合を to に写す（分割表示のみ）。写した側の scroll イベントで折り返さないようロックする */
  const syncScroll = useCallback(
    (from: HTMLElement | null, to: HTMLElement | null) => {
      if (mode !== "split" || !from || !to) return;
      if (syncLock.current === from) {
        syncLock.current = null;
        return;
      }
      const fromMax = from.scrollHeight - from.clientHeight;
      // プレビューの高さが変わった直後の scroll イベントはブラウザによる切り詰めなので本文欄へ写さない（ResizeObserver 側で合わせ直す）
      if (from === previewRef.current && fromMax !== previewMax.current) {
        previewMax.current = fromMax;
        return;
      }
      if (fromMax <= 0) return;
      const toMax = to.scrollHeight - to.clientHeight;
      const target = (from.scrollTop / fromMax) * toMax;
      if (Math.abs(to.scrollTop - target) < 1) return;
      const prev = to.scrollTop;
      syncLock.current = to;
      to.scrollTop = target;
      if (to.scrollTop === prev) syncLock.current = null; // 値が変わらず scroll イベントが来ない場合はロックを残さない
    },
    [mode]
  );

  // 分割表示への切替・デバイス幅の変更・画像の読み込みなどでプレビューの高さが変わった時は、
  // スクロールを待たずに本文欄の位置へプレビューを合わせ直す（observe 直後の初回通知で切替時の同期も兼ねる）
  useEffect(() => {
    const pv = previewRef.current;
    if (mode !== "split" || !pv) return;
    const ro = new ResizeObserver(() => {
      previewMax.current = pv.scrollHeight - pv.clientHeight;
      syncLock.current = null;
      syncScroll(taRef.current, pv);
    });
    ro.observe(pv);
    Array.from(pv.children).forEach((child) => ro.observe(child));
    return () => ro.disconnect();
  }, [mode, device, syncScroll]);

  /**
   * 挿入後にフォーカスと選択範囲を戻す。フォーカスでスクロールが端へ飛ばないよう位置を先に復元し、
   * その後の選択でキャレットが画面外にある場合だけブラウザに見える位置までスクロールさせる
   */
  const restoreCaret = useCallback(
    (ta: HTMLTextAreaElement, scrollTop: number, selStart: number, selEnd: number) => {
      ta.setSelectionRange(selStart, selEnd);
      ta.scrollTop = scrollTop;
      ta.blur();
      ta.focus();
    },
    []
  );

  /** 選択範囲を before/after で囲む（未選択時は placeholder を挿入して選択状態にする） */
  const insertAround = useCallback(
    (before: string, after = "", ph = "") => {
      const ta = taRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = value.slice(start, end) || ph;
      const next = value.slice(0, start) + before + selected + after + value.slice(end);
      const scrollTop = ta.scrollTop;
      onChange(next);
      requestAnimationFrame(() => {
        const pos = start + before.length;
        restoreCaret(ta, scrollTop, pos, pos + selected.length);
      });
    },
    [value, onChange, restoreCaret]
  );

  /** start〜end を text で置き換え、カーソルを挿入文字の直後へ置く */
  const replaceRange = useCallback(
    (text: string, { start, end }: { start: number; end: number }) => {
      const ta = taRef.current;
      if (!ta) return;
      const scrollTop = ta.scrollTop;
      onChange(value.slice(0, start) + text + value.slice(end));
      requestAnimationFrame(() => {
        const pos = start + text.length;
        restoreCaret(ta, scrollTop, pos, pos);
      });
    },
    [value, onChange, restoreCaret]
  );

  /** カーソル行の前後に改行を補いつつテキストを行として挿入する。挿入した断片（改行込み）を返す */
  const insertLine = useCallback(
    (text: string) => {
      const ta = taRef.current;
      if (!ta) return null;
      const { next, pos, segment } = insertLineAt(valueRef.current, text, ta.selectionStart);
      const scrollTop = ta.scrollTop;
      commit(next);
      requestAnimationFrame(() => restoreCaret(ta, scrollTop, pos, pos));
      return segment;
    },
    [commit, restoreCaret]
  );

  /** 貼り付け処理を終える（仮の行を除去して処理中を解除する）。挿入済みなら仮の行は既に無く、除去は何もしない */
  const finishPaste = () => {
    commit(removeInserted(valueRef.current, segmentRef.current));
    setPasteBusy(false);
    setDialog(null);
  };

  /** 貼り付けられた画像の仮の行を本文に置き、アップロードして画像ダイアログを開く */
  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!onUploadImage) return;
    // 表計算（Excel / Numbers）は表とプレビュー画像の両方を載せるため、表があれば通常のテキスト貼り付けに任せる
    if (/<table/i.test(e.clipboardData.getData("text/html"))) return;
    const fromFiles = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    const fromItems = Array.from(e.clipboardData.items)
      .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
      .map((it) => it.getAsFile())
      .find((f): f is File => f !== null);
    const file = fromFiles ?? fromItems;
    if (!file) return;
    e.preventDefault();
    if (pasteBusyRef.current) {
      setUploadStatus({ kind: "error", message: "前の画像の処理が終わってから貼り付けてください" });
      return;
    }
    setPasteBusy(true);
    segmentRef.current = insertLine(UPLOAD_PLACEHOLDER);
    setUploadStatus({ kind: "uploading" });
    try {
      const { url, error } = await onUploadImage(file);
      if (!mountedRef.current) return;
      if (error || !url) {
        commit(removeInserted(valueRef.current, segmentRef.current));
        setUploadStatus({ kind: "error", message: error ?? "URL を取得できませんでした" });
        setPasteBusy(false);
        return;
      }
      setUploadStatus(null);
      setImageFromPaste(true);
      setImageInitialUrl(url);
      setImageKey((k) => k + 1);
      setDialog("image");
    } catch (err) {
      if (!mountedRef.current) return;
      commit(removeInserted(valueRef.current, segmentRef.current));
      setUploadStatus({ kind: "error", message: err instanceof Error ? err.message : "不明なエラー" });
      setPasteBusy(false);
    }
  };

  /** 貼り付け経由の画像ダイアログで挿入する。仮の行を置き換え、無ければ末尾に追加する */
  const insertPastedImage = (md: string) => {
    const current = valueRef.current;
    const idx = current.indexOf(UPLOAD_PLACEHOLDER);
    if (idx >= 0) {
      commit(current.slice(0, idx) + md + current.slice(idx + UPLOAD_PLACEHOLDER.length));
    } else {
      commit(insertLineAt(current, md, current.length).next);
    }
  };

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-[8px] border border-border-light bg-[#1a1a1a] focus-within:border-primary ${className ?? ""}`}
    >
      {/* ツールバー */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border-light bg-[#141414] px-3 py-2">
        {/* プレビュー中は入力欄がなく挿入先がないため、挿入系ボタンは出さない */}
        {mode !== "preview" && (
          <>
          {/* 見出しは Library Headline（305:265）の 2 種のみ: type=01 = 見出01（#）/ type=02 = 見出02（###） */}
          <TBtn label="見出01" title="# 見出し01（Headline type=01・22px 白 + 右罫線・セクション区切り）" onClick={() => insertLine("# 見出し")} />
          <TBtn label="見出02" title="### 見出し02（Headline type=02・横線＋16px gray）" onClick={() => insertLine("### 見出し")} />
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
          <TBtn
            label="リンク"
            title="リンクを挿入"
            onClick={() => {
              const ta = taRef.current;
              const start = ta?.selectionStart ?? value.length;
              const end = ta?.selectionEnd ?? value.length;
              const selected = value.slice(start, end);
              // リンク記法は1行・角括弧なしでしか解釈されないため、該当する選択は置き換えず末尾への挿入にする
              if (/[\n\[\]]/.test(selected)) {
                setLinkRange({ start: end, end });
                setLinkLabel("");
              } else {
                setLinkRange({ start, end });
                setLinkLabel(selected);
              }
              setDialog("link");
            }}
          />
          <TBtn
            label="画像"
            title={pasteBusy ? "貼り付けた画像の処理が終わるまで使えません" : "画像を挿入（幅 / 配置 / 倍率 / キャプション）"}
            disabled={pasteBusy}
            onClick={() => {
              if (pasteBusyRef.current) return;
              setImageFromPaste(false);
              setImageInitialUrl("");
              setImageKey((k) => k + 1);
              setDialog("image");
            }}
          />
          <TBtn label="グリッド" title="複数カラムのグリッドを挿入" onClick={() => setDialog("grid")} />
          <TBtn label="表" title="表を挿入（項目-値 / グリッド）" onClick={() => setDialog("table")} />
          <TBtn label="カード" title="見出し＋本文のカードを挿入" onClick={() => setDialog("card")} />
          {onPickFlowchart && (
            <TBtn
              label="フローチャート"
              title="フローチャートを挿入"
              onClick={async () => {
                const picked = await onPickFlowchart();
                if (picked) {
                  insertLine(`::: flowchart id=${picked.id}`);
                }
              }}
            />
          )}
          {onPickWork && (
            <TBtn
              label="作品カード"
              title="他の作品へのリンクカードを挿入"
              onClick={async () => {
                const picked = await onPickWork();
                if (picked) {
                  insertLine(`::: workcard id=${picked.id}`);
                }
              }}
            />
          )}
          </>
        )}

        {/* デバイス幅切替（プレビュー表示時のみ。Device コレクション = container トークン参照） */}
        <div className="ml-auto flex items-center gap-2">
          {mode !== "edit" && (
            <div className="flex items-center gap-0.5 rounded-[8px] border border-border-light bg-[#1a1a1a] p-0.5">
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
                    device === key ? "bg-primary/10 text-primary" : "text-fg-muted hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* モード切替 */}
          <div className="flex items-center gap-0.5 rounded-[8px] border border-border-light bg-[#1a1a1a] p-0.5">
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
                  mode === m ? "bg-primary/10 text-primary" : "text-fg-muted hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {uploadStatus && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border-light bg-[#141414] px-3 py-1.5 text-[12px]">
          {uploadStatus.kind === "uploading" ? (
            <span className="text-fg-muted">画像をアップロード中…</span>
          ) : (
            <>
              <span className="text-danger-300">画像のアップロードに失敗しました: {uploadStatus.message}</span>
              <button
                type="button"
                title="閉じる"
                onClick={() => setUploadStatus(null)}
                className="text-[11px] text-fg-muted transition-colors hover:text-white"
              >
                ✕
              </button>
            </>
          )}
        </div>
      )}

      {/* 本体 */}
      <div className="flex min-h-0 flex-1">
        {(mode === "edit" || mode === "split") && (
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={handlePaste}
            onScroll={() => syncScroll(taRef.current, previewRef.current)}
            spellCheck={false}
            placeholder={placeholder ?? "Markdown で本文を入力..."}
            className={`${
              mode === "split" ? "w-1/2 border-r border-border-light" : "w-full"
            } h-full min-h-[320px] resize-none bg-[#141414] p-5 font-mono text-[13px] leading-[1.7] text-white/90 outline-none`}
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
          <PreviewPane
            md={value}
            device={device}
            half={mode === "split"}
            paneRef={previewRef}
            onScroll={() => syncScroll(previewRef.current, taRef.current)}
          />
        )}
      </div>

      {/* ダイアログ */}
      {dialog === "link" && <LinkDialog initialLabel={linkLabel} onClose={() => setDialog(null)} onInsert={(md) => replaceRange(md, linkRange)} />}
      {dialog === "image" && (
        <ImageDialog
          key={imageKey}
          initialUrl={imageInitialUrl}
          onClose={imageFromPaste ? finishPaste : () => setDialog(null)}
          onInsert={imageFromPaste ? insertPastedImage : (md) => insertLine(md)}
          onPickImage={onPickImage}
        />
      )}
      {dialog === "grid" && <GridDialog onClose={() => setDialog(null)} onInsert={(md) => insertLine(md)} />}
      {dialog === "table" && <TableDialog onClose={() => setDialog(null)} onInsert={(md) => insertLine(md)} />}
      {dialog === "card" && <CardDialog onClose={() => setDialog(null)} onInsert={(md) => insertLine(md)} />}
    </div>
  );
};

/* ─── リンクダイアログ ─────────────────────────────── */

function LinkDialog({
  initialLabel,
  onClose,
  onInsert,
}: {
  initialLabel: string;
  onClose: () => void;
  onInsert: (md: string) => void;
}) {
  const [label, setLabel] = useState(initialLabel);
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
  initialUrl = "",
  onClose,
  onInsert,
  onPickImage,
}: {
  initialUrl?: string;
  onClose: () => void;
  onInsert: (md: string) => void;
  onPickImage?: () => Promise<{ url: string; alt?: string } | null>;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [caption, setCaption] = useState("");
  const [align, setAlign] = useState<ImageAlign>("full");
  // 数値欄は入力途中で空にできるよう文字列の下書きを持つ。width / scale は最後に有効だった（範囲内の）値
  const [width, setWidth] = useState(200);
  const [widthDraft, setWidthDraft] = useState("200");
  const [scale, setScale] = useState(1);
  const [scaleDraft, setScaleDraft] = useState("1");

  /** 下書きを範囲内の数値に確定する。数値でなければ最後の有効値に戻す */
  const commitNumber = (
    draft: string,
    last: number,
    min: number,
    max: number,
    setValue: (n: number) => void,
    setDraft: (s: string) => void
  ) => {
    const n = draft.trim() === "" ? NaN : Number(draft);
    const v = Number.isFinite(n) ? clamp(n, min, max) : last;
    setValue(v);
    setDraft(String(v));
    return v;
  };
  const commitWidth = () => commitNumber(widthDraft, width, 120, 624, setWidth, setWidthDraft);
  const commitScale = () => commitNumber(scaleDraft, scale, 0.1, 3, setScale, setScaleDraft);

  const useWidth = align !== "full";
  const submit = () => {
    // blur を待たず、書き込む値は常に確定済み（範囲内）のものを使う
    const w = commitWidth();
    const sc = commitScale();
    onInsert(buildImageMarkdown(caption, url, { align, width: useWidth ? String(w) : "", scale: sc }));
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
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border-light text-fg-muted hover:text-white"
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
            <div className="flex items-center gap-1 text-[12px] text-fg-muted">
              <input
                type="number"
                min={120}
                max={624}
                step={10}
                value={widthDraft}
                onChange={(e) => {
                  setWidthDraft(e.target.value);
                  const n = e.target.value.trim() === "" ? NaN : Number(e.target.value);
                  if (Number.isFinite(n)) setWidth(clamp(n, 120, 624));
                }}
                onBlur={commitWidth}
                className={`${dInput} !w-[72px] !px-2 !py-1 text-right`}
              />
              px
            </div>
          </div>
          <input
            type="range"
            min={120}
            // 本文欄の最大幅（max-w-main 800px − 左見出し 160px − gap 16px）。これより広げても切り詰められるため
            max={624}
            step={10}
            value={width}
            onChange={(e) => {
              setWidth(Number(e.target.value));
              setWidthDraft(e.target.value);
            }}
            className="w-full accent-primary"
          />
        </div>
      )}
      <div>
        <div className="flex items-center justify-between">
          <DLabel>表示倍率（scale）</DLabel>
          <div className="flex items-center gap-1.5 text-[12px] text-fg-muted">
            ×
            <input
              type="number"
              min={0.1}
              max={3}
              step={0.05}
              value={scaleDraft}
              onChange={(e) => {
                setScaleDraft(e.target.value);
                const n = e.target.value.trim() === "" ? NaN : Number(e.target.value);
                if (Number.isFinite(n)) setScale(clamp(n, 0.1, 3));
              }}
              onBlur={commitScale}
              className={`${dInput} !w-[72px] !px-2 !py-1 text-right`}
            />
            <button
              type="button"
              disabled={scale === 1}
              onClick={() => {
                setScale(1);
                setScaleDraft("1");
              }}
              className={`rounded-[6px] border px-2.5 py-1 text-[11px] transition-colors ${
                scale === 1
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border-light text-fg-muted hover:text-white"
              }`}
            >
              等倍
            </button>
          </div>
        </div>
        <input
          type="range"
          min={0.1}
          max={3}
          step={0.05}
          value={scale}
          onChange={(e) => {
            setScale(Number(e.target.value));
            setScaleDraft(e.target.value);
          }}
          className="w-full accent-primary"
        />
      </div>
      {url && (
        <div className="rounded-[8px] border border-border-light bg-[#141414] p-2">
          <div
            className="mx-auto overflow-hidden rounded-[6px]"
            style={{ width: useWidth ? widthToCss(String(width)) : "100%", maxWidth: "100%" }}
          >
            <ProtectedImage
              src={url}
              alt={caption}
              className="block h-auto w-full"
              style={scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: "center" } : undefined}
            />
          </div>
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
          <span className="text-[12px] text-fg-muted">{cols}</span>
        </div>
        <input type="range" min={2} max={4} step={1} value={cols} onChange={(e) => setCols(Number(e.target.value))} className="w-full accent-primary" />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <DLabel>ギャップ</DLabel>
          <span className="text-[12px] text-fg-muted">{gap * 4}px</span>
        </div>
        <input type="range" min={0} max={10} step={1} value={gap} onChange={(e) => setGap(Number(e.target.value))} className="w-full accent-primary" />
      </div>
      <p className="text-[11px] text-fg-muted">カラム内で区切り線を引くときは *** を使います（--- はカラムの区切りになります）</p>
      <div
        className="grid rounded-[8px] border border-border-light bg-[#141414] p-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: `${gap * 4}px` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className="flex aspect-video items-center justify-center rounded border border-dashed border-border-light text-[11px] text-system-700"
          >
            {i + 1}
          </div>
        ))}
      </div>
    </DialogShell>
  );
}

/* ─── カードダイアログ ───────────────────────────── */

function CardDialog({ onClose, onInsert }: { onClose: () => void; onInsert: (md: string) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const submit = () => {
    // 見出しは1行に収める（改行が入るとカードの開始行が壊れるため）
    const head = title.replace(/\s+/g, " ").trim();
    onInsert(`\n::: card ${head}\n${body.trim() || "本文"}\n:::\n`);
    onClose();
  };
  return (
    <DialogShell
      title="カードを挿入"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={dBtnGhost} onClick={onClose}>キャンセル</button>
          <button type="button" className={dBtnPrimary} onClick={submit}>挿入</button>
        </>
      }
    >
      <div>
        <DLabel>見出し（任意）</DLabel>
        <input className={dInput} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="カードの見出し" />
      </div>
      <div>
        <DLabel>本文（Markdown）</DLabel>
        <textarea className={`${dInput} min-h-[120px] resize-y`} value={body} onChange={(e) => setBody(e.target.value)} placeholder="本文" />
      </div>
    </DialogShell>
  );
}

/* ─── 表ダイアログ ───────────────────────────── */

function TableDialog({ onClose, onInsert }: { onClose: () => void; onInsert: (md: string) => void }) {
  const [kind, setKind] = useState<"kv" | "grid">("kv");
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const submit = () => {
    if (kind === "kv") {
      onInsert(`\n${Array.from({ length: rows }, () => "| 期間 | 2023.04 – 2024.03 |").join("\n")}\n`);
    } else {
      const header = `| ${Array.from({ length: cols }, (_, i) => `見出し${i + 1}`).join(" | ")} |`;
      const sep = `| ${Array.from({ length: cols }, () => "---").join(" | ")} |`;
      const row = `| ${Array.from({ length: cols }, () => "内容").join(" | ")} |`;
      onInsert(`\n${[header, sep, ...Array.from({ length: rows }, () => row)].join("\n")}\n`);
    }
    onClose();
  };
  const kindBtn = (value: "kv" | "grid", label: string) => (
    <button
      type="button"
      className={kind === value ? dBtnPrimary : dBtnGhost}
      onClick={() => setKind(value)}
    >
      {label}
    </button>
  );
  return (
    <DialogShell
      title="表を挿入"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={dBtnGhost} onClick={onClose}>キャンセル</button>
          <button type="button" className={dBtnPrimary} onClick={submit}>挿入</button>
        </>
      }
    >
      <div>
        <DLabel>型</DLabel>
        <div className="mt-1 flex gap-2">
          {kindBtn("kv", "項目-値")}
          {kindBtn("grid", "グリッド")}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <DLabel>行数</DLabel>
          <span className="text-[12px] text-fg-muted">{rows}</span>
        </div>
        <input type="range" min={1} max={10} step={1} value={rows} onChange={(e) => setRows(Number(e.target.value))} className="w-full accent-primary" />
      </div>
      {kind === "grid" && (
        <div>
          <div className="flex items-center justify-between">
            <DLabel>列数</DLabel>
            <span className="text-[12px] text-fg-muted">{cols}</span>
          </div>
          <input type="range" min={2} max={6} step={1} value={cols} onChange={(e) => setCols(Number(e.target.value))} className="w-full accent-primary" />
        </div>
      )}
      <p className="text-[11px] text-fg-muted">
        {kind === "kv" ? "「| 項目 | 値 |」の行を並べます。" : "1 行目が見出し、2 行目の「---」が区切りです（行数は見出しを除く）。"}セル内の「|」は「\|」と書きます
      </p>
    </DialogShell>
  );
}

export default RichMarkdownEditor;
