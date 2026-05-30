"use client";

import { useEffect, useState, type ReactNode } from "react";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code2,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
  Unlink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const htmlTagRegex = /<\/?[a-z][\s\S]*>/i;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function plainTextToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function normalizeEditorValue(value?: string | null) {
  if (!value?.trim()) return "";
  return htmlTagRegex.test(value) ? value : plainTextToHtml(value);
}

function normalizeStoredHtml(html: string) {
  return html === "<p></p>" ? "" : html;
}

type ToolbarButtonProps = {
  active?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
};

function ToolbarButton({ active, disabled, icon, label, onClick }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40",
        active && "bg-blue-500/15 text-blue-200 ring-1 ring-blue-400/20"
      )}
    >
      {icon}
    </Button>
  );
}

function applyLink(editor: Editor, href: string) {
  const trimmed = href.trim();
  if (!trimmed) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }

  const normalized = /^(https?:|mailto:)/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
}

type RichTextEditorProps = {
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
};

export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  placeholder = "Write a clear description...",
  className,
  editorClassName,
}: RichTextEditorProps) {
  const [linkDraft, setLinkDraft] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "text-blue-300 underline underline-offset-4",
        },
      }),
    ],
    content: normalizeEditorValue(value),
    editorProps: {
      attributes: {
        class:
          "min-h-[180px] w-full px-4 py-3 text-sm leading-6 text-slate-100 outline-none",
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      onChange(normalizeStoredHtml(activeEditor.getHTML()));
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;

    const nextValue = normalizeEditorValue(value);
    if (normalizeStoredHtml(editor.getHTML()) !== normalizeStoredHtml(nextValue)) {
      editor.commands.setContent(nextValue, { emitUpdate: false });
    }
  }, [editor, value]);

  const toolbarDisabled = disabled || !editor;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-inner shadow-black/20",
        disabled && "opacity-75",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-800 bg-slate-900/85 px-2 py-2">
        <ToolbarButton
          label="Bold"
          active={editor?.isActive("bold")}
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          icon={<Bold className="h-4 w-4" />}
        />
        <ToolbarButton
          label="Italic"
          active={editor?.isActive("italic")}
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          icon={<Italic className="h-4 w-4" />}
        />
        <ToolbarButton
          label="Strikethrough"
          active={editor?.isActive("strike")}
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          icon={<Strikethrough className="h-4 w-4" />}
        />
        <div className="mx-1 h-6 w-px bg-slate-800" />
        <ToolbarButton
          label="Bullet list"
          active={editor?.isActive("bulletList")}
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          icon={<List className="h-4 w-4" />}
        />
        <ToolbarButton
          label="Numbered list"
          active={editor?.isActive("orderedList")}
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          icon={<ListOrdered className="h-4 w-4" />}
        />
        <ToolbarButton
          label="Quote"
          active={editor?.isActive("blockquote")}
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          icon={<Quote className="h-4 w-4" />}
        />
        <ToolbarButton
          label="Code block"
          active={editor?.isActive("codeBlock")}
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          icon={<Code2 className="h-4 w-4" />}
        />
        <div className="mx-1 h-6 w-px bg-slate-800" />
        <ToolbarButton
          label="Link"
          active={editor?.isActive("link")}
          disabled={toolbarDisabled}
          onClick={() => {
            setLinkDraft(editor?.getAttributes("link").href || "");
            setShowLinkInput((current) => !current);
          }}
          icon={<Link className="h-4 w-4" />}
        />
        <ToolbarButton
          label="Remove link"
          disabled={toolbarDisabled || !editor?.isActive("link")}
          onClick={() => editor?.chain().focus().extendMarkRange("link").unsetLink().run()}
          icon={<Unlink className="h-4 w-4" />}
        />
        <div className="mx-1 h-6 w-px bg-slate-800" />
        <ToolbarButton
          label="Undo"
          disabled={toolbarDisabled || !editor?.can().chain().focus().undo().run()}
          onClick={() => editor?.chain().focus().undo().run()}
          icon={<Undo2 className="h-4 w-4" />}
        />
        <ToolbarButton
          label="Redo"
          disabled={toolbarDisabled || !editor?.can().chain().focus().redo().run()}
          onClick={() => editor?.chain().focus().redo().run()}
          icon={<Redo2 className="h-4 w-4" />}
        />
      </div>

      {showLinkInput && editor && !disabled && (
        <div className="flex flex-col gap-2 border-b border-slate-800 bg-slate-950 px-3 py-3 sm:flex-row">
          <Input
            value={linkDraft}
            onChange={(event) => setLinkDraft(event.target.value)}
            placeholder="https://example.com"
            className="h-9 border-slate-700 bg-slate-900 text-sm"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                applyLink(editor, linkDraft);
                setShowLinkInput(false);
                setLinkDraft("");
              }}
            >
              Apply
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                setShowLinkInput(false);
                setLinkDraft("");
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <EditorContent
        editor={editor}
        className={cn(
          "rich-text-editor [&_.ProseMirror:focus]:outline-none [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-blue-400/50 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_p]:my-2 [&_.ProseMirror_pre]:rounded-xl [&_.ProseMirror_pre]:border [&_.ProseMirror_pre]:border-slate-800 [&_.ProseMirror_pre]:bg-slate-900 [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_pre]:font-mono [&_.ProseMirror_pre]:text-xs [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-slate-500 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          editorClassName
        )}
      />
    </div>
  );
}
