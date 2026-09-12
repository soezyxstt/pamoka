import { Head, Link, router, useForm } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import AdminLayout from '../../../layouts/AdminLayout'

type Definition = {
    slotKey: string
    group: string
    pageRoute: string
    pageLabel: string
    label: string
    description: string
    acceptType: 'image' | 'video'
    aspectRatio: string
    required: boolean
}

type MediaAsset = {
    id: string
    url: string
    filename: string
    mimeType: string
    alt: string | null
}

type Binding = {
    id: string
    editionId: string
    slotKey: string
    mediaId: string | null
    altOverride: string | null
    focalX: number | null
    focalY: number | null
    version: number
}

type Slot = {
    definition: Definition
    binding: Binding | null
    mediaAsset: MediaAsset | null
}

type Group = {
    label: string
    pageRoute: string
    description: string
}

type MediaOption = MediaAsset

type SiteAssetFormData = {
    media_id: string
    alt_override: string
    focal_x: number | null
    focal_y: number | null
    version: number | undefined
}

type Props = {
    editionName: string
    slots: Slot[]
    groups: Record<string, Group>
    mediaOptions: MediaOption[]
    canEdit: boolean
}

export default function Index({ editionName, slots, groups, mediaOptions, canEdit }: Props) {
    const [group, setGroup] = useState('all')
    const filtered = useMemo(() => group === 'all' ? slots : slots.filter((slot) => slot.definition.group === group), [group, slots])

    return (
        <>
            <Head title="Aset situs" />
            <section>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Konten edisi</p>
                        <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Aset situs</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Hubungkan media siap pakai ke slot visual {editionName}. Slot dan jenis media mengikuti manifest situs.</p>
                    </div>
                    <Link href="/admin" className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Kembali ke dashboard</Link>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-4">
                    <Stat label="Total slot" value={slots.length} />
                    <Stat label="Terisi" value={slots.filter((slot) => slot.binding?.mediaId).length} />
                    <Stat label="Wajib" value={slots.filter((slot) => slot.definition.required).length} />
                    <Stat label="Tampil" value={filtered.length} />
                </div>

                <div className="mt-6 flex flex-wrap gap-2 rounded-xl border border-border bg-white p-3">
                    <button type="button" onClick={() => setGroup('all')} className={group === 'all' ? 'button-primary' : 'button-outline'}>Semua</button>
                    {Object.entries(groups).map(([key, value]) => <button type="button" key={key} onClick={() => setGroup(key)} className={group === key ? 'button-primary' : 'button-outline'}>{value.label}</button>)}
                </div>

                <div className="mt-5 grid gap-4">
                    {filtered.map((slot) => <SlotEditor key={slot.definition.slotKey} slot={slot} mediaOptions={mediaOptions} canEdit={canEdit} />)}
                </div>
            </section>
        </>
    )
}

Index.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>

function SlotEditor({ slot, mediaOptions, canEdit }: { slot: Slot; mediaOptions: MediaOption[]; canEdit: boolean }) {
    const { definition, binding, mediaAsset } = slot
    const options = mediaOptions.filter((media) => definition.acceptType === 'image' ? media.mimeType.startsWith('image/') : media.mimeType.startsWith('video/'))
    const form = useForm<SiteAssetFormData>({
        media_id: binding?.mediaId ?? '',
        alt_override: binding?.altOverride ?? '',
        focal_x: binding?.focalX ?? 50,
        focal_y: binding?.focalY ?? 50,
        version: binding?.version,
    })

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        form.post(`/admin/content/site-assets/${definition.slotKey}`, { preserveScroll: true })
    }

    const remove = () => {
        if (binding?.mediaId && window.confirm(`Lepas aset dari slot ${definition.label}?`)) router.delete(`/admin/content/site-assets/${definition.slotKey}`, { data: { version: binding.version }, preserveScroll: true })
    }

    return <article className="rounded-xl border border-border bg-white p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-dgb-50 px-2 py-1 text-xs font-semibold text-dgb-800">{definition.pageLabel}</span><span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">{definition.acceptType} · {definition.aspectRatio}</span>{definition.required && <span className="rounded-md bg-fb-50 px-2 py-1 text-xs font-semibold text-fb-800">Wajib</span>}</div><h2 className="mt-2 font-montserrat text-lg font-semibold text-dgb-900">{definition.label}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{definition.description}</p><p className="mt-2 font-mono text-xs text-muted-foreground">{definition.slotKey}</p></div><Preview media={mediaAsset} alt={binding?.altOverride ?? mediaAsset?.alt ?? definition.label} /></div><form onSubmit={submit} className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_7rem_7rem_auto] sm:items-end"><Field label={`Media ${definition.acceptType}`} error={form.errors.media_id}><select value={form.data.media_id} onChange={(event) => form.setData('media_id', event.target.value)} disabled={!canEdit} className="input"><option value="">Tidak ada media</option>{options.map((media) => <option key={media.id} value={media.id}>{media.filename}</option>)}</select></Field><Field label="Alt override" error={form.errors.alt_override}><input value={form.data.alt_override} onChange={(event) => form.setData('alt_override', event.target.value)} disabled={!canEdit} className="input" placeholder="Opsional" /></Field><Field label="Fokus X" error={form.errors.focal_x}><input type="number" min={0} max={100} value={form.data.focal_x ?? ''} onChange={(event) => form.setData('focal_x', event.target.value === '' ? null : Number(event.target.value))} disabled={!canEdit} className="input" /></Field><Field label="Fokus Y" error={form.errors.focal_y}><input type="number" min={0} max={100} value={form.data.focal_y ?? ''} onChange={(event) => form.setData('focal_y', event.target.value === '' ? null : Number(event.target.value))} disabled={!canEdit} className="input" /></Field><div className="flex flex-wrap gap-2 sm:justify-end"><button type="submit" disabled={!canEdit || form.processing} className="button-primary">{form.processing ? 'Menyimpan' : 'Simpan'}</button><button type="button" onClick={remove} disabled={!canEdit || !binding?.mediaId || form.processing} className="button-danger">Lepas</button></div>{form.errors.version && <p className="text-xs text-red-700 sm:col-span-5">{form.errors.version}</p>}</form></article>
}

function Preview({ media, alt }: { media: MediaAsset | null; alt: string }) {
    if (!media) return <div className="grid h-28 w-full max-w-xs place-items-center rounded-lg border border-dashed border-border bg-dgb-50/30 text-xs font-semibold text-dgb-700">Belum terisi</div>
    if (media.mimeType.startsWith('video/')) return <video src={media.url} controls className="h-28 w-full max-w-xs rounded-lg border border-border bg-black object-cover" />

    return <img src={media.url} alt={alt} className="h-28 w-full max-w-xs rounded-lg border border-border object-cover" />
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactElement }) {
    return <label className="grid gap-1 text-xs font-semibold text-dgb-900">{label}{children}{error && <span className="font-normal text-red-700">{error}</span>}</label>
}

function Stat({ label, value }: { label: string; value: number }) {
    return <div className="rounded-xl border border-border bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-2 font-montserrat text-2xl font-semibold text-dgb-900">{value}</p></div>
}
