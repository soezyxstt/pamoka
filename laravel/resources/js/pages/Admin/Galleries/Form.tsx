import { Head, Link, router, useForm } from '@inertiajs/react'
import { useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import AdminLayout from '../../../layouts/AdminLayout'

type MediaOption = { id: string; url: string; filename: string; alt: string | null }
type EventOption = { id: string; label: string }
type GalleryItem = {
    id: string
    mediaAssetId: string | null
    youtubeId: string | null
    caption: string | null
    displayOrder: number
    active: boolean
    media: { url: string; filename: string; alt: string | null } | null
}
type Gallery = {
    id: string
    title: string
    slug: string
    description: string | null
    coverMediaId: string | null
    ownerType: 'standalone' | 'event'
    ownerId: string
    displayOrder: number
    status: 'draft' | 'published'
    active: boolean
    version: number
    coverUrl: string | null
    coverAlt: string | null
    items: GalleryItem[]
}
type FormData = {
    title: string
    slug: string
    description: string
    cover_media_id: string
    owner_type: 'standalone' | 'event'
    owner_id: string
    display_order: number
    status: 'draft' | 'published'
    active: boolean
    version?: number
}
type ItemFormData = {
    version?: number
    media_ids: string[]
    youtube_id: string
    caption: string
}
type Props = { editionName: string; gallery: Gallery | null; events: EventOption[]; mediaOptions: MediaOption[]; canEdit: boolean }

export default function Form({ editionName, gallery, events, mediaOptions, canEdit }: Props) {
    const form = useForm<FormData>({
        title: gallery?.title ?? '',
        slug: gallery?.slug ?? '',
        description: gallery?.description ?? '',
        cover_media_id: gallery?.coverMediaId ?? '',
        owner_type: gallery?.ownerType ?? 'standalone',
        owner_id: gallery?.ownerId ?? events[0]?.id ?? '',
        display_order: gallery?.displayOrder ?? 0,
        status: gallery?.status ?? 'draft',
        active: gallery?.active ?? true,
        version: gallery?.version,
    })
    const itemForm = useForm<ItemFormData>({ version: gallery?.version, media_ids: [], youtube_id: '', caption: '' })
    const [captions, setCaptions] = useState<Record<string, string>>(() => Object.fromEntries((gallery?.items ?? []).map((item) => [item.id, item.caption ?? ''])))
    const [selectedMedia, setSelectedMedia] = useState<string[]>([])
    const [addingItems, setAddingItems] = useState(false)
    const errors = Object.values(form.errors)

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canEdit) return
        if (gallery) form.put(`/admin/content/galleries/${gallery.id}`)
        else form.post('/admin/content/galleries')
    }

    const addItems = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!gallery || !canEdit) return
        setAddingItems(true)
        router.post(`/admin/content/galleries/${gallery.id}/items`, {
            version: gallery.version,
            media_ids: selectedMedia,
            youtube_id: itemForm.data.youtube_id,
            caption: itemForm.data.caption,
        }, { preserveScroll: true, onFinish: () => setAddingItems(false) })
    }

    const removeGallery = () => {
        if (!gallery || !canEdit || form.processing || !window.confirm('Hapus album ini beserta itemnya?')) return
        form.delete(`/admin/content/galleries/${gallery.id}`)
    }

    const saveCaption = (item: GalleryItem) => {
        if (!gallery || !canEdit || itemForm.processing) return
        router.put(`/admin/content/galleries/${gallery.id}/items/${item.id}`, { version: gallery.version, caption: captions[item.id] ?? '' }, { preserveScroll: true })
    }

    const removeItem = (item: GalleryItem) => {
        if (!gallery || !canEdit || !window.confirm('Hapus item ini dari album?')) return
        router.delete(`/admin/content/galleries/${gallery.id}/items/${item.id}`, { data: { version: gallery.version }, preserveScroll: true })
    }

    const moveItem = (index: number, direction: -1 | 1) => {
        if (!gallery || !canEdit) return
        const target = index + direction
        if (target < 0 || target >= gallery.items.length) return
        const ids = gallery.items.map((item) => item.id)
        const current = ids[index]
        ids[index] = ids[target]
        ids[target] = current
        router.post(`/admin/content/galleries/${gallery.id}/items/reorder`, { version: gallery.version, item_ids: ids }, { preserveScroll: true })
    }

    return (
        <>
            <Head title={gallery ? `Edit ${gallery.title}` : 'Buat album'} />
            <section>
                <Link href="/admin/content/galleries" className="text-sm font-semibold text-dgb transition-colors hover:text-fb-500">Kembali ke daftar album</Link>
                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Konten edisi</p><h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">{gallery ? 'Edit album' : 'Buat album baru'}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Edisi {editionName}. Satu item hanya boleh berupa foto atau video YouTube.</p></div>{gallery && <span className="rounded-md bg-dgb-50 px-3 py-2 text-sm font-semibold text-dgb-800">{gallery.status === 'published' ? 'Terbit' : 'Draft'} · versi {gallery.version}</span>}</div>
                {errors.length > 0 && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert"><ul className="grid gap-1">{errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></div>}

                <form className="mt-8 grid gap-6" onSubmit={submit}>
                    <div className="rounded-xl border border-border bg-white p-5 sm:p-6"><div className="grid gap-5"><Field label="Judul album" error={form.errors.title}><input value={form.data.title} onChange={(input) => { const title = input.target.value; form.setData('title', title); if (!gallery) form.setData('slug', slugify(title)) }} disabled={!canEdit} required minLength={2} className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" /></Field><Field label="Slug" hint="Huruf kecil, angka, dan tanda minus." error={form.errors.slug}><input value={form.data.slug} onChange={(input) => form.setData('slug', slugify(input.target.value))} disabled={!canEdit} required className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" /></Field><Field label="Deskripsi" error={form.errors.description}><textarea value={form.data.description} onChange={(input) => form.setData('description', input.target.value)} disabled={!canEdit} rows={4} className="rounded-md border border-border px-3 py-2 text-sm leading-6 outline-none focus:border-dgb disabled:bg-muted" /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Tipe album" error={form.errors.owner_type}><select value={form.data.owner_type} onChange={(input) => form.setData('owner_type', input.target.value as FormData['owner_type'])} disabled={!canEdit} className="min-h-11 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb disabled:bg-muted"><option value="standalone">Album umum</option><option value="event">Terkait acara</option></select></Field>{form.data.owner_type === 'event' ? <Field label="Acara" error={form.errors.owner_id}><select value={form.data.owner_id} onChange={(input) => form.setData('owner_id', input.target.value)} disabled={!canEdit} required className="min-h-11 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb disabled:bg-muted"><option value="">Pilih acara</option>{events.map((event) => <option key={event.id} value={event.id}>{event.label}</option>)}</select></Field> : <Field label="Status publikasi" error={form.errors.status}><select value={form.data.status} onChange={(input) => form.setData('status', input.target.value as FormData['status'])} disabled={!canEdit} className="min-h-11 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb disabled:bg-muted"><option value="draft">Draft</option><option value="published">Terbit</option></select></Field>}</div><div className="grid gap-5 sm:grid-cols-2"><Field label="Cover" hint="Opsional, hanya gambar siap pakai." error={form.errors.cover_media_id}><select value={form.data.cover_media_id} onChange={(input) => form.setData('cover_media_id', input.target.value)} disabled={!canEdit} className="min-h-11 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb disabled:bg-muted"><option value="">Tanpa cover</option>{mediaOptions.map((media) => <option key={media.id} value={media.id}>{media.filename}</option>)}</select></Field><Field label="Urutan tampil" error={form.errors.display_order}><input value={form.data.display_order} onChange={(input) => form.setData('display_order', Number(input.target.value))} disabled={!canEdit} type="number" min={0} step={1} className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" /></Field></div>{form.data.cover_media_id && <img src={mediaOptions.find((media) => media.id === form.data.cover_media_id)?.url ?? gallery?.coverUrl ?? ''} alt="" className="h-48 w-full rounded-lg border border-border object-cover" />}{gallery && <label className="flex items-center gap-3 border-t border-border pt-5 text-sm font-semibold text-dgb-900"><input type="checkbox" checked={form.data.active} onChange={(input) => form.setData('active', input.target.checked)} disabled={!canEdit} className="size-4 accent-dgb" />Tampilkan album pada halaman publik</label>}</div></div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div>{gallery && canEdit && <button type="button" onClick={removeGallery} disabled={form.processing} className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60">Hapus album</button>}</div><div className="flex flex-wrap gap-2 sm:justify-end"><Link href="/admin/content/galleries" className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Batal</Link>{canEdit && <button type="submit" disabled={form.processing} className="inline-flex min-h-10 items-center justify-center rounded-md bg-dgb px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-dgb-600 disabled:opacity-60">{form.processing ? 'Menyimpan' : 'Simpan detail'}</button>}</div></div>
                </form>

                {gallery && <div className="mt-8 grid gap-6"><div className="rounded-xl border border-border bg-white p-5 sm:p-6"><h2 className="font-montserrat text-lg font-semibold text-dgb-900">Tambah item</h2><p className="mt-1 text-sm text-muted-foreground">Pilih beberapa foto atau isi satu ID atau URL YouTube.</p><form className="mt-5 grid gap-5" onSubmit={addItems}><label className="grid gap-1 text-xs font-semibold text-dgb-900">Foto dari pustaka<select multiple value={selectedMedia} onChange={(input) => setSelectedMedia(Array.from(input.target.selectedOptions, (option) => option.value))} disabled={!canEdit || addingItems} className="min-h-36 rounded-md border border-border bg-white px-3 py-2 text-sm font-normal outline-none focus:border-dgb">{mediaOptions.map((media) => <option key={media.id} value={media.id}>{media.filename}</option>)}</select></label><Field label="ID atau URL YouTube" error={itemForm.errors.youtube_id}><input value={itemForm.data.youtube_id} onChange={(input) => itemForm.setData('youtube_id', input.target.value)} disabled={!canEdit || addingItems} placeholder="dQw4w9WgXcQ" className="min-h-11 rounded-md border border-border px-3 text-sm font-normal outline-none focus:border-dgb disabled:bg-muted" /></Field><Field label="Caption bersama" error={itemForm.errors.caption}><input value={itemForm.data.caption} onChange={(input) => itemForm.setData('caption', input.target.value)} disabled={!canEdit || addingItems} className="min-h-11 rounded-md border border-border px-3 text-sm font-normal outline-none focus:border-dgb disabled:bg-muted" /></Field><div className="flex justify-end"><button type="submit" disabled={!canEdit || addingItems} className="rounded-md bg-dgb px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-dgb-600 disabled:opacity-60">{addingItems ? 'Menambahkan' : 'Tambah item'}</button></div></form></div><div className="rounded-xl border border-border bg-white p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="font-montserrat text-lg font-semibold text-dgb-900">Isi album ({gallery.items.length})</h2><p className="mt-1 text-sm text-muted-foreground">Atur urutan, caption, dan status item.</p></div></div><div className="mt-5 grid gap-3">{gallery.items.length === 0 ? <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Album belum memiliki item.</p> : gallery.items.map((item, index) => <article key={item.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[7rem_1fr_auto] sm:items-center"><div className="h-20 overflow-hidden rounded-md bg-dgb-50/50">{item.media ? <img src={item.media.url} alt={item.media.alt ?? item.caption ?? `Item ${index + 1}`} className="size-full object-cover" /> : <div className="grid size-full place-items-center bg-dgb-900 text-center text-xs font-semibold text-white">YouTube<br />{item.youtubeId}</div>}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>#{index + 1}</span><span>{item.media ? 'Foto' : 'Video'}</span></div><input value={captions[item.id] ?? ''} onChange={(input) => setCaptions((current) => ({ ...current, [item.id]: input.target.value }))} disabled={!canEdit} placeholder="Caption item" className="mt-2 min-h-9 w-full rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" /></div><div className="flex flex-wrap gap-1 sm:justify-end"><button type="button" onClick={() => moveItem(index, -1)} disabled={!canEdit || index === 0} className="rounded-md border border-border px-2 py-1 text-sm text-dgb disabled:opacity-40" aria-label="Pindahkan item ke atas">↑</button><button type="button" onClick={() => moveItem(index, 1)} disabled={!canEdit || index === gallery.items.length - 1} className="rounded-md border border-border px-2 py-1 text-sm text-dgb disabled:opacity-40" aria-label="Pindahkan item ke bawah">↓</button><button type="button" onClick={() => saveCaption(item)} disabled={!canEdit} className="rounded-md border border-dgb px-2 py-1 text-xs font-semibold text-dgb">Simpan</button><button type="button" onClick={() => removeItem(item)} disabled={!canEdit} className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700">Hapus</button></div></article>)}</div></div></div>}
            </section>
        </>
    )
}

Form.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>

function slugify(value: string): string {
    return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactElement }) {
    return <label className="grid gap-1 text-xs font-semibold text-dgb-900"><span>{label}</span>{hint && <span className="font-normal text-muted-foreground">{hint}</span>}{children}{error && <span className="font-normal text-red-700">{error}</span>}</label>
}
