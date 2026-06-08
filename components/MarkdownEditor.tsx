"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  useEditor,
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type Editor,
  type NodeViewProps,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import Icon from "./Icon";
import {
  parseImageSrc,
  buildImageSrc,
  widthToCss,
  type ImageAlign,
} from "@/lib/image-layout";

/**
 * プロジェクト本文（projects.sections）編集用の WYSIWYG エディタ。
 *
 * 公開ページ側レンダラ `SectionBodyRenderer` が解釈できる記法
 * （H1 / H2 / 段落 / 画像）にのみ機能を限定し、後方互換を保つ。
 * 太字・リスト・リンク等の装飾はツールバーにもエディタにも出さない。
 *
 * Markdown 入出力は `tiptap-markdown` 経由で行い、保存形は
 * 親（SectionsEditor）が既存の `markdownToSections` / `sectionsToMarkdown`
 * で `projects.sections`(jsonb) に変換する。
 */

/**
 * tiptap-markdown は Editor['storage'] を型拡張しないため、安全にアクセスするヘルパー。
 *
 * `breaks: true` 設定により、段落内の改行（HardBreak）は CommonMark の
 * バックスラッシュ改行 `\\\n` として直列化される。公開側 `SectionBodyRenderer` は
 * 行を `<br>` 区切りで描画する独自フォーマットのため、この `\` を取り除いて
 * 既存データと同じ「シングル改行」に正規化し、往復変換の互換を保つ。
 */
function getMarkdownFromEditor(editor: Editor | null): string {
  if (!editor) return "";
  const storage = editor.storage as {
    markdown?: { getMarkdown: () => string };
  };
  const md = storage.markdown?.getMarkdown() ?? "";
  // HardBreak のバックスラッシュ改行 → シングル改行に正規化
  return md.replace(/\\\n/g, "\n");
}

export type MarkdownEditorHandle = {
  /** カーソル位置に画像を挿入する（既存 ImagePickerModal から呼ぶ） */
  insertImage: (src: string, alt?: string) => void;
  /** 現在の Markdown 文字列を取得する */
  getMarkdown: () => string;
};

export type MarkdownEditorProps = {
  /** Markdown 文字列（全セクション分の `# 見出し` + 本文） */
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  /** 画像挿入トリガ（既存 ImagePickerModal を開く） */
  onRequestImage?: () => void;
};

function ToolbarButton({
  onClick,
  active = false,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={[
        "flex h-8 w-8 items-center justify-center rounded-[6px] border transition-colors",
        active
          ? "border-[#48f4be] bg-[#48f4be]/10 text-[#48f4be]"
          : "border-[#424242] text-[#9e9e9e] hover:border-[#616161] hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function TextButton({
  onClick,
  active = false,
  label,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={[
        "flex h-8 items-center rounded-[6px] border px-2 text-[11px] transition-colors",
        active
          ? "border-[#48f4be] bg-[#48f4be]/10 text-[#48f4be]"
          : "border-[#424242] text-[#9e9e9e] hover:border-[#616161] hover:text-white",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

/**
 * 画像の NodeView。画像の下に常時レイアウト操作（配置/幅/倍率/キャプション）を表示する。
 * レイアウト属性は src のフラグメント（url#align=..&w=..&scale=..）に保存し markdown と往復させる。
 * caption は alt（`![caption](url)`）に保存する。
 */
function ImageNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const src = (node.attrs.src as string) ?? "";
  const caption = (node.attrs.alt as string) ?? "";
  const layout = parseImageSrc(src);

  const setLayout = (patch: Partial<{ align: ImageAlign; width: string; scale: number }>) => {
    updateAttributes({ src: buildImageSrc({ ...layout, ...patch }) });
  };
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const cssWidth = widthToCss(layout.width);
  const figStyle: CSSProperties = {
    width: layout.align === "full" ? "100%" : cssWidth ?? "50%",
    maxWidth: "100%",
    marginLeft: layout.align === "right" ? "auto" : undefined,
    marginRight: layout.align === "left" ? "auto" : undefined,
  };

  const inputCls =
    "rounded border border-[#424242] bg-[#1a1a1a] px-1.5 py-0.5 text-[11px] text-white outline-none focus:border-[#48f4be]";

  return (
    <NodeViewWrapper
      className="markdown-image-nodeview"
      data-align={layout.align}
      style={{ margin: "0.6em 0" }}
    >
      <figure
        style={figStyle}
        className={selected ? "rounded-[8px] outline outline-2 outline-[#48f4be]" : "rounded-[8px]"}
      >
        <div style={{ overflow: "hidden", borderRadius: 8 }}>
          {layout.base ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={layout.base}
              alt={caption}
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                transform: layout.scale !== 1 ? `scale(${layout.scale})` : undefined,
                transformOrigin: "center",
              }}
            />
          ) : (
            <div className="flex h-24 items-center justify-center bg-[#0a0a0a] text-[12px] text-[#616161]">
              画像URL未設定
            </div>
          )}
        </div>
        {caption && <figcaption className="mt-1 text-[10px] text-[#9e9e9e]">{caption}</figcaption>}
      </figure>

      {/* レイアウト操作（contentEditable 外。ProseMirror の選択/入力を妨げないよう stopPropagation） */}
      <div
        contentEditable={false}
        onMouseDown={stop}
        className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-[8px] border border-[#424242] bg-[#141414] p-1.5"
      >
        {(["full", "left", "right"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onMouseDown={stop}
            onClick={() => setLayout({ align: a })}
            className={`rounded-[6px] border px-2 py-0.5 text-[11px] transition-colors ${
              layout.align === a
                ? "border-[#48f4be] bg-[#48f4be]/10 text-[#48f4be]"
                : "border-[#424242] text-[#9e9e9e] hover:text-white"
            }`}
          >
            {a === "full" ? "全幅" : a === "left" ? "左回り込み" : "右回り込み"}
          </button>
        ))}
        <span className="mx-0.5 h-4 w-px bg-[#424242]" />
        <label className="flex items-center gap-1 text-[11px] text-[#9e9e9e]">
          幅
          <input
            value={layout.width}
            onMouseDown={stop}
            onChange={(e) => setLayout({ width: e.target.value })}
            placeholder="260 / 60%"
            className={`w-20 ${inputCls}`}
          />
        </label>
        <label className="flex items-center gap-1 text-[11px] text-[#9e9e9e]">
          倍率
          <input
            value={String(layout.scale)}
            onMouseDown={stop}
            onChange={(e) => setLayout({ scale: Number(e.target.value) || 1 })}
            className={`w-12 ${inputCls}`}
          />
        </label>
        <label className="flex items-center gap-1 text-[11px] text-[#9e9e9e]">
          キャプション
          <input
            value={caption}
            onMouseDown={stop}
            onChange={(e) => updateAttributes({ alt: e.target.value })}
            placeholder="図1: …"
            className={`w-32 ${inputCls}`}
          />
        </label>
      </div>
    </NodeViewWrapper>
  );
}

/** Image 拡張に NodeView を付与（レイアウト操作UI付き） */
const LayoutImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    { value, onChange, placeholder, onRequestImage },
    ref,
  ) {
    const editor = useEditor({
      // App Router の SSR ハイドレーション不整合を避けるため必須
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          // 見出し level 1-4（# セクション / ## 見出01 / ### 見出02 / #### 見出03）
          // ＋ level 5 を「小本文 Body02(13px)」として流用（markdown ##### / UI「小本文」ボタン）
          heading: { levels: [1, 2, 3, 4, 5] },
          // 公開側 MarkdownBody が解釈できない装飾マークは無効化
          bold: false,
          italic: false,
          strike: false,
          code: false,
          codeBlock: false,
          // blockquote（> ）は「引用」として描画（テキスト色 system-400）
          horizontalRule: false,
          link: false,
          underline: false,
          // リストは既存データ（"- " / "1." 記法）の往復互換のため有効のまま。
          // SectionBodyRenderer はリストをリテラルテキストとして描画するため
          // 公開表示は不変。ツールバーには敢えてボタンを出さない（仕様準拠）。
          // bulletList / orderedList / listItem はデフォルト有効。
        }),
        LayoutImage.configure({ inline: false, allowBase64: false }),
        Placeholder.configure({
          placeholder:
            placeholder ??
            "# プロジェクト概要\n\n本文テキストをここに入力します。",
        }),
        Markdown.configure({
          html: false,
          tightLists: true,
          breaks: true,
          // bullet マーカーを "-" に固定（既存データと一致させ往復差分を防ぐ）
          bulletListMarker: "-",
          transformPastedText: true,
          transformCopiedText: true,
        }),
      ],
      content: value,
      onUpdate: ({ editor }) => {
        onChange(getMarkdownFromEditor(editor as Editor));
      },
      editorProps: {
        attributes: {
          class:
            "markdown-editor-prose min-h-[260px] w-full px-4 py-3 text-[15px] leading-[1.6] text-white/90 outline-none",
        },
      },
    });

    useImperativeHandle(
      ref,
      () => ({
        insertImage: (src: string, alt = "") => {
          editor?.chain().focus().setImage({ src, alt }).run();
        },
        getMarkdown: () => getMarkdownFromEditor(editor),
      }),
      [editor],
    );

    // 外部 value 変更時のみ同期（現在値と一致する場合は再セットしない＝カーソル飛び防止）
    useEffect(() => {
      if (!editor) return;
      const current = getMarkdownFromEditor(editor);
      if (current !== value) {
        editor.commands.setContent(value, { emitUpdate: false });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, editor]);

    const headingButtons: { label: string; level: 1 | 2 | 3 | 4 }[] = [
      { label: "セクション", level: 1 },
      { label: "見出01", level: 2 },
      { label: "見出02", level: 3 },
      { label: "見出03", level: 4 },
    ];
    const isParagraph = editor?.isActive("paragraph") ?? false;
    const isQuote = editor?.isActive("blockquote") ?? false;

    return (
      <div className="overflow-hidden rounded-[8px] border border-[#424242] bg-[#1a1a1a] focus-within:border-[#48f4be]">
        {/* ツールバー（タイポ体系：# セクション / ##〜#### 見出01-03 / > 小本文） */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[#424242] bg-[#141414] px-3 py-2">
          {headingButtons.map((b) => {
            const active = editor?.isActive("heading", { level: b.level }) ?? false;
            return (
              <TextButton
                key={b.level}
                label={b.label}
                active={active}
                onClick={() => editor?.chain().focus().toggleHeading({ level: b.level }).run()}
              />
            );
          })}
          <TextButton
            label="小本文"
            active={editor?.isActive("heading", { level: 5 }) ?? false}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 5 }).run()}
          />
          <TextButton
            label="引用"
            active={isQuote}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          />
          <TextButton
            label="段落"
            active={isParagraph}
            onClick={() => editor?.chain().focus().setParagraph().run()}
          />
          {onRequestImage && (
            <>
              <span className="mx-1 h-5 w-px bg-[#424242]" />
              <ToolbarButton label="画像を挿入" onClick={() => onRequestImage()}>
                <Icon set="Edit" name="add-pic" tintColor="currentColor" className="h-4 w-4" />
              </ToolbarButton>
            </>
          )}
          <p className="ml-auto text-[11px] text-[#3a3a3a]">
            # セクション ／ ##〜#### 見出01-03 ／ 小本文 ／ 引用
          </p>
        </div>

        {/* 本文 */}
        <EditorContent editor={editor} />

        {/* .ProseMirror のスタイリング（公開側プレビューとトーンを揃える） */}
        <style>{`
          /* h1=セクション(34 Avenir) / h2=見出01(24白) / h3=見出02(20mint) / h4=見出03(17gray) */
          .markdown-editor-prose.ProseMirror h1 {
            font-size: 34px;
            font-weight: 800;
            line-height: 1.2;
            color: #ffffff;
            margin: 1.2em 0 0.5em;
          }
          .markdown-editor-prose.ProseMirror h1:first-child {
            margin-top: 0;
          }
          .markdown-editor-prose.ProseMirror h2 {
            font-size: 24px;
            font-weight: 700;
            line-height: 1.5;
            letter-spacing: 1.2px;
            color: #ffffff;
            margin: 1em 0 0.4em;
          }
          .markdown-editor-prose.ProseMirror h3 {
            font-size: 20px;
            font-weight: 700;
            line-height: 1.5;
            letter-spacing: 1px;
            color: #b3ffe7;
            margin: 1em 0 0.4em;
          }
          .markdown-editor-prose.ProseMirror h4 {
            font-size: 17px;
            font-weight: 800;
            line-height: 1.3;
            letter-spacing: 0.85px;
            color: #9e9e9e;
            margin: 1em 0 0.4em;
          }
          /* h5 = 小本文 Body02(13px 白) */
          .markdown-editor-prose.ProseMirror h5 {
            font-size: 13px;
            font-weight: 400;
            line-height: 1.5;
            letter-spacing: 0.39px;
            color: rgba(255, 255, 255, 0.9);
            margin: 0.5em 0;
          }
          .markdown-editor-prose.ProseMirror p {
            font-size: 15px;
            line-height: 1.6;
            letter-spacing: 0.45px;
            color: rgba(255, 255, 255, 0.8);
            margin: 0.5em 0;
          }
          /* blockquote = 引用（テキスト色 system-400 #BDBDBD） */
          .markdown-editor-prose.ProseMirror blockquote {
            border-left: 2px solid #424242;
            padding-left: 0.8em;
            margin: 0.5em 0;
          }
          .markdown-editor-prose.ProseMirror blockquote p {
            font-size: 13px;
            letter-spacing: 0.39px;
            color: #bdbdbd;
          }
          .markdown-editor-prose.ProseMirror ul,
          .markdown-editor-prose.ProseMirror ol {
            padding-left: 1.4em;
            margin: 0.5em 0;
            color: rgba(255, 255, 255, 0.8);
            font-size: 15px;
            line-height: 1.6;
          }
          .markdown-editor-prose.ProseMirror ul { list-style: disc; }
          .markdown-editor-prose.ProseMirror ol { list-style: decimal; }
          .markdown-editor-prose.ProseMirror li { margin: 0.15em 0; }
          .markdown-editor-prose.ProseMirror li > p { margin: 0; }
          .markdown-editor-prose.ProseMirror img {
            max-width: 100%;
            border-radius: 8px;
            margin: 0.5em 0;
            display: block;
          }
          .markdown-editor-prose.ProseMirror img.ProseMirror-selectednode {
            outline: 2px solid #48f4be;
          }
          .markdown-editor-prose.ProseMirror p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            height: 0;
            pointer-events: none;
            color: #3a3a3a;
            white-space: pre-line;
          }
        `}</style>
      </div>
    );
  },
);

export default MarkdownEditor;
