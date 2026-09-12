import { Head, Link } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import AdminLayout from '../../../layouts/AdminLayout'

type Gallery = {
    id: string
    title: string
    slug: string
    description: string | null
    ownerType: 'standalone' | 'event'
    ownerId: string
    ownerLabel: string | null
    displayOrder: number
    status: 'draft' | 'published' | string
    active: boolean
    version: number
    coverUrl: string | null
    coverAlt: string | null
    itemCount: number
    photoCount: number
    videoCount: number
}

type Props = {
    editionName: string
    galleries: Gallery[]
    canEdit: boolean
}

export default function Index({ editionName, galleries, canEdit }: Props) {
    const [search, setSearch] = useState('')
    const [owner, setOwner] = useState<'all' | 'standalone' | 'event'>('all')
    const [status, setStatus] = useState<'all' | 'draft' | 'published'>('all')
    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase()

        return galleries.filter((gallery) => {
            const matchesSearch = query === '' || gallery.title.toLowerCase().includes(query) || gallery.slug.toLowerCase().includes(query) || (gallery.description?.toLowerCase().includes(query) ?? false)
            const matchesOwner = owner === 'all' || gallery.ownerType === owner
            const matchesStatus = status === 'all' || gallery.status === status

            return matchesSearch && matchesOwner && matchesStatus
        })
    }, [galleries, owner, search, status])

    return (
        <>
            <Head title="Galeri" />
            <section>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Konten edisi</p>
                        <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Galeri</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Kelola album foto dan video untuk {editionName}.</p>
                    </div>
                    {canEdit && <Link href="/admin/content/galleries/new" className="inline-flex min-h-10 items-center justify-center rounded-md bg-dgb px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-dgb-600">Buat album baru</Link>}
                </div>

                <div className="mt-8 grid gap-3 rounded-xl border border-border bg-white p-4 md:grid-cols-[1fr_auto_auto] md:items-end">
                    <label className="grid gap-1 text-xs font-semibold text-dgb-900">Cari album<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Judul, slug, atau deskripsi" className="min-h-10 rounded-md border border-border px-3 text-sm font-normal outline-none focus:border-dgb" /></label>
                    <label className="grid gap-1 text-xs font-semibold text-dgb-900">Tipe<select value={owner} onChange={(event) => setOwner(event.target.value as typeof owner)} className="min-h-10 rounded-md border border-border bg-white px-3 text-sm font-normal outline-none focus:border-dgb"><option value="all">Semua tipe</option><option value="standalone">Album umum</option><option value="event">Album acara</option></select></label>
                    <label className="grid gap-1 text-xs font-semibold text-dgb-900">Status<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="min-h-10 rounded-md border border-border bg-white px-3 text-sm font-normal outline-none focus:border-dgb"><option value="all">Semua status</option><option value="draft">Draft</option><option value="published">Terbit</option></select></label>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {filtered.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground md:col-span-2">{galleries.length === 0 ? 'Belum ada album pada edisi ini.' : 'Tidak ada album yang sesuai dengan filter.'}</div> : filtered.map((gallery) => (
                        <Link key={gallery.id} href={`/admin/content/galleries/${gallery.id}`} className="overflow-hidden rounded-xl border border-border bg-white transition-colors hover:border-dgb-300">
                            <div className="h-40 bg-dgb-50/50">{gallery.coverUrl ? <img src={gallery.coverUrl} alt={gallery.coverAlt ?? gallery.title} className="size-full object-cover" /> : <div className="grid size-full place-items-center text-sm font-semibold text-dgb-700">Tanpa cover</div>}</div>
                            <div className="p-4">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="rounded-md bg-dgb-50 px-2 py-1 font-semibold text-dgb-800">{gallery.ownerType === 'event' ? gallery.ownerLabel ?? 'Acara' : 'Umum'}</span><span className={gallery.status === 'published' ? 'rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-800' : 'rounded-md bg-fb-50 px-2 py-1 font-semibold text-dgb-800'}>{gallery.status === 'published' ? 'Terbit' : 'Draft'}</span><span>{gallery.itemCount} item</span></div>
                                <h2 className="mt-3 truncate font-montserrat text-lg font-bold text-dgb-900">{gallery.title}</h2>
                                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">/galeri/{gallery.slug}</p>
                                <p className="mt-3 text-sm text-muted-foreground">{gallery.photoCount} foto · {gallery.videoCount} video · versi {gallery.version}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </>
    )
}

Index.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
