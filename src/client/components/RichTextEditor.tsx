import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Markdown } from "@tiptap/markdown";
import { api } from "../services/api";
import { useToast } from "../hooks/useToast";
import {
  Bold,
  Code,
  FileCode2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { useI18n } from "../i18n";

type Props = {
  value: string;
  onChange(value: string): void;
  onError(message: string): void;
};
const slashActions = [
  { label: "Heading 2", command: "heading" },
  { label: "Quote", command: "quote" },
  { label: "Bullet list", command: "bullet" },
  { label: "Code block", command: "code" },
  { label: "Image", command: "image" },
] as const;
type SlashAction = (typeof slashActions)[number];

export default function RichTextEditor({ value, onChange, onError }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const imageInput = useRef<HTMLInputElement>(null);
  const lastOutput = useRef(value);
  const [uploading, setUploading] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Markdown.configure({ markedOptions: { gfm: true, breaks: false } }),
    ],
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "rich-text-surface",
        "aria-label": "Soạn nội dung bài viết",
      },
      handlePaste: (_view, event) => {
        const imageFile = [...(event.clipboardData?.files ?? [])].find((file) =>
          file.type.startsWith("image/"),
        );
        if (!imageFile) return false;
        event.preventDefault();
        void uploadFile(imageFile);
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      const markdown = current.getMarkdown();
      lastOutput.current = markdown;
      onChange(markdown);
      const { $from } = current.state.selection;
      setSlashOpen(
        $from.parent.type.name === "paragraph" &&
          $from.parent.textContent === "/",
      );
    },
  });

  useEffect(() => {
    if (!editor || value === lastOutput.current) return;
    if (editor.getMarkdown() !== value)
      editor.commands.setContent(value, {
        contentType: "markdown",
        emitUpdate: false,
      });
    lastOutput.current = value;
  }, [editor, value]);

  async function uploadFile(file: File) {
    if (!editor || uploading) return;
    setUploading(true);
    try {
      const media = await api.uploadImage(file);
      editor
        .chain()
        .focus()
        .setImage({ src: media.url, alt: file.name.replace(/\.[^.]+$/, "") })
        .run();
      toast("Image uploaded and inserted successfully.");
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Unable to upload inline image",
      );
    } finally {
      setUploading(false);
    }
  }
  function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void uploadFile(file);
    event.target.value = "";
  }
  function setLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous ?? "https://");
    if (url === null) return;
    if (!url.trim())
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url.trim() })
        .run();
  }
  function clearSlash() {
    if (!editor) return;
    const { from } = editor.state.selection;
    editor.commands.deleteRange({ from: Math.max(0, from - 1), to: from });
    setSlashOpen(false);
  }
  if (!editor)
    return (
      <div className="rich-editor-loading" role="status">
        {t("editor.loadingRich", "Loading rich editor…")}
      </div>
    );
  function runSlash(action: SlashAction) {
    clearSlash();
    if (action.command === "heading")
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    if (action.command === "quote")
      editor.chain().focus().toggleBlockquote().run();
    if (action.command === "bullet")
      editor.chain().focus().toggleBulletList().run();
    if (action.command === "code")
      editor.chain().focus().toggleCodeBlock().run();
    if (action.command === "image") imageInput.current?.click();
  }
  function richKeyDown(event: React.KeyboardEvent) {
    if (!slashOpen) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSlashIndex((value) => (value + 1) % slashActions.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSlashIndex(
        (value) => (value - 1 + slashActions.length) % slashActions.length,
      );
    }
    if (event.key === "Enter") {
      event.preventDefault();
      runSlash(slashActions[slashIndex]);
    }
    if (event.key === "Escape") setSlashOpen(false);
  }
  return (
    <div className="rich-editor" onKeyDown={richKeyDown}>
      <div
        className="rich-toolbar"
        role="toolbar"
        aria-label="Định dạng văn bản"
      >
        <label className="rich-heading">
          <span className="sr-only">Kiểu đoạn</span>
          <select
            className="app-native-select"
            aria-label="Kiểu đoạn"
            value={
              editor.isActive("heading", { level: 1 })
                ? "1"
                : editor.isActive("heading", { level: 2 })
                  ? "2"
                  : editor.isActive("heading", { level: 3 })
                    ? "3"
                    : "p"
            }
            onChange={(event) => {
              const level = event.target.value;
              if (level === "p") editor.chain().focus().setParagraph().run();
              else
                editor
                  .chain()
                  .focus()
                  .setHeading({ level: Number(level) as 1 | 2 | 3 })
                  .run();
            }}
          >
            <option value="p">{t("editor.paragraph", "Paragraph")}</option>
            <option value="1">{t("editor.heading1", "Heading 1")}</option>
            <option value="2">{t("editor.heading2", "Heading 2")}</option>
            <option value="3">{t("editor.heading3", "Heading 3")}</option>
          </select>
        </label>
        <button
          type="button"
          aria-label="Bold"
          aria-pressed={editor.isActive("bold")}
          className={editor.isActive("bold") ? "active" : ""}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Italic"
          aria-pressed={editor.isActive("italic")}
          className={editor.isActive("italic") ? "active" : ""}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Strikethrough"
          aria-pressed={editor.isActive("strike")}
          className={editor.isActive("strike") ? "active" : ""}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Blockquote"
          aria-pressed={editor.isActive("blockquote")}
          className={editor.isActive("blockquote") ? "active" : ""}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Bullet list"
          aria-pressed={editor.isActive("bulletList")}
          className={editor.isActive("bulletList") ? "active" : ""}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Numbered list"
          aria-pressed={editor.isActive("orderedList")}
          className={editor.isActive("orderedList") ? "active" : ""}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Insert link"
          aria-pressed={editor.isActive("link")}
          className={editor.isActive("link") ? "active" : ""}
          onClick={setLink}
        >
          <Link2 aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Inline code"
          aria-pressed={editor.isActive("code")}
          className={editor.isActive("code") ? "active" : ""}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Code block"
          aria-pressed={editor.isActive("codeBlock")}
          className={editor.isActive("codeBlock") ? "active" : ""}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <FileCode2 aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Horizontal rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Insert image"
          disabled={uploading}
          onClick={() => imageInput.current?.click()}
        >
          {uploading ? "…" : <ImagePlus aria-hidden="true" />}
        </button>
        <span className="rich-toolbar-spacer" />
        <button
          type="button"
          aria-label="Undo"
          disabled={!editor.can().chain().focus().undo().run()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Redo"
          disabled={!editor.can().chain().focus().redo().run()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 aria-hidden="true" />
        </button>
        <input
          ref={imageInput}
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp"
          onChange={uploadImage}
        />
      </div>
      <EditorContent editor={editor} />
      {slashOpen && (
        <div
          className="rich-slash-menu"
          role="listbox"
          aria-label="Insert block"
        >
          {slashActions.map((action, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === slashIndex}
              className={index === slashIndex ? "active" : ""}
              key={action.label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runSlash(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
