import { Head, Link, useForm } from '@inertiajs/react'
import type { FormEvent, ReactElement } from 'react'
import AdminLayout from '../../../../layouts/AdminLayout'

type Category = {
    id: string
    code: string
    slug: string
    label: string
    displayOrder: number
    active: boolean
}

type Edition = {
    id: string
    year: number
    slug: string
    name: string
    timezone: string
    lifecycle: string
    version: number
    categories: Category[]
}

type Props = {
    editions: Edition[]
    canCreateEdition: boolean
    canCreateCategory: boolean
    canActivate: boolean
}

export default function Index({ editions, canCreateEdition, canCreateCategory, canActivate }: Props) {
    return <>
        <Head title="Edisi dan kategori" />
        <section><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Studio / taxonomy</p><h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Edisi dan kategori</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Atur periode penyelenggaraan dan kategori yang menjadi dasar konten publik.</p></div><Link href="/admin/content" className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Kembali ke konten</Link></div><div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"><div className="grid content-start gap-6"><EditionForm canCreate={canCreateEdition} /><CategoryForm editions={editions} canCreate={canCreateCategory} /></div><EditionList editions={editions} canActivate={canActivate} /></div></section>
    </>
}

Index.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>

function EditionForm({ canCreate }: { canCreate: boolean }) {
    const form = useForm({ year: new Date().getFullYear(), name: '' })
    const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); form.post('/admin/content/editions', { preserveScroll: true, onSuccess: () => form.reset() }) }

    return <section className="rounded-xl border border-border bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-fb-500">Periode baru</p><h2 className="mt-1 font-montserrat text-xl font-semibold text-dgb-900">Buat edisi</h2><p className="mt-2 text-sm text-muted-foreground">Edisi baru dimulai sebagai draft sampai diaktifkan.</p><form onSubmit={submit} className="mt-5 grid gap-4"><Field label="Tahun" error={form.errors.year}><input type="number" min={2020} max={2100} value={form.data.year} onChange={(event) => form.setData('year', Number(event.target.value))} disabled={!canCreate} className="input" /></Field><Field label="Nama edisi" error={form.errors.name}><input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} disabled={!canCreate} required className="input" placeholder="Pasanggiri 2027" /></Field><button type="submit" disabled={!canCreate || form.processing} className="button-primary w-fit">{form.processing ? 'Menyimpan' : 'Buat draft edisi'}</button></form></section>
}

function CategoryForm({ editions, canCreate }: { editions: Edition[]; canCreate: boolean }) {
    const form = useForm({ edition_id: editions[0]?.id ?? '', code: '', slug: '', label: '' })
    const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); form.post('/admin/content/editions/categories', { preserveScroll: true, onSuccess: () => form.reset('code', 'slug', 'label') }) }

    return <section className="rounded-xl border border-border bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-fb-500">Kategori peserta</p><h2 className="mt-1 font-montserrat text-xl font-semibold text-dgb-900">Tambah kategori</h2><p className="mt-2 text-sm text-muted-foreground">Kode yang tersedia: JD, MD, JR, dan MR.</p><form onSubmit={submit} className="mt-5 grid gap-4"><Field label="Edisi" error={form.errors.edition_id}><select value={form.data.edition_id} onChange={(event) => form.setData('edition_id', event.target.value)} disabled={!canCreate || editions.length === 0} className="input"><option value="">Pilih edisi</option>{editions.map((edition) => <option key={edition.id} value={edition.id}>{edition.year} · {edition.name}</option>)}</select></Field><Field label="Kode" error={form.errors.code}><select value={form.data.code} onChange={(event) => form.setData('code', event.target.value)} disabled={!canCreate} required className="input"><option value="">Pilih kode</option><option value="JD">JD</option><option value="MD">MD</option><option value="JR">JR</option><option value="MR">MR</option></select></Field><Field label="Label" error={form.errors.label}><input value={form.data.label} onChange={(event) => form.setData('label', event.target.value)} disabled={!canCreate} required className="input" placeholder="Mojang Dewasa" /></Field><Field label="Slug" error={form.errors.slug}><input value={form.data.slug} onChange={(event) => form.setData('slug', event.target.value)} disabled={!canCreate} required className="input" placeholder="mojang-dewasa" /></Field><button type="submit" disabled={!canCreate || form.processing || editions.length === 0} className="button-primary w-fit">{form.processing ? 'Menyimpan' : 'Tambah kategori'}</button></form></section>
}

function EditionList({ editions, canActivate }: { editions: Edition[]; canActivate: boolean }) {
    return <section className="rounded-xl border border-border bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-fb-500">Daftar tersimpan</p><h2 className="mt-1 font-montserrat text-xl font-semibold text-dgb-900">Edisi aktif dan draft</h2><div className="mt-5 grid gap-3">{editions.length === 0 ? <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Belum ada edisi.</p> : editions.map((edition) => <EditionRow key={edition.id} edition={edition} canActivate={canActivate} />)}</div></section>
}

function EditionRow({ edition, canActivate }: { edition: Edition; canActivate: boolean }) {
    const form = useForm({ reason: '' })
    const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); form.post(`/admin/content/editions/${edition.id}/activate`, { preserveScroll: true }) }

    return <article className="rounded-lg border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-montserrat text-lg font-semibold text-dgb-900">{edition.name}</h3><p className="mt-1 text-xs text-muted-foreground">{edition.year} · {edition.categories.length} kategori · versi {edition.version}</p></div><span className={edition.lifecycle === 'active' ? 'rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800' : 'rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground'}>{lifecycleLabel(edition.lifecycle)}</span></div><div className="mt-4 flex flex-wrap gap-2">{edition.categories.length === 0 ? <span className="text-xs text-muted-foreground">Belum ada kategori</span> : edition.categories.map((category) => <span key={category.id} className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground">{category.code} <span className="text-muted-foreground">{category.label}</span></span>)}</div>{edition.lifecycle !== 'active' && <form onSubmit={submit} className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><Field label="Alasan aktivasi" error={form.errors.reason}><input value={form.data.reason} onChange={(event) => form.setData('reason', event.target.value)} disabled={!canActivate} required className="input" placeholder="Edisi siap digunakan" /></Field><button type="submit" disabled={!canActivate || form.processing || edition.categories.length === 0} className="button-primary">{form.processing ? 'Menyimpan' : 'Aktifkan'}</button></form>}</article>
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactElement }) {
    return <label className="grid gap-1 text-xs font-semibold text-dgb-900">{label}{children}{error && <span className="font-normal text-red-700">{error}</span>}</label>
}

function lifecycleLabel(value: string): string {
    if (value === 'active') return 'Aktif'
    if (value === 'archived') return 'Arsip'

    return 'Draft'
}
