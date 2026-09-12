import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import StarterKit from '@tiptap/starter-kit'
import type { JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export type TipTapDocument = JSONContent & { type: 'doc' }

export type TipTapNode = JSONContent

export type TipTapMediaOption = {
    id: string
    url: string
    filename: string
    alt: string | null
}

type TipTapEditorProps = {
    content?: TipTapDocument | null
    mediaOptions?: TipTapMediaOption[]
    onChange?: (document: TipTapDocument, rawText: string) => void
    placeholder?: string
    editable?: boolean
}

const CustomTipTapImage = Image.extend({
    name: 'image',
    addAttributes() {
        return {
            ...this.parent?.(),
            mediaAssetId: {
                default: null,
                parseHTML: (element: HTMLElement) => element.getAttribute('data-media-asset-id'),
                renderHTML: (attributes: { mediaAssetId?: string | null }) => {
                    if (!attributes.mediaAssetId) return {}

                    return { 'data-media-asset-id': attributes.mediaAssetId }
                },
            },
        }
    },
})

export default function TipTapEditor({
    content,
    mediaOptions = [],
    onChange,
    placeholder = 'Tulis isi berita di sini',
    editable = true,
}: TipTapEditorProps) {
    const [mediaOpen, setMediaOpen] = useState(false)
    const [linkOpen, setLinkOpen] = useState(false)
    const [linkUrl, setLinkUrl] = useState('')
    const lastContent = useRef<string | null>(null)

    const editor = useEditor({
        immediatelyRender: false,
        editable,
        extensions: [
            StarterKit.configure({
                heading: { levels: [2, 3] },
            }),
            Link.configure({
                openOnClick: false,
                autolink: false,
            }),
            CustomTipTapImage.configure({
                allowBase64: false,
                HTMLAttributes: { class: 'my-4 max-w-full rounded-lg border border-border' },
            }),
        ],
        content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
        onUpdate: ({ editor: currentEditor }) => {
            onChange?.(currentEditor.getJSON() as TipTapDocument, currentEditor.getText())
        },
        editorProps: {
            attributes: {
                class: 'min-h-[320px] p-4 font-inter text-base leading-7 text-foreground outline-none',
            },
        },
    })

    useEffect(() => {
        if (!editor || content === null || content === undefined) return

        const nextContent = JSON.stringify(content)
        if (lastContent.current === null) {
            lastContent.current = nextContent
            return
        }
        if (lastContent.current === nextContent) return

        lastContent.current = nextContent
        if (JSON.stringify(editor.getJSON()) !== nextContent) {
            editor.commands.setContent(content, { emitUpdate: false })
        }
    }, [content, editor])

    const openLink = useCallback(() => {
        if (!editor) return
        setLinkUrl(editor.getAttributes('link').href ?? '')
        setLinkOpen(true)
    }, [editor])

    const saveLink = useCallback(() => {
        if (!editor) return

        const value = linkUrl.trim()
        if (value === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
        } else {
            const href = value.startsWith('/')
                ? value
                : /^https:\/\//i.test(value)
                    ? value
                    : /^http:\/\//i.test(value)
                        ? `https://${value.slice('http://'.length)}`
                        : `https://${value}`
            editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
        }
        setLinkOpen(false)
    }, [editor, linkUrl])

    const insertImage = (media: TipTapMediaOption) => {
        if (!editor) return

        editor.chain().focus().setImage({
            src: media.url,
            alt: media.alt ?? media.filename,
            // @ts-expect-error mediaAssetId berasal dari extension gambar custom
            mediaAssetId: media.id,
        }).run()
        setMediaOpen(false)
    }

    if (!editor) {
        return <div className="grid min-h-80 place-items-center rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground">Memuat editor</div>
    }

    return (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
            <fieldset disabled={!editable} className="min-w-0 border-0 p-0">
                <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 p-2">
                    <ToolbarButton active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>Paragraf</ToolbarButton>
                    <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
                    <ToolbarButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarButton>
                    <ToolbarDivider />
                    <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>Tebal</ToolbarButton>
                    <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>Miring</ToolbarButton>
                    <ToolbarButton active={editor.isActive('link')} onClick={openLink}>Tautan</ToolbarButton>
                    {editor.isActive('link') && <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()}>Hapus tautan</ToolbarButton>}
                    <ToolbarDivider />
                    <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>Daftar poin</ToolbarButton>
                    <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>Daftar nomor</ToolbarButton>
                    <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>Kutipan</ToolbarButton>
                    <ToolbarButton onClick={() => setMediaOpen(true)}>Sisipkan gambar</ToolbarButton>
                    <span className="flex-1" />
                    <ToolbarButton disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>Urungkan</ToolbarButton>
                    <ToolbarButton disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>Ulangi</ToolbarButton>
                </div>
            </fieldset>

            <div className="relative bg-white">
                <EditorContent editor={editor} />
                {editor.isEmpty && <span className="pointer-events-none absolute left-4 top-4 text-sm text-muted-foreground/70">{placeholder}</span>}
            </div>

            {linkOpen && (
                <Modal title="Tautan berita" onClose={() => setLinkOpen(false)}>
                    <label className="grid gap-1.5 text-xs font-semibold text-dgb-900">
                        <span>URL tautan</span>
                        <input
                            value={linkUrl}
                            onChange={(event) => setLinkUrl(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault()
                                    saveLink()
                                }
                            }}
                            placeholder="https://contoh.id/berita"
                            autoFocus
                            className="min-h-10 rounded-md border border-border px-3 text-sm font-normal outline-none focus:border-dgb"
                        />
                        <span className="font-normal text-muted-foreground">Gunakan URL https atau jalur internal yang diawali garis miring.</span>
                    </label>
                    <div className="mt-5 flex justify-end gap-2">
                        <button type="button" onClick={() => setLinkOpen(false)} className="rounded-md border border-dgb px-3 py-2 text-sm font-semibold text-dgb">Batal</button>
                        <button type="button" onClick={saveLink} className="rounded-md bg-dgb px-3 py-2 text-sm font-semibold text-white">Terapkan</button>
                    </div>
                </Modal>
            )}

            {mediaOpen && (
                <Modal title="Sisipkan gambar" onClose={() => setMediaOpen(false)}>
                    {mediaOptions.length === 0 ? (
                        <div className="grid gap-3 text-sm text-muted-foreground">
                            <p>Belum ada aset gambar siap pakai pada pustaka media.</p>
                            <a href="/admin/media" className="font-semibold text-dgb underline underline-offset-4">Buka pustaka media</a>
                        </div>
                    ) : (
                        <div className="grid max-h-[min(28rem,60vh)] gap-3 overflow-y-auto sm:grid-cols-2">
                            {mediaOptions.map((media) => (
                                <button type="button" key={media.id} onClick={() => insertImage(media)} className="grid gap-2 rounded-lg border border-border p-2 text-left transition-colors hover:border-dgb hover:bg-dgb-50">
                                    <img src={media.url} alt={media.alt ?? media.filename} className="aspect-video w-full rounded-md object-cover" />
                                    <span className="truncate text-xs font-semibold text-dgb-900">{media.filename}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </Modal>
            )}
        </div>
    )
}

function ToolbarButton({ children, active = false, disabled = false, onClick }: { children: ReactNode; active?: boolean; disabled?: boolean; onClick: () => void }) {
    return <button type="button" onClick={onClick} disabled={disabled} className={`rounded-md px-2 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${active ? 'bg-dgb-50 text-dgb' : 'text-dgb-800 hover:bg-white'}`}>{children}</button>
}

function ToolbarDivider() {
    return <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-dgb-900/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
            <div role="dialog" aria-modal="true" aria-labelledby="tiptap-modal-title" className="max-h-[90vh] w-full max-w-xl overflow-hidden rounded-xl border border-border bg-white p-5 shadow-xl">
                <div className="flex items-center justify-between gap-3">
                    <h2 id="tiptap-modal-title" className="font-montserrat text-lg font-semibold text-dgb-900">{title}</h2>
                    <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm font-semibold text-muted-foreground hover:bg-muted">Tutup</button>
                </div>
                <div className="mt-4">{children}</div>
            </div>
        </div>
    )
}
