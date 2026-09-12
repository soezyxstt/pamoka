import { Head, Link, useForm } from '@inertiajs/react'
import type { FormEvent, ReactElement } from 'react'
import AdminLayout from '../../../layouts/AdminLayout'

type Sponsor = {
    id: string
    name: string
    tier: string
    website: string | null
    logoMediaId: string | null
    displayOrder: number
    active: boolean
    version: number
    logo: { url: string; filename: string; alt: string | null } | null
}

type MediaOption = { id: string; url: string; filename: string; alt: string | null }

type FormData = {
    name: string
    tier: string
    website: string
    logo_media_id: string
    display_order: number
    active: boolean
    version?: number
}

type Props = {
    editionName: string
    sponsor: Sponsor | null
    logoMediaOptions: MediaOption[]
    canEdit: boolean
    canPublish: boolean
}

export default function Form({ editionName, sponsor, logoMediaOptions, canEdit, canPublish }: Props) {
    const form = useForm<FormData>({
        name: sponsor?.name ?? '',
        tier: sponsor?.tier ?? 'utama',
        website: sponsor?.website ?? '',
        logo_media_id: sponsor?.logoMediaId ?? '',
        display_order: sponsor?.displayOrder ?? 0,
        active: sponsor?.active ?? false,
        version: sponsor?.version,
    })

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canEdit) return
        if (sponsor) form.put(`/admin/content/sponsors/${sponsor.id}`)
        else form.post('/admin/content/sponsors')
    }

    const toggle = () => {
        if (!sponsor || !canEdit || form.processing) return
        form.post(`/admin/content/sponsors/${sponsor.id}/toggle`, { preserveScroll: true })
    }

    const remove = () => {
        if (!sponsor || !canEdit || form.processing || !window.confirm('Hapus sponsor ini?')) return
        form.delete(`/admin/content/sponsors/${sponsor.id}`)
    }

    const selectedLogo = logoMediaOptions.find((media) => media.id === form.data.logo_media_id)
    const errors = Object.values(form.errors)

    return (
        <>
            <Head title={sponsor ? `Edit ${sponsor.name}` : 'Tambah sponsor'} />
            <section>
                <Link href="/admin/content/sponsors" className="text-sm font-semibold text-dgb transition-colors hover:text-fb-500">Kembali ke daftar sponsor</Link>
                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Konten edisi</p>
                        <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">{sponsor ? 'Edit sponsor' : 'Tambah sponsor'}</h1>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">Edisi {editionName}. Logo diambil dari aset gambar yang sudah siap.</p>
                    </div>
                    {sponsor && <span className="rounded-md bg-dgb-50 px-3 py-2 text-sm font-semibold text-dgb-800">{sponsor.active ? 'Aktif' : 'Nonaktif'} · versi {sponsor.version}</span>}
                </div>

                {errors.length > 0 && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert"><ul className="grid gap-1">{errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></div>}

                <form className="mt-8 grid gap-6" onSubmit={submit}>
                    <div className="rounded-xl border border-border bg-white p-5 sm:p-6">
                        <div className="grid gap-5 sm:grid-cols-2">
                            <Field label="Nama sponsor" error={form.errors.name}>
                                <input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} disabled={!canEdit} required minLength={2} className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" />
                            </Field>
                            <Field label="Tingkat" error={form.errors.tier}>
                                <select value={form.data.tier} onChange={(event) => form.setData('tier', event.target.value)} disabled={!canEdit} className="min-h-11 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb disabled:bg-muted">
                                    <option value="utama">Utama</option>
                                    <option value="pendukung">Pendukung</option>
                                    <option value="pendamping">Pendamping</option>
                                    <option value="pelengkap">Pelengkap</option>
                                </select>
                            </Field>
                            <Field label="Website" hint="Opsional, gunakan URL https." error={form.errors.website}>
                                <input value={form.data.website} onChange={(event) => form.setData('website', event.target.value)} disabled={!canEdit} type="text" inputMode="url" placeholder="https://contoh.id" className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" />
                            </Field>
                            <Field label="Urutan tampil" error={form.errors.display_order}>
                                <input value={form.data.display_order} onChange={(event) => form.setData('display_order', Number(event.target.value))} disabled={!canEdit} type="number" min={0} step={1} className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" />
                            </Field>
                            <Field label="Logo" hint="Hanya gambar dengan lifecycle siap." error={form.errors.logo_media_id}>
                                <select value={form.data.logo_media_id} onChange={(event) => form.setData('logo_media_id', event.target.value)} disabled={!canEdit} className="min-h-11 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb disabled:bg-muted">
                                    <option value="">Tanpa logo</option>
                                    {logoMediaOptions.map((media) => <option key={media.id} value={media.id}>{media.filename}</option>)}
                                </select>
                            </Field>
                            <div className="flex items-end">
                                {selectedLogo && <img src={selectedLogo.url} alt={selectedLogo.alt ?? selectedLogo.filename} className="h-24 w-40 rounded-lg border border-border object-contain p-2" />}
                            </div>
                        </div>
                        {sponsor && canPublish && (
                            <label className="mt-5 flex items-center gap-3 border-t border-border pt-5 text-sm font-semibold text-dgb-900">
                                <input type="checkbox" checked={form.data.active} onChange={(event) => form.setData('active', event.target.checked)} disabled={!canEdit} className="size-4 accent-dgb" />
                                Tampilkan sponsor pada halaman publik
                            </label>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>{sponsor && canEdit && <button type="button" onClick={remove} disabled={form.processing} className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60">Hapus</button>}</div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                            <Link href="/admin/content/sponsors" className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Batal</Link>
                            {sponsor && canEdit && <button type="button" onClick={toggle} disabled={form.processing || (!sponsor.active && !canPublish)} className="inline-flex min-h-10 items-center justify-center rounded-md border border-fb px-4 py-2 text-sm font-semibold text-dgb-900 transition-colors hover:bg-fb-100">{sponsor.active ? 'Nonaktifkan' : canPublish ? 'Aktifkan' : 'Perlu izin penerbitan'}</button>}
                            {canEdit && <button type="submit" disabled={form.processing} className="inline-flex min-h-10 items-center justify-center rounded-md bg-dgb px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-dgb-600 disabled:opacity-60">{form.processing ? 'Menyimpan' : 'Simpan sponsor'}</button>}
                        </div>
                    </div>
                </form>
            </section>
        </>
    )
}

Form.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactElement }) {
    return <label className="grid gap-1 text-xs font-semibold text-dgb-900"><span>{label}</span>{hint && <span className="font-normal text-muted-foreground">{hint}</span>}{children}{error && <span className="font-normal text-red-700">{error}</span>}</label>
}
