import { Head, Link, router, useForm } from '@inertiajs/react'
import type { FormEvent, ReactElement } from 'react'
import AdminLayout from '../../../layouts/AdminLayout'

type Period = {
    id: string
    label: string
    startYear: number
    endYear: number
    vision: string | null
    missions: string[]
    lifecycle: string
    version: number
    connectedEditionsCount: number
    unitCount: number
    memberCount: number
}

type SocialLink = {
    id?: string
    platform: string
    label: string | null
    url: string
    display_order?: number
    displayOrder?: number
}

type Person = {
    id: string
    name: string
    slug: string
    gender: string | null
    shortBio: string | null
    portraitMediaId: string | null
    portraitAsset: { id: string; url: string; filename: string; alt: string | null } | null
    socialLinks: SocialLink[]
    version: number
    membershipCount: number
}

type LegacyAssignment = {
    id: string
    personName: string
    title: string
    group: string
    termLabel: string | null
    isMapped: boolean
}

type MediaOption = { id: string; url: string; filename: string; alt: string | null }

type Props = {
    periods: Period[]
    people: Person[]
    legacyAssignments: LegacyAssignment[]
    mediaOptions: MediaOption[]
    canEdit: boolean
}

type PersonFormData = {
    name: string
    slug: string
    gender: string
    short_bio: string
    portrait_media_id: string
    social_links: SocialLink[]
    version?: number
}

const platforms = [
    ['instagram', 'Instagram'],
    ['linkedin', 'LinkedIn'],
    ['tiktok', 'TikTok'],
    ['youtube', 'YouTube'],
    ['facebook', 'Facebook'],
    ['x', 'X'],
    ['website', 'Situs web'],
    ['other', 'Lainnya'],
] as const

export default function Index({ periods, people, legacyAssignments, mediaOptions, canEdit }: Props) {
    return (
        <>
            <Head title="Kepengurusan" />
            <section>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Umum / organisasi</p>
                        <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Kepengurusan</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Kelola periode, struktur unit, dan direktori profil organisasi.</p>
                    </div>
                    <Link href="/admin" className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Kembali ke dashboard</Link>
                </div>

                {canEdit && <PeriodCreator />}

                <div className="mt-8 grid gap-3">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-fb-500">Periode</p>
                            <h2 className="mt-1 font-montserrat text-xl font-semibold text-dgb-900">Periode kepengurusan</h2>
                        </div>
                        <span className="text-sm text-muted-foreground">{periods.length} periode</span>
                    </div>
                    {periods.length === 0 ? <Empty text="Belum ada periode kepengurusan." /> : periods.map((period) => <PeriodCard key={`${period.id}:${period.version}`} period={period} canEdit={canEdit} />)}
                </div>

                <div className="mt-10">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-fb-500">Direktori bersama</p>
                            <h2 className="mt-1 font-montserrat text-xl font-semibold text-dgb-900">Profil orang</h2>
                        </div>
                        <span className="text-sm text-muted-foreground">{people.length} profil</span>
                    </div>
                    {canEdit && <PersonEditor person={null} mediaOptions={mediaOptions} />}
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        {people.length === 0 ? <Empty text="Belum ada profil orang." /> : people.map((person) => <PersonEditor key={`${person.id}:${person.version}`} person={person} mediaOptions={mediaOptions} />)}
                    </div>
                </div>

                <div className="mt-10">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-fb-500">Rekonsiliasi</p>
                        <h2 className="mt-1 font-montserrat text-xl font-semibold text-dgb-900">Penugasan lama</h2>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">Data lama dipertahankan sampai dipetakan ke unit modern.</p>
                    </div>
                    <div className="mt-4 grid gap-2">
                        {legacyAssignments.length === 0 ? <Empty text="Tidak ada penugasan lama yang perlu dipetakan." /> : legacyAssignments.map((assignment) => <div key={assignment.id} className="flex flex-col gap-2 rounded-xl border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-dgb-900">{assignment.personName} · {assignment.title}</p><p className="mt-1 text-xs text-muted-foreground">{assignment.group}{assignment.termLabel ? ` · ${assignment.termLabel}` : ''}</p></div><span className={`rounded-md px-2 py-1 text-xs font-semibold ${assignment.isMapped ? 'bg-emerald-50 text-emerald-800' : 'bg-fb-50 text-fb-800'}`}>{assignment.isMapped ? 'Sudah dipetakan' : 'Belum dipetakan'}</span></div>) }
                    </div>
                </div>
            </section>
        </>
    )
}

function PeriodCreator() {
    const form = useForm({ label: '', start_year: 2026, end_year: 2028, vision: '', missions: [''], lifecycle: 'draft' })

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        form.post('/admin/organization/periods', { preserveScroll: true, onSuccess: () => form.reset() })
    }

    return <details className="mt-8 rounded-xl border border-dgb-100 bg-dgb-50/40 p-5" open><summary className="cursor-pointer font-montserrat text-base font-semibold text-dgb-900">Tambah periode baru</summary><form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Label periode" error={form.errors.label}><input value={form.data.label} onChange={(event) => form.setData('label', event.target.value)} placeholder="Contoh: Kepengurusan 2026 sampai 2028" required className="input" /></Field><Field label="Status" error={form.errors.lifecycle}><select value={form.data.lifecycle} onChange={(event) => form.setData('lifecycle', event.target.value)} className="input"><option value="draft">Draft</option><option value="active">Aktif</option><option value="archived">Arsip</option></select></Field><Field label="Tahun mulai" error={form.errors.start_year}><input type="number" min={1900} value={form.data.start_year} onChange={(event) => form.setData('start_year', Number(event.target.value))} required className="input" /></Field><Field label="Tahun selesai" error={form.errors.end_year}><input type="number" min={1900} value={form.data.end_year} onChange={(event) => form.setData('end_year', Number(event.target.value))} required className="input" /></Field><Field label="Visi" error={form.errors.vision}><textarea value={form.data.vision} onChange={(event) => form.setData('vision', event.target.value)} rows={3} className="textarea" /></Field><Field label="Misi" hint="Satu poin per baris." error={form.errors.missions}><textarea value={form.data.missions.join('\n')} onChange={(event) => form.setData('missions', event.target.value.split('\n'))} rows={3} className="textarea" /></Field><div className="sm:col-span-2"><button type="submit" disabled={form.processing} className="button-primary">{form.processing ? 'Menyimpan' : 'Tambah periode'}</button></div></form></details>
}

function PeriodCard({ period, canEdit }: { period: Period; canEdit: boolean }) {
    return <article className="rounded-xl border border-border bg-white p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-dgb-50 px-2 py-1 text-xs font-semibold text-dgb-800">{lifecycleLabel(period.lifecycle)}</span><span className="text-xs text-muted-foreground">{period.startYear} sampai {period.endYear}</span></div><h3 className="mt-2 font-montserrat text-lg font-semibold text-dgb-900">{period.label}</h3>{period.vision && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{period.vision}</p>}</div><Link href={`/admin/organization/periods/${period.id}`} className="inline-flex min-h-10 items-center justify-center rounded-md bg-dgb px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-dgb-600">Buka detail</Link></div><div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center text-xs"><Stat label="Edisi" value={period.connectedEditionsCount} /><Stat label="Unit" value={period.unitCount} /><Stat label="Penugasan" value={period.memberCount} /></div>{canEdit && <p className="mt-3 text-xs text-muted-foreground">Versi {period.version}. Perubahan periode dilakukan dari halaman detail.</p>}</article>
}

function PersonEditor({ person, mediaOptions }: { person: Person | null; mediaOptions: MediaOption[] }) {
    const form = useForm<PersonFormData>({ name: person?.name ?? '', slug: person?.slug ?? '', gender: person?.gender ?? '', short_bio: person?.shortBio ?? '', portrait_media_id: person?.portraitMediaId ?? '', social_links: person?.socialLinks.map((link, index) => ({ ...link, display_order: link.displayOrder ?? link.display_order ?? index })) ?? [], version: person?.version })
    const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (person) form.put(`/admin/organization/people/${person.id}`, { preserveScroll: true }); else form.post('/admin/organization/people', { preserveScroll: true, onSuccess: () => form.reset() }) }
    const addLink = () => form.setData('social_links', [...form.data.social_links, { platform: 'instagram', label: null, url: '', display_order: form.data.social_links.length }])
    const updateLink = (index: number, value: Partial<SocialLink>) => form.setData('social_links', form.data.social_links.map((link, linkIndex) => linkIndex === index ? { ...link, ...value } : link))
    const removeLink = (index: number) => form.setData('social_links', form.data.social_links.filter((_, linkIndex) => linkIndex !== index).map((link, linkIndex) => ({ ...link, display_order: linkIndex })))
    const selectedPortrait = mediaOptions.find((media) => media.id === form.data.portrait_media_id)
    const errors = Object.values(form.errors)

    return <article className={`rounded-xl border bg-white p-4 ${person ? 'border-border' : 'mt-4 border-dgb-100'}`}><div className="flex items-start gap-3"><div className="size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-dgb-50/50">{(selectedPortrait?.url ?? person?.portraitAsset?.url) ? <img src={selectedPortrait?.url ?? person?.portraitAsset?.url} alt={selectedPortrait?.alt ?? person?.portraitAsset?.alt ?? person?.name ?? 'Portrait'} className="size-full object-cover" /> : <div className="grid size-full place-items-center text-[10px] font-semibold text-dgb-700">Tanpa foto</div>}</div><div className="min-w-0 flex-1"><h3 className="font-montserrat text-base font-semibold text-dgb-900">{person ? person.name : 'Profil baru'}</h3>{person && <p className="mt-1 text-xs text-muted-foreground">/{person.slug} · {person.membershipCount} penugasan · versi {person.version}</p>}</div></div><form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Nama lengkap" error={form.errors.name}><input value={form.data.name} onChange={(event) => { const name = event.target.value; form.setData('name', name); if (!person) form.setData('slug', slugify(name)) }} required className="input" /></Field><Field label="Slug" error={form.errors.slug}><input value={form.data.slug} onChange={(event) => form.setData('slug', slugify(event.target.value))} className="input" /></Field><Field label="Gender" error={form.errors.gender}><select value={form.data.gender} onChange={(event) => form.setData('gender', event.target.value)} className="input"><option value="">Tidak diisi</option><option value="L">L</option><option value="P">P</option></select></Field><Field label="Foto portrait" error={form.errors.portrait_media_id}><select value={form.data.portrait_media_id} onChange={(event) => form.setData('portrait_media_id', event.target.value)} className="input"><option value="">Tanpa foto</option>{mediaOptions.map((media) => <option key={media.id} value={media.id}>{media.filename}</option>)}</select></Field><Field label="Bio singkat" error={form.errors.short_bio}><textarea value={form.data.short_bio} onChange={(event) => form.setData('short_bio', event.target.value)} rows={3} className="textarea sm:col-span-2" /></Field><div className="sm:col-span-2"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-dgb-900">Tautan sosial</span><button type="button" onClick={addLink} className="button-outline px-3 py-1.5 text-xs">Tambah tautan</button></div><div className="mt-3 grid gap-2">{form.data.social_links.length === 0 ? <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">Belum ada tautan sosial.</p> : form.data.social_links.map((link, index) => <div key={link.id ?? index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[8rem_1fr_auto]"><select value={link.platform} onChange={(event) => updateLink(index, { platform: event.target.value })} className="input"><option value="">Pilih platform</option>{platforms.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><div className="grid gap-2"><input value={link.url} onChange={(event) => updateLink(index, { url: event.target.value })} placeholder="https://" className="input" />{link.platform === 'other' && <input value={link.label ?? ''} onChange={(event) => updateLink(index, { label: event.target.value })} placeholder="Nama platform" className="input" />}{form.errors[`social_links.${index}.url`] && <span className="text-xs font-normal text-red-700">{form.errors[`social_links.${index}.url`]}</span>}{form.errors[`social_links.${index}.label`] && <span className="text-xs font-normal text-red-700">{form.errors[`social_links.${index}.label`]}</span>}</div><button type="button" onClick={() => removeLink(index)} className="button-danger">Hapus</button></div>)}</div></div><div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2"><div>{person && <button type="button" onClick={() => { if (window.confirm('Hapus profil ini?')) router.delete(`/admin/organization/people/${person.id}`, { data: { version: person.version }, preserveScroll: true }) }} disabled={form.processing} className="button-danger">Hapus profil</button>}</div><button type="submit" disabled={form.processing} className="button-primary">{form.processing ? 'Menyimpan' : person ? 'Simpan profil' : 'Tambah profil'}</button></div>{errors.length > 0 && <div className="rounded-md bg-red-50 p-3 text-xs text-red-800 sm:col-span-2"><ul className="grid gap-1">{errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></div>}</form></article>
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactElement }) {
    return <label className="grid gap-1 text-xs font-semibold text-dgb-900"><span>{label}</span>{hint && <span className="font-normal text-muted-foreground">{hint}</span>}{children}{error && <span className="font-normal text-red-700">{error}</span>}</label>
}

function Stat({ label, value }: { label: string; value: number }) {
    return <div className="rounded-md bg-dgb-50/60 p-3"><p className="text-muted-foreground">{label}</p><p className="mt-1 font-montserrat text-lg font-semibold text-dgb-900">{value}</p></div>
}

function Empty({ text }: { text: string }) {
    return <div className="rounded-xl border border-dashed border-border bg-white p-7 text-center text-sm text-muted-foreground">{text}</div>
}

function lifecycleLabel(value: string): string {
    if (value === 'active') return 'Aktif'
    if (value === 'archived') return 'Arsip'

    return 'Draft'
}

function slugify(value: string): string {
    return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
}

Index.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
