"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect, useState } from "react";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Quote,
  Code as CodeIcon,
  Undo,
  Redo,
} from "lucide-react";

/**
 * Rich-text editor for the bulletin composer. TipTap (ProseMirror under
 * the hood) bound to a hidden <input> so the parent form submits HTML
 * as the `body` field. Toolbar covers the bulletin author's needs:
 * bold, italic, H2/H3, lists, link, blockquote, inline code, undo/redo.
 *
 * Initial content is HTML (from the seed helper or a persisted body).
 * Saves HTML on every edit. Sanitization happens at *render* time
 * (`BulletinBody`), not at save time — we keep what the editor produced
 * verbatim so we can switch sanitizers later without re-saving data.
 */
export function RichTextEditor({
  initialHtml,
  name,
}: {
  initialHtml: string;
  name: string;
}) {
  const [html, setHtml] = useState(initialHtml);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
    ],
    content: initialHtml,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[360px] px-3 py-2 focus:outline-none [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
      },
    },
    onUpdate({ editor }) {
      setHtml(editor.getHTML());
    },
  });

  useEffect(() => {
    return () => editor?.destroy();
  }, [editor]);

  if (!editor) {
    return (
      <div className="min-h-[360px] rounded-md border bg-muted/20" aria-busy />
    );
  }

  return (
    <div className="rounded-md border bg-background">
      <Toolbar editor={editor} />
      <div className="border-t">
        <EditorContent editor={editor} />
      </div>
      <input type="hidden" name={name} value={html} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const buttons: Array<{
    icon: typeof Bold;
    label: string;
    isActive: () => boolean;
    onClick: () => void;
  }> = [
    {
      icon: Bold,
      label: "Bold",
      isActive: () => editor.isActive("bold"),
      onClick: () => editor.chain().focus().toggleBold().run(),
    },
    {
      icon: Italic,
      label: "Italic",
      isActive: () => editor.isActive("italic"),
      onClick: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      icon: Heading2,
      label: "Heading 2",
      isActive: () => editor.isActive("heading", { level: 2 }),
      onClick: () =>
        editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      icon: Heading3,
      label: "Heading 3",
      isActive: () => editor.isActive("heading", { level: 3 }),
      onClick: () =>
        editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      icon: List,
      label: "Bullet list",
      isActive: () => editor.isActive("bulletList"),
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      icon: ListOrdered,
      label: "Numbered list",
      isActive: () => editor.isActive("orderedList"),
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      icon: Quote,
      label: "Quote",
      isActive: () => editor.isActive("blockquote"),
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      icon: CodeIcon,
      label: "Inline code",
      isActive: () => editor.isActive("code"),
      onClick: () => editor.chain().focus().toggleCode().run(),
    },
  ];

  function addOrToggleLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1.5">
      {buttons.map(({ icon: Icon, label, isActive, onClick }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          aria-pressed={isActive()}
          onClick={onClick}
          className={
            "inline-flex size-7 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground " +
            (isActive() ? "bg-accent text-foreground" : "")
          }
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
      <button
        type="button"
        aria-label="Link"
        aria-pressed={editor.isActive("link")}
        onClick={addOrToggleLink}
        className={
          "inline-flex size-7 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground " +
          (editor.isActive("link") ? "bg-accent text-foreground" : "")
        }
      >
        <LinkIcon className="size-3.5" aria-hidden />
      </button>
      <div className="mx-1 h-4 w-px bg-border" />
      <button
        type="button"
        aria-label="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className="inline-flex size-7 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-40"
      >
        <Undo className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className="inline-flex size-7 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-40"
      >
        <Redo className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
