import { Head, Link, router } from '@inertiajs/react'
import { useState } from 'react'
import type { ReactElement } from 'react'
import AdminLayout from '../../../layouts/AdminLayout'

type Event = {
    id: string
    label: string
    slug: string
    description: string | null
    displayOrder: number
    active: boolean
    version: number
    hero: { url: string; alt: string | null } | null
}

type Props = {
    editionName: string
    events: Event[]
    canEdit: boolean
}

export default function Index({ editionName, events, canEdit }: Props) {
    const [reordering, setReordering] = useState(false)
    const move = (index: number, direction: -1 | 1) => {
        const target = index + direction
        if (!canEdit || target < 0 || target >= events.length || reordering) return
        const order = events.map((event) => ({ id: event.id, version: event.version }))
        const current = order[index]
        order[index] = order[target]
        order[target] = current
        setReordering(true)
        router.post('/admin/content/events/reorder', { items: order }, {
            preserveScroll: true,
            onFinish: () => setReordering(false),
        })
    }

    return (
        <>
            <Head title="Rangkaian kegiatan" />
            <section>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Konten edisi</p>
                        <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Rangkaian kegiatan</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Kelola agenda dan foto hero kegiatan untuk {editionName}.</p>
                    </div>
                    {canEdit && <Link href="/admin/content/events/new" className="inline-flex min-h-10 items-center justify-center rounded-md bg-dgb px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-dgb-600">Tambah acara</Link>}
                </div>

                <div className="mt-8 grid gap-3">
                    {events.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">Belum ada acara pada edisi ini.</div> : events.map((event, index) => (
                        <article key={event.id} className="grid gap-4 rounded-xl border border-border bg-white p-4 sm:grid-cols-[8rem_1fr_auto] sm:items-center">
                            <div className="h-24 overflow-hidden rounded-lg border border-border bg-dgb-50/50">
                                {event.hero ? <img src={event.hero.url} alt={event.hero.alt ?? event.label} className="size-full object-cover" /> : <div className="grid size-full place-items-center text-center text-xs font-semibold text-dgb-700">Tanpa hero</div>}
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span className="rounded-md bg-dgb-50 px-2 py-1 font-semibold text-dgb-800">Urutan {event.displayOrder}</span>
                                    <span className={event.active ? 'rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-800' : 'rounded-md bg-muted px-2 py-1 font-semibold text-muted-foreground'}>{event.active ? 'Aktif' : 'Nonaktif'}</span>
                                    <span>Versi {event.version}</span>
                                </div>
                                <h2 className="mt-2 truncate font-montserrat text-base font-bold text-dgb-900">{event.label}</h2>
                                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">/rangkaian-kegiatan/{event.slug}</p>
                                {event.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{event.description}</p>}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                {canEdit && <div className="flex gap-1"><button type="button" onClick={() => move(index, -1)} disabled={index === 0 || reordering} className="rounded-md border border-border px-2 py-1 text-sm text-dgb disabled:opacity-40" aria-label="Pindahkan acara ke atas">↑</button><button type="button" onClick={() => move(index, 1)} disabled={index === events.length - 1 || reordering} className="rounded-md border border-border px-2 py-1 text-sm text-dgb disabled:opacity-40" aria-label="Pindahkan acara ke bawah">↓</button></div>}
                                <Link href={`/admin/content/events/${event.id}`} className="rounded-md border border-dgb px-3 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Buka editor</Link>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        </>
    )
}

Index.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
