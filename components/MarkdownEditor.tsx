"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  type ReactNode,
} from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import Icon from "./Icon";

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
          // 互換対象のみ有効化（heading は level 1,2 のみ）
          heading: { levels: [1, 2] },
          // 公開側 SectionBodyRenderer が解釈できない装飾マークは無効化
          bold: false,
          italic: false,
          strike: false,
          code: false,
          codeBlock: false,
          blockquote: false,
          horizontalRule: false,
          link: false,
          underline: false,
          // リストは既存データ（"- " / "1." 記法）の往復互換のため有効のまま。
          // SectionBodyRenderer はリストをリテラルテキストとして描画するため
          // 公開表示は不変。ツールバーには敢えてボタンを出さない（仕様準拠）。
          // bulletList / orderedList / listItem はデフォルト有効。
        }),
        Image.configure({ inline: false, allowBase64: false }),
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

    const isH1 = editor?.isActive("heading", { level: 1 }) ?? false;
    const isH2 = editor?.isActive("heading", { level: 2 }) ?? false;
    const isParagraph = editor?.isActive("paragraph") ?? false;

    return (
      <div className="overflow-hidden rounded-[8px] border border-[#424242] bg-[#1a1a1a] focus-within:border-[#48f4be]">
        {/* ツールバー（上部固定・互換対象に限定） */}
        <div className="flex items-center gap-1.5 border-b border-[#424242] bg-[#141414] px-3 py-2">
          <ToolbarButton
            label="見出し1"
            active={isH1}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 1 }).run()
            }
          >
            <Icon set="Edit" name="h1" tintColor="currentColor" className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="見出し2"
            active={isH2}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Icon set="Edit" name="h2" tintColor="currentColor" className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="段落"
            active={isParagraph}
            onClick={() => editor?.chain().focus().setParagraph().run()}
          >
            <Icon set="Edit" name="text" tintColor="currentColor" className="h-4 w-4" />
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-[#424242]" />
          <ToolbarButton label="画像を挿入" onClick={() => onRequestImage?.()}>
            <Icon set="Edit" name="add-pic" tintColor="currentColor" className="h-4 w-4" />
          </ToolbarButton>
          <p className="ml-auto text-[11px] text-[#3a3a3a]">
            H1 でセクション分割・H2 で小見出し
          </p>
        </div>

        {/* 本文 */}
        <EditorContent editor={editor} />

        {/* .ProseMirror のスタイリング（公開側プレビューとトーンを揃える） */}
        <style>{`
          .markdown-editor-prose.ProseMirror h1 {
            font-size: 24px;
            font-weight: 700;
            line-height: 1.5;
            letter-spacing: 1.2px;
            color: #ffffff;
            margin: 1.2em 0 0.5em;
          }
          .markdown-editor-prose.ProseMirror h1:first-child {
            margin-top: 0;
          }
          .markdown-editor-prose.ProseMirror h2 {
            font-size: 20px;
            font-weight: 700;
            line-height: 1.5;
            letter-spacing: 1px;
            color: #ffffff;
            margin: 1em 0 0.4em;
          }
          .markdown-editor-prose.ProseMirror p {
            font-size: 15px;
            line-height: 1.6;
            letter-spacing: 0.45px;
            color: rgba(255, 255, 255, 0.8);
            margin: 0.5em 0;
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
