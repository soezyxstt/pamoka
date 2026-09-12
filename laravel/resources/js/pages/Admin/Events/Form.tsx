import { Head, Link, useForm } from '@inertiajs/react'
import type { FormEvent, ReactElement } from 'react'
import AdminLayout from '../../../layouts/AdminLayout'

type Event = {
    id: string
    label: string
    slug: string
    description: string | null
    heroMediaId: string | null
    displayOrder: number
    active: boolean
    version: number
    hero: { url: string; alt: string | null } | null
}

type MediaOption = { id: string; url: string; filename: string; alt: string | null }

type FormData = {
    label: string
    slug: string
    description: string
    hero_media_id: string
    display_order: number
    active: boolean
    version?: number
}

type Props = {
    editionName: string
    event: Event | null
    heroMediaOptions: MediaOption[]
    canEdit: boolean
}

export default function Form({ editionName, event, heroMediaOptions, canEdit }: Props) {
    const form = useForm<FormData>({
        label: event?.label ?? '',
        slug: event?.slug ?? '',
        description: event?.description ?? '',
        hero_media_id: event?.heroMediaId ?? '',
        display_order: event?.displayOrder ?? 0,
        active: event?.active ?? true,
        version: event?.version,
    })

    const submit = (submitEvent: FormEvent<HTMLFormElement>) => {
        submitEvent.preventDefault()
        if (!canEdit) return
        if (event) form.put(`/admin/content/events/${event.id}`)
        else form.post('/admin/content/events')
    }

    const remove = () => {
        if (!event || !canEdit || form.processing || !window.confirm('Hapus acara ini?')) return
        form.delete(`/admin/content/events/${event.id}`)
    }

    const selectedHero = heroMediaOptions.find((media) => media.id === form.data.hero_media_id)
    const errors = Object.values(form.errors)

    return (
        <>
            <Head title={event ? `Edit ${event.label}` : 'Tambah acara'} />
            <section>
                <Link href="/admin/content/events" className="text-sm font-semibold text-dgb transition-colors hover:text-fb-500">Kembali ke daftar acara</Link>
                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Konten edisi</p>
                        <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">{event ? 'Edit acara' : 'Tambah acara'}</h1>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">Edisi {editionName}. Slug dipakai pada route dokumentasi publik.</p>
                    </div>
                    {event && <span className="rounded-md bg-dgb-50 px-3 py-2 text-sm font-semibold text-dgb-800">{event.active ? 'Aktif' : 'Nonaktif'} · versi {event.version}</span>}
                </div>

                {errors.length > 0 && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert"><ul className="grid gap-1">{errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></div>}

                <form className="mt-8 grid gap-6" onSubmit={submit}>
                    <div className="rounded-xl border border-border bg-white p-5 sm:p-6">
                        <div className="grid gap-5">
                            <Field label="Nama acara" error={form.errors.label}><input value={form.data.label} onChange={(input) => { const label = input.target.value; form.setData('label', label); if (!event) form.setData('slug', slugify(label)) }} disabled={!canEdit} required minLength={2} className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" /></Field>
                            <Field label="Slug" hint="Huruf kecil, angka, dan tanda minus." error={form.errors.slug}><input value={form.data.slug} onChange={(input) => form.setData('slug', slugify(input.target.value))} disabled={!canEdit} required className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" /></Field>
                            <Field label="Deskripsi" error={form.errors.description}><textarea value={form.data.description} onChange={(input) => form.setData('description', input.target.value)} disabled={!canEdit} rows={5} className="rounded-md border border-border px-3 py-2 text-sm leading-6 outline-none focus:border-dgb disabled:bg-muted" /></Field>
                            <div className="grid gap-5 sm:grid-cols-2">
                                <Field label="Foto hero" hint="Opsional, hanya gambar siap pakai." error={form.errors.hero_media_id}><select value={form.data.hero_media_id} onChange={(input) => form.setData('hero_media_id', input.target.value)} disabled={!canEdit} className="min-h-11 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb disabled:bg-muted"><option value="">Tanpa foto hero</option>{heroMediaOptions.map((media) => <option key={media.id} value={media.id}>{media.filename}</option>)}</select></Field>
                                <Field label="Urutan tampil" error={form.errors.display_order}><input value={form.data.display_order} onChange={(input) => form.setData('display_order', Number(input.target.value))} disabled={!canEdit} type="number" min={0} step={1} className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" /></Field>
                            </div>
                            {selectedHero && <img src={selectedHero.url} alt={selectedHero.alt ?? selectedHero.filename} className="h-48 w-full rounded-lg border border-border object-cover" />}
                            {event && <label className="flex items-center gap-3 border-t border-border pt-5 text-sm font-semibold text-dgb-900"><input type="checkbox" checked={form.data.active} onChange={(input) => form.setData('active', input.target.checked)} disabled={!canEdit} className="size-4 accent-dgb" />Tampilkan acara pada halaman publik</label>}
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div>{event && canEdit && <button type="button" onClick={remove} disabled={form.processing} className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60">Hapus</button>}</div><div className="flex flex-wrap gap-2 sm:justify-end"><Link href="/admin/content/events" className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Batal</Link>{canEdit && <button type="submit" disabled={form.processing} className="inline-flex min-h-10 items-center justify-center rounded-md bg-dgb px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-dgb-600 disabled:opacity-60">{form.processing ? 'Menyimpan' : 'Simpan acara'}</button>}</div></div>
                </form>
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
