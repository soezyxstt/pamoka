import { Head, Link, router, useForm } from '@inertiajs/react'
import type { FormEvent, ReactElement } from 'react'
import AdminLayout from '../../../layouts/AdminLayout'

type MediaOption = {
    id: string
    url: string
    filename: string
    alt: string | null
}

type Edition = {
    id: string
    year: number
    name: string
    lifecycle: string
    slogan: string | null
    logoMediaId: string | null
    version: number
    logo: MediaOption | null
}

type Program = {
    id: string
    title: string
    description: string | null
    displayOrder: number
    active: boolean
}

type Props = {
    editionName: string
    edition: Edition | null
    programs: Program[]
    mediaOptions: MediaOption[]
    canEdit: boolean
}

export default function Index({ editionName, edition, programs, mediaOptions, canEdit }: Props) {
    return (
        <>
            <Head title="Identitas edisi" />
            <section>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Konten edisi</p>
                        <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Identitas edisi</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Kelola slogan, logo, dan program unggulan untuk {editionName}. Setiap perubahan tercatat pada audit.</p>
                    </div>
                    <Link href="/admin" className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Kembali ke dashboard</Link>
                </div>

                {edition === null ? (
                    <Empty text="Belum ada edisi aktif untuk dikelola." />
                ) : (
                    <>
                        <IdentityForm edition={edition} mediaOptions={mediaOptions} canEdit={canEdit} />
                        <ProgramSection editionName={edition.name} programs={programs} canEdit={canEdit} />
                    </>
                )}
            </section>
        </>
    )
}

Index.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>

function IdentityForm({ edition, mediaOptions, canEdit }: { edition: Edition; mediaOptions: MediaOption[]; canEdit: boolean }) {
    const form = useForm({
        logo_media_id: edition.logoMediaId ?? '',
        slogan: edition.slogan ?? '',
        version: edition.version,
    })

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        form.put('/admin/content/edition-settings', { preserveScroll: true })
    }

    return (
        <form onSubmit={submit} className="mt-8 rounded-xl border border-border bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-fb-500">Metadata</p>
                    <h2 className="mt-1 font-montserrat text-xl font-semibold text-dgb-900">{edition.name}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Tahun {edition.year} · status {lifecycleLabel(edition.lifecycle)} · versi {edition.version}</p>
                </div>
                {edition.logo && <img src={edition.logo.url} alt={edition.logo.alt ?? `Logo ${edition.name}`} className="size-16 rounded-lg border border-border object-contain p-1" />}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Slogan" error={form.errors.slogan}>
                    <textarea value={form.data.slogan} onChange={(event) => form.setData('slogan', event.target.value)} disabled={!canEdit} rows={3} className="textarea" placeholder="Nu Nyunda Tur Nyakola" />
                </Field>
                <Field label="Logo edisi" hint="Pilih gambar siap pakai." error={form.errors.logo_media_id}>
                    <select value={form.data.logo_media_id} onChange={(event) => form.setData('logo_media_id', event.target.value)} disabled={!canEdit} className="input">
                        <option value="">Tanpa logo khusus</option>
                        {mediaOptions.map((media) => <option key={media.id} value={media.id}>{media.filename}</option>)}
                    </select>
                </Field>
            </div>
            {form.errors.version && <p className="mt-3 text-xs text-red-700">{form.errors.version}</p>}
            <div className="mt-4 flex justify-end">
                <button type="submit" disabled={!canEdit || form.processing} className="button-primary">{form.processing ? 'Menyimpan' : 'Simpan identitas'}</button>
            </div>
        </form>
    )
}

function ProgramSection({ editionName, programs, canEdit }: { editionName: string; programs: Program[]; canEdit: boolean }) {
    const create = useForm({ title: '', description: '', display_order: programs.length, active: true })

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        create.post('/admin/content/edition-settings/programs', { preserveScroll: true, onSuccess: () => create.reset() })
    }

    const move = (program: Program, direction: -1 | 1) => {
        const current = programs.findIndex((item) => item.id === program.id)
        const target = current + direction
        if (!canEdit || current < 0 || target < 0 || target >= programs.length) return
        const next = [...programs]
        const [item] = next.splice(current, 1)
        if (!item) return
        next.splice(target, 0, item)
        router.post('/admin/content/edition-settings/programs/reorder', { program_ids: next.map((item) => item.id) }, { preserveScroll: true })
    }

    return (
        <section className="mt-6 rounded-xl border border-border bg-white p-5 sm:p-6">
            <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-fb-500">Program unggulan</p>
                <h2 className="mt-1 font-montserrat text-xl font-semibold text-dgb-900">Program pada {editionName}</h2>
            </div>
            {canEdit && <form onSubmit={submit} className="mt-5 grid gap-3 rounded-lg border border-dgb-100 bg-dgb-50/40 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_8rem_auto] sm:items-end"><Field label="Nama program" error={create.errors.title}><input value={create.data.title} onChange={(event) => create.setData('title', event.target.value)} required className="input" /></Field><Field label="Deskripsi" error={create.errors.description}><input value={create.data.description} onChange={(event) => create.setData('description', event.target.value)} className="input" /></Field><Field label="Urutan" error={create.errors.display_order}><input type="number" min={0} value={create.data.display_order} onChange={(event) => create.setData('display_order', Number(event.target.value))} className="input" /></Field><button type="submit" disabled={create.processing} className="button-primary">Tambah program</button></form>}
            <div className="mt-5 grid gap-3">
                {programs.length === 0 ? <Empty text="Belum ada program unggulan pada edisi ini." /> : programs.map((program, index) => <ProgramRow key={program.id} program={program} canEdit={canEdit} first={index === 0} last={index === programs.length - 1} onMove={move} />)}
            </div>
        </section>
    )
}

function ProgramRow({ program, canEdit, first, last, onMove }: { program: Program; canEdit: boolean; first: boolean; last: boolean; onMove: (program: Program, direction: -1 | 1) => void }) {
    const form = useForm({ title: program.title, description: program.description ?? '', display_order: program.displayOrder, active: program.active })
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        form.put(`/admin/content/edition-settings/programs/${program.id}`, { preserveScroll: true })
    }
    const remove = () => {
        if (window.confirm(`Hapus program ${program.title}?`)) router.delete(`/admin/content/edition-settings/programs/${program.id}`, { preserveScroll: true })
    }

    return <form onSubmit={submit} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_7rem_8rem_auto] sm:items-end"><div className="sm:col-span-2"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-md bg-dgb-50 px-2 py-1 text-xs font-semibold text-dgb-800">Program {program.displayOrder + 1}</span><span className={program.active ? 'rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800' : 'rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground'}>{program.active ? 'Aktif' : 'Nonaktif'}</span></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Nama program" error={form.errors.title}><input value={form.data.title} onChange={(event) => form.setData('title', event.target.value)} disabled={!canEdit} className="input" /></Field><Field label="Deskripsi" error={form.errors.description}><input value={form.data.description} onChange={(event) => form.setData('description', event.target.value)} disabled={!canEdit} className="input" /></Field></div></div><Field label="Urutan" error={form.errors.display_order}><input type="number" min={0} value={form.data.display_order} onChange={(event) => form.setData('display_order', Number(event.target.value))} disabled={!canEdit} className="input" /></Field><Field label="Status" error={form.errors.active}><select value={form.data.active ? '1' : '0'} onChange={(event) => form.setData('active', event.target.value === '1')} disabled={!canEdit} className="input"><option value="1">Aktif</option><option value="0">Nonaktif</option></select></Field><div className="flex flex-wrap gap-2 sm:justify-end"><button type="button" onClick={() => onMove(program, -1)} disabled={!canEdit || first} className="button-outline px-3" aria-label={`Pindahkan ${program.title} ke atas`}>↑</button><button type="button" onClick={() => onMove(program, 1)} disabled={!canEdit || last} className="button-outline px-3" aria-label={`Pindahkan ${program.title} ke bawah`}>↓</button><button type="submit" disabled={!canEdit || form.processing} className="button-primary">Simpan</button><button type="button" onClick={remove} disabled={!canEdit || form.processing} className="button-danger">Hapus</button></div>{form.errors.active && <p className="text-xs text-red-700 sm:col-span-5">{form.errors.active}</p>}</form>
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactElement }) {
    return <label className="grid gap-1 text-xs font-semibold text-dgb-900">{label}{hint && <span className="font-normal text-muted-foreground">{hint}</span>}{children}{error && <span className="font-normal text-red-700">{error}</span>}</label>
}

function Empty({ text }: { text: string }) {
    return <div className="mt-8 rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">{text}</div>
}

function lifecycleLabel(value: string): string {
    if (value === 'active') return 'Aktif'
    if (value === 'archived') return 'Arsip'

    return 'Draft'
}
