"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  Undo2,
  Unlink,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  AdminMediaPicker,
  type MediaAssetSummary,
} from "@/components/admin/media-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const CustomTipTapImage = Image.extend({
  name: "image",
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaAssetId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-media-asset-id"),
        renderHTML: (attributes) => {
          if (!attributes.mediaAssetId) return {};
          return { "data-media-asset-id": attributes.mediaAssetId };
        },
      },
    };
  },
});

export type TipTapEditorProps = {
  content?: Record<string, unknown> | string | null;
  onChange?: (json: Record<string, unknown>, rawText: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  canManageMedia?: boolean;
  activeEditionId?: string | null;
};

export function TipTapEditor({
  content,
  onChange,
  placeholder = "Tulis isi berita di sini...",
  className,
  editable = true,
  canManageMedia = true,
  activeEditionId = null,
}: TipTapEditorProps) {
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-fb underline hover:text-fb-600",
        },
      }),
      CustomTipTapImage.configure({
        HTMLAttributes: {
          class: "rounded-lg border border-border my-4 max-w-full h-auto",
        },
      }),
    ],
    content: content || {
      type: "doc",
      content: [{ type: "paragraph" }],
    },
    onUpdate: ({ editor: currentEditor }) => {
      const json = currentEditor.getJSON();
      const text = currentEditor.getText();
      onChange?.(json, text);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-stone max-w-none focus:outline-none min-h-[320px] p-4 text-foreground font-inter text-base leading-relaxed",
      },
    },
  });

  // Sync content when content prop changes externally
  useEffect(() => {
    if (!editor || !content) return;
    const currentJson = JSON.stringify(editor.getJSON());
    const newJson = typeof content === "string" ? content : JSON.stringify(content);
    if (currentJson !== newJson) {
      try {
        const parsed = typeof content === "string" ? JSON.parse(content) : content;
        editor.commands.setContent(parsed, { emitUpdate: false });
      } catch {
        // Fallback for plain text
        if (typeof content === "string" && content.trim().length > 0) {
          editor.commands.setContent(
            {
              type: "doc",
              content: content.split("\n\n").map((p: string) => ({
                type: "paragraph",
                content: [{ type: "text", text: p }],
              })),
            },
            { emitUpdate: false },
          );
        }
      }
    }
  }, [content, editor]);

  const handleOpenLinkDialog = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href ?? "";
    setLinkUrl(previousUrl);
    setLinkDialogOpen(true);
  }, [editor]);

  const handleSaveLink = useCallback(() => {
    if (!editor) return;
    if (linkUrl.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      let formatted = linkUrl.trim();
      if (!/^https?:\/\//i.test(formatted) && !formatted.startsWith("/")) {
        formatted = `https://${formatted}`;
      }
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: formatted })
        .run();
    }
    setLinkDialogOpen(false);
  }, [editor, linkUrl]);

  const handleInsertMedia = useCallback(
    (asset: MediaAssetSummary) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .setImage({
          src: asset.url,
          alt: asset.alt ?? asset.filename,
          // @ts-expect-error custom attribute supported by extend
          mediaAssetId: asset.id,
        })
        .run();
    },
    [editor],
  );

  if (!editor) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground">
        Memuat editor...
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-white shadow-xs", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 p-1.5 text-foreground">
        {/* Paragraf */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={cn(
            "h-8 px-2 text-xs",
            editor.isActive("paragraph") && "bg-dgb-50 text-dgb font-semibold",
          )}
          title="Paragraf"
        >
          <Pilcrow size={15} />
        </Button>

        {/* Heading 2 */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            "h-8 px-2 text-xs",
            editor.isActive("heading", { level: 2 }) && "bg-dgb-50 text-dgb font-bold",
          )}
          title="Heading 2"
        >
          <Heading2 size={16} />
        </Button>

        {/* Heading 3 */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn(
            "h-8 px-2 text-xs",
            editor.isActive("heading", { level: 3 }) && "bg-dgb-50 text-dgb font-bold",
          )}
          title="Heading 3"
        >
          <Heading3 size={16} />
        </Button>

        <div className="mx-1 h-4 w-px bg-border" />

        {/* Bold */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            "h-8 px-2 text-xs",
            editor.isActive("bold") && "bg-dgb-50 text-dgb font-bold",
          )}
          title="Tebal (Bold)"
        >
          <Bold size={15} />
        </Button>

        {/* Italic */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            "h-8 px-2 text-xs",
            editor.isActive("italic") && "bg-dgb-50 text-dgb font-semibold italic",
          )}
          title="Miring (Italic)"
        >
          <Italic size={15} />
        </Button>

        {/* Link */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleOpenLinkDialog}
          className={cn(
            "h-8 px-2 text-xs",
            editor.isActive("link") && "bg-dgb-50 text-dgb font-semibold",
          )}
          title="Tautan (Link)"
        >
          <LinkIcon size={15} />
        </Button>

        {editor.isActive("link") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().unsetLink().run()}
            className="h-8 px-2 text-xs text-destructive hover:bg-rose-50"
            title="Hapus tautan"
          >
            <Unlink size={15} />
          </Button>
        )}

        <div className="mx-1 h-4 w-px bg-border" />

        {/* Bullet List */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            "h-8 px-2 text-xs",
            editor.isActive("bulletList") && "bg-dgb-50 text-dgb font-semibold",
          )}
          title="Daftar poin"
        >
          <List size={15} />
        </Button>

        {/* Numbered List */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            "h-8 px-2 text-xs",
            editor.isActive("orderedList") && "bg-dgb-50 text-dgb font-semibold",
          )}
          title="Daftar nomor"
        >
          <ListOrdered size={15} />
        </Button>

        {/* Blockquote */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn(
            "h-8 px-2 text-xs",
            editor.isActive("blockquote") && "bg-dgb-50 text-dgb font-semibold",
          )}
          title="Kutipan (Blockquote)"
        >
          <Quote size={15} />
        </Button>

        {/* Media picker image */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setMediaPickerOpen(true)}
          className="h-8 px-2 text-xs text-fb hover:bg-fb-50 hover:text-fb-600"
          title="Sisipkan gambar dari pustaka media"
        >
          <ImageIcon size={15} className="mr-1" />
          <span className="text-[11px] font-medium">Sisipkan gambar</span>
        </Button>

        <div className="mx-auto" />

        {/* Undo */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 px-2 text-xs disabled:opacity-30"
          title="Undo"
        >
          <Undo2 size={15} />
        </Button>

        {/* Redo */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-8 px-2 text-xs disabled:opacity-30"
          title="Redo"
        >
          <Redo2 size={15} />
        </Button>
      </div>

      {/* Editor Content Area */}
      <div className="relative min-h-[360px] bg-white">
        <EditorContent editor={editor} />
        {editor.isEmpty && (
          <div className="pointer-events-none absolute left-4 top-4 select-none font-inter text-sm text-muted-foreground/60">
            {placeholder}
          </div>
        )}
      </div>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-montserrat">Tautan Web</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold text-foreground">
              Masukkan URL tautan:
            </label>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com/berita"
              className="text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSaveLink();
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLinkDialogOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveLink}
              className="bg-dgb hover:bg-dgb-600 text-white"
            >
              Terapkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media Picker */}
      <AdminMediaPicker
        open={mediaPickerOpen}
        onOpenChange={setMediaPickerOpen}
        onSelect={handleInsertMedia}
        acceptType="image"
        title="Sisipkan gambar ke artikel"
        description="Pilih gambar dari pustaka media atau unggah file baru untuk dimasukkan ke dalam berita."
        canManageMedia={canManageMedia}
        activeEditionId={activeEditionId}
      />
    </div>
  );
}
