import { Head, Link, router, useForm } from '@inertiajs/react'
import type { FormEvent, ReactElement } from 'react'
import AdminLayout from '../../../../layouts/AdminLayout'

type Finalist = {
    id: string
    number: number
    name: string
    categoryCode: string
}

type Title = {
    id: string
    name: string
    description: string | null
    capacity: number
    displayOrder: number
    active: boolean
    version: number
    participantIds: string[]
}

type Props = {
    editionName: string
    finalStage: { id: string; name: string } | null
    finalists: Finalist[]
    titles: Title[]
    finalistsWithoutTitle: number
    canEdit: boolean
}

type TitleFormData = {
    name: string
    description: string
    capacity: number
    version?: number
}

export default function Index({ editionName, finalStage, finalists, titles, finalistsWithoutTitle, canEdit }: Props) {
    const create = useForm<TitleFormData>({ name: '', description: '', capacity: 1 })

    const submitCreate = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canEdit) return
        create.post('/admin/content/participants/titles', { preserveScroll: true, onSuccess: () => create.reset() })
    }

    const move = (index: number, direction: -1 | 1) => {
        const target = index + direction
        if (!canEdit || target < 0 || target >= titles.length) return
        const items = titles.map((title) => ({ id: title.id, version: title.version }))
        const current = items[index]
        items[index] = items[target]
        items[target] = current
        router.post('/admin/content/participants/titles/reorder', { items }, { preserveScroll: true })
    }

    const toggle = (title: Title) => {
        if (!canEdit) return
        router.post(`/admin/content/participants/titles/${title.id}/toggle`, { version: title.version, active: !title.active }, { preserveScroll: true })
    }

    const remove = (title: Title) => {
        if (!canEdit || title.participantIds.length > 0 || !window.confirm(`Hapus gelar ${title.name}?`)) return
        router.delete(`/admin/content/participants/titles/${title.id}`, { data: { version: title.version }, preserveScroll: true })
    }

    const toggleAssignment = (title: Title, participant: Finalist, checked: boolean) => {
        if (!canEdit) return
        router.post(`/admin/content/participants/titles/${title.id}/${checked ? 'assign' : 'unassign'}`, {
            participant_id: participant.id,
            version: title.version,
        }, { preserveScroll: true })
    }

    return (
        <>
            <Head title="Gelar Pasanggiri" />
            <section>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Peserta / gelar</p>
                        <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Gelar Pasanggiri</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Kelola gelar peserta tahap final untuk {editionName}.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link href="/admin/content/participants/stages" className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Atur tahap</Link>
                        <Link href="/admin/content/participants" className="inline-flex min-h-10 items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:border-dgb">Kembali ke peserta</Link>
                    </div>
                </div>

                {!finalStage ? <div className="mt-8 rounded-xl border border-dashed border-border bg-white p-8 text-center"><p className="font-montserrat text-lg font-semibold text-dgb-900">Tahap final belum ditetapkan</p><p className="mt-2 text-sm text-muted-foreground">Tandai satu tahap sebagai final sebelum mengelola gelar.</p></div> : <>
                    <div className="mt-8 grid gap-3 sm:grid-cols-3">
                        <Stat label="Tahap final" value={finalStage.name} />
                        <Stat label="Peserta final" value={String(finalists.length)} />
                        <Stat label="Belum menerima gelar" value={String(finalistsWithoutTitle)} accent />
                    </div>

                    {canEdit && <form onSubmit={submitCreate} className="mt-6 grid gap-4 rounded-xl border border-dgb-100 bg-dgb-50/40 p-5 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
                        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                            <Field label="Nama gelar" error={create.errors.name}><input value={create.data.name} onChange={(event) => create.setData('name', event.target.value)} placeholder="Contoh: Mojang Pinilih" required className="min-h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb" /></Field>
                            <Field label="Deskripsi" error={create.errors.description}><input value={create.data.description} onChange={(event) => create.setData('description', event.target.value)} placeholder="Opsional" className="min-h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb" /></Field>
                        </div>
                        <Field label="Jumlah slot" error={create.errors.capacity}><input type="number" min={1} step={1} value={create.data.capacity} onChange={(event) => create.setData('capacity', Number(event.target.value))} required className="min-h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb" /></Field>
                        <button type="submit" disabled={create.processing} className="inline-flex min-h-10 items-center justify-center rounded-md bg-dgb px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-dgb-600 disabled:opacity-60">{create.processing ? 'Menyimpan' : 'Tambah gelar'}</button>
                    </form>}

                    <div className="mt-6 grid gap-4">
                        {titles.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">Belum ada gelar pada edisi ini.</div> : titles.map((title, index) => <article key={`${title.id}:${title.version}`} className="rounded-xl border border-border bg-white p-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="font-montserrat text-lg font-semibold text-dgb-900">{title.name}</h2>
                                        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${title.active ? 'bg-emerald-50 text-emerald-800' : 'bg-muted text-muted-foreground'}`}>{title.active ? 'Aktif' : 'Nonaktif'}</span>
                                        <span className="rounded-md bg-dgb-50 px-2 py-1 text-xs font-semibold text-dgb-800">{title.participantIds.length}/{title.capacity} terisi</span>
                                    </div>
                                    {title.description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{title.description}</p>}
                                    <p className="mt-1 text-xs text-muted-foreground">Urutan {title.displayOrder} · versi {title.version}</p>
                                </div>
                                {canEdit && <div className="flex flex-wrap gap-2">
                                    <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-dgb disabled:opacity-40" aria-label={`Naikkan ${title.name}`}>Naik</button>
                                    <button type="button" onClick={() => move(index, 1)} disabled={index === titles.length - 1} className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-dgb disabled:opacity-40" aria-label={`Turunkan ${title.name}`}>Turun</button>
                                    <button type="button" onClick={() => toggle(title)} className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-dgb hover:border-dgb">{title.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                                    <button type="button" onClick={() => remove(title)} disabled={title.participantIds.length > 0} className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40">Hapus</button>
                                </div>}
                            </div>
                            {canEdit && <TitleEditor title={title} />}
                            <div className="mt-5 border-t border-border pt-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Assignment peserta final</p>
                                {finalists.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Belum ada peserta pada tahap final.</p> : <div className="mt-3 grid gap-1 sm:grid-cols-2">
                                    {finalists.map((participant) => {
                                        const checked = title.participantIds.includes(participant.id)
                                        const disabled = !canEdit || (!checked && (!title.active || title.participantIds.length >= title.capacity))
                                        return <label key={participant.id} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-dgb-50/60"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => toggleAssignment(title, participant, event.target.checked)} className="size-4 accent-dgb" /><span className="min-w-0 flex-1">{participant.number}. {participant.name}</span><span className="text-xs font-semibold text-dgb-700">{participant.categoryCode}</span></label>
                                    })}
                                </div>}
                            </div>
                        </article>)}
                    </div>
                </>}
            </section>
        </>
    )
}

function TitleEditor({ title }: { title: Title }) {
    const form = useForm<TitleFormData>({ name: title.name, description: title.description ?? '', capacity: title.capacity, version: title.version })
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        form.put(`/admin/content/participants/titles/${title.id}`, { preserveScroll: true })
    }

    return <details className="mt-4 border-t border-border pt-4"><summary className="cursor-pointer text-sm font-semibold text-dgb-700">Edit detail gelar</summary><form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_auto] sm:items-end"><Field label="Nama gelar" error={form.errors.name}><input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} className="min-h-10 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb" /></Field><Field label="Deskripsi" error={form.errors.description}><input value={form.data.description} onChange={(event) => form.setData('description', event.target.value)} className="min-h-10 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb" /></Field><Field label="Slot" error={form.errors.capacity}><input type="number" min={Math.max(1, title.participantIds.length)} value={form.data.capacity} onChange={(event) => form.setData('capacity', Number(event.target.value))} className="min-h-10 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb" /></Field><button type="submit" disabled={form.processing} className="rounded-md border border-dgb px-3 py-2 text-sm font-semibold text-dgb hover:bg-dgb hover:text-white">Simpan</button>{form.errors.version && <p className="text-xs font-normal text-red-700 sm:col-span-4">{form.errors.version}</p>}</form></details>
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
    return <div className={`rounded-xl border p-4 ${accent ? 'border-fb-200 bg-fb-50/50' : 'border-dgb-100 bg-dgb-50/50'}`}><p className="text-xs font-medium text-muted-foreground">{label}</p><p className={`mt-1 font-montserrat text-xl font-semibold ${accent ? 'text-fb-700' : 'text-dgb-900'}`}>{value}</p></div>
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactElement }) {
    return <label className="grid gap-1 text-xs font-semibold text-dgb-900"><span>{label}</span>{children}{error && <span className="font-normal text-red-700">{error}</span>}</label>
}

Index.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
