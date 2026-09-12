import { Head, Link, useForm } from '@inertiajs/react'
import type { FormEvent, ReactElement } from 'react'
import AdminLayout from '../../../layouts/AdminLayout'

type Category = { id: string; code: string; label: string; active: boolean }
type Stage = { id: string; name: string; slug: string; lifecycle: string; finalStage: boolean }
type Asset = { id: string; url: string; filename: string; mimeType: string; bytes: number; alt: string | null; decorative: boolean; lifecycle: string }
type Achievement = { id?: string; text: string; displayOrder: number }
type SocialLink = { id?: string; platform: string; label: string | null; url: string; displayOrder: number }
type MediaItem = { id?: string; role: string; mediaId: string; caption: string | null; displayOrder: number; active: boolean; asset?: Asset | null }
type Participant = {
    id: string
    categoryId: string
    categoryCode: string
    categoryLabel: string
    number: number
    name: string
    slug: string
    currentStageName: string | null
    selectionStatus: string
    bio: string | null
    paymentUrl: string | null
    qrisMediaId: string | null
    qrisAsset: Asset | null
    displayOrder: number
    active: boolean
    version: number
    achievements: Achievement[]
    socialLinks: SocialLink[]
    media: MediaItem[]
    titles: { id: string; name: string }[]
}
type Props = {
    edition: { id: string; year: number; name: string; lifecycle: string }
    categories: Category[]
    stages: Stage[]
    firstStage: { id: string; name: string; lifecycle: string } | null
    participant: Participant | null
    mediaOptions: Asset[]
    canEdit: boolean
    canManageMedia: boolean
}
type IdentityData = {
    category_id: string
    number: number
    name: string
    slug: string
    bio: string
    display_order: number
    active: boolean
    version?: number
    reason: string
}
type ProfileData = {
    version: number
    payment_url: string
    qris_media_id: string
    achievements: Achievement[]
    social_links: SocialLink[]
    media?: MediaItem[]
    reason: string
}

const roles = [
    { value: 'closeup', label: 'Closeup' },
    { value: 'full_body', label: 'Full body' },
    { value: 'detail', label: 'Detail busana' },
    { value: 'karantina', label: 'Karantina' },
    { value: 'other', label: 'Lainnya' },
]
const platforms = [
    { value: 'instagram', label: 'Instagram' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'x', label: 'X' },
    { value: 'website', label: 'Website' },
    { value: 'other', label: 'Lainnya' },
]

export default function Form({ edition, categories, stages, firstStage, participant, mediaOptions, canEdit, canManageMedia }: Props) {
    const identity = useForm<IdentityData>({
        category_id: participant?.categoryId ?? categories[0]?.id ?? '',
        number: participant?.number ?? 1,
        name: participant?.name ?? '',
        slug: participant?.slug ?? '',
        bio: participant?.bio ?? '',
        display_order: participant?.displayOrder ?? 1,
        active: participant?.active ?? true,
        version: participant?.version,
        reason: '',
    })
    const profile = useForm<ProfileData>({
        version: participant?.version ?? 1,
        payment_url: participant?.paymentUrl ?? '',
        qris_media_id: participant?.qrisMediaId ?? '',
        achievements: participant?.achievements ?? [],
        social_links: participant?.socialLinks ?? [],
        media: canManageMedia ? participant?.media ?? [] : undefined,
        reason: '',
    })

    const errors = [...Object.values(identity.errors), ...Object.values(profile.errors)]
    const selectedQris = mediaOptions.find((asset) => asset.id === profile.data.qris_media_id)

    const submitIdentity = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canEdit) return
        if (participant) identity.put(`/admin/content/participants/${participant.id}`)
        else identity.post('/admin/content/participants')
    }

    const submitProfile = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!participant || !canEdit) return
        profile.post(`/admin/content/participants/${participant.id}/profile`, { preserveScroll: true })
    }

    const remove = () => {
        if (!participant || !canEdit || !window.confirm('Hapus pendaftar ini?')) return
        identity.delete(`/admin/content/participants/${participant.id}`)
    }

    const addAchievement = () => {
        profile.setData('achievements', [...profile.data.achievements, { text: '', displayOrder: profile.data.achievements.length }])
    }
    const updateAchievement = (index: number, text: string) => {
        profile.setData('achievements', profile.data.achievements.map((item, itemIndex) => itemIndex === index ? { ...item, text } : item))
    }
    const removeAchievement = (index: number) => {
        profile.setData('achievements', profile.data.achievements.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, displayOrder: itemIndex })))
    }
    const addSocialLink = () => {
        profile.setData('social_links', [...profile.data.social_links, { platform: 'instagram', label: null, url: '', displayOrder: profile.data.social_links.length }])
    }
    const updateSocialLink = (index: number, value: Partial<SocialLink>) => {
        profile.setData('social_links', profile.data.social_links.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item))
    }
    const removeSocialLink = (index: number) => {
        profile.setData('social_links', profile.data.social_links.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, displayOrder: itemIndex })))
    }
    const addMedia = () => {
        if (!profile.data.media || mediaOptions.length === 0) return
        profile.setData('media', [...profile.data.media, { role: 'closeup', mediaId: mediaOptions[0].id, caption: null, displayOrder: profile.data.media.length, active: true }])
    }
    const updateMedia = (index: number, value: Partial<MediaItem>) => {
        if (!profile.data.media) return
        profile.setData('media', profile.data.media.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item))
    }
    const removeMedia = (index: number) => {
        if (!profile.data.media) return
        profile.setData('media', profile.data.media.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, displayOrder: itemIndex })))
    }

    return (
        <>
            <Head title={participant ? `Edit ${participant.name}` : 'Tambah pendaftar'} />
            <section>
                <Link href="/admin/content/participants" className="text-sm font-semibold text-dgb transition-colors hover:text-fb-500">Kembali ke daftar peserta</Link>
                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Konten edisi</p>
                        <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">{participant ? 'Edit profil peserta' : 'Tambah pendaftar'}</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Edisi {edition.name}. Data tahap seleksi dikelola pada workspace seleksi dan tidak diubah dari form identitas.</p>
                    </div>
                    {participant && <span className="rounded-md bg-dgb-50 px-3 py-2 text-sm font-semibold text-dgb-800">{participant.active ? 'Aktif' : 'Nonaktif'} · versi {participant.version}</span>}
                </div>

                {errors.length > 0 && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert"><ul className="grid gap-1">{errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></div>}

                {!participant && <div className="mt-8 rounded-xl border border-border bg-white p-5 sm:p-6"><h2 className="font-montserrat text-lg font-semibold text-dgb-900">Penempatan pendaftar</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Pendaftar baru otomatis masuk ke tahap pertama dengan status terdaftar.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Tahap seleksi awal"><input value={firstStage ? `${firstStage.name} · ${firstStage.lifecycle}` : 'Tahap belum tersedia'} readOnly disabled className="min-h-11 rounded-md border border-border bg-muted px-3 text-sm" /></Field><Field label="Status awal"><input value="Terdaftar" readOnly disabled className="min-h-11 rounded-md border border-border bg-muted px-3 text-sm" /></Field></div></div>}

                {!participant && firstStage === null ? <div className="mt-8 rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">Buat tahap seleksi pertama sebelum menambahkan pendaftar.</div> : <form className="mt-8 grid gap-6" onSubmit={submitIdentity}>
                    <div className="rounded-xl border border-border bg-white p-5 sm:p-6">
                        <h2 className="font-montserrat text-lg font-semibold text-dgb-900">Identitas peserta</h2>
                        <div className="mt-5 grid gap-5">
                            <div className="grid gap-5 sm:grid-cols-2"><Field label="Kategori" error={identity.errors.category_id}><select value={identity.data.category_id} onChange={(event) => identity.setData('category_id', event.target.value)} disabled={!canEdit} className="min-h-11 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb disabled:bg-muted">{categories.map((category) => <option key={category.id} value={category.id}>{category.code} · {category.label}{category.active ? '' : ' · nonaktif'}</option>)}</select></Field><Field label="Nomor peserta" hint="Nomor harus unik pada kategori ini." error={identity.errors.number}><input value={identity.data.number} onChange={(event) => identity.setData('number', Number(event.target.value))} disabled={!canEdit} type="number" min={1} step={1} required className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" /></Field></div>
                            <div className="grid gap-5 sm:grid-cols-2"><Field label="Nama lengkap" error={identity.errors.name}><input value={identity.data.name} onChange={(event) => { const name = event.target.value; identity.setData('name', name); if (!participant) identity.setData('slug', slugify(name)) }} disabled={!canEdit} required minLength={2} className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" /></Field><Field label="Slug profil" hint="Dibuat otomatis dari nama saat pendaftar baru." error={identity.errors.slug}><input value={identity.data.slug} onChange={(event) => identity.setData('slug', slugify(event.target.value))} disabled={!canEdit} required className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" /></Field></div>
                            <div className="grid gap-5 sm:grid-cols-2"><Field label="Urutan tampil" error={identity.errors.display_order}><input value={identity.data.display_order} onChange={(event) => identity.setData('display_order', Number(event.target.value))} disabled={!canEdit} type="number" min={0} step={1} className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" /></Field>{participant ? <Field label="Tahap seleksi" hint="Hanya berubah dari workspace seleksi."><input value={participant.currentStageName ?? 'Tahap belum terhubung'} readOnly disabled className="min-h-11 rounded-md border border-border bg-muted px-3 text-sm" /></Field> : <Field label="Tahap seleksi" hint="Tahap pertama dipilih otomatis."><input value={firstStage?.name ?? 'Tahap belum tersedia'} readOnly disabled className="min-h-11 rounded-md border border-border bg-muted px-3 text-sm" /></Field>}</div>
                            <Field label="Bio singkat" error={identity.errors.bio}><textarea value={identity.data.bio} onChange={(event) => identity.setData('bio', event.target.value)} disabled={!canEdit} rows={5} className="rounded-md border border-border px-3 py-2 text-sm leading-6 outline-none focus:border-dgb disabled:bg-muted" /></Field>
                            {participant && <><label className="flex items-center gap-3 border-t border-border pt-5 text-sm font-semibold text-dgb-900"><input type="checkbox" checked={identity.data.active} onChange={(event) => identity.setData('active', event.target.checked)} disabled={!canEdit} className="size-4 accent-dgb" />Tampilkan peserta pada daftar publik</label><Field label="Alasan perubahan" hint="Opsional, dicatat pada audit." error={identity.errors.reason}><input value={identity.data.reason} onChange={(event) => identity.setData('reason', event.target.value)} disabled={!canEdit} className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" /></Field></>}
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div>{participant && canEdit && <button type="button" onClick={remove} disabled={identity.processing} className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60">Hapus pendaftar</button>}</div><div className="flex flex-wrap gap-2 sm:justify-end"><Link href="/admin/content/participants" className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Batal</Link>{canEdit && <button type="submit" disabled={identity.processing || (!participant && firstStage === null)} className="inline-flex min-h-10 items-center justify-center rounded-md bg-dgb px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-dgb-600 disabled:opacity-60">{identity.processing ? 'Menyimpan' : participant ? 'Simpan identitas' : 'Simpan pendaftar'}</button>}</div></div>
                </form>}

                {participant && <form className="mt-8 grid gap-6" onSubmit={submitProfile}>
                    <div className="rounded-xl border border-border bg-white p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-montserrat text-lg font-semibold text-dgb-900">Prestasi</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Simpan daftar prestasi yang akan dibaca pada profil publik.</p></div><button type="button" onClick={addAchievement} disabled={!canEdit} className="rounded-md border border-dgb px-3 py-2 text-sm font-semibold text-dgb hover:bg-dgb hover:text-white">Tambah prestasi</button></div><div className="mt-5 grid gap-3">{profile.data.achievements.length === 0 ? <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">Belum ada prestasi.</p> : profile.data.achievements.map((item, index) => <div key={item.id ?? index} className="flex gap-2"><input value={item.text} onChange={(event) => updateAchievement(index, event.target.value)} disabled={!canEdit} placeholder="Contoh: Juara pidato tingkat kabupaten" className="min-h-11 min-w-0 flex-1 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" /><button type="button" onClick={() => removeAchievement(index)} disabled={!canEdit} className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Hapus</button></div>)}</div></div>

                    <div className="rounded-xl border border-border bg-white p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-montserrat text-lg font-semibold text-dgb-900">Tautan sosial</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Tautan harus menggunakan alamat http atau https.</p></div><button type="button" onClick={addSocialLink} disabled={!canEdit} className="rounded-md border border-dgb px-3 py-2 text-sm font-semibold text-dgb hover:bg-dgb hover:text-white">Tambah tautan</button></div><div className="mt-5 grid gap-4">{profile.data.social_links.length === 0 ? <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">Belum ada tautan sosial.</p> : profile.data.social_links.map((item, index) => <div key={item.id ?? index} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[10rem_1fr_auto]"><select value={item.platform} onChange={(event) => updateSocialLink(index, { platform: event.target.value })} disabled={!canEdit} className="min-h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb disabled:bg-muted">{platforms.map((platform) => <option key={platform.value} value={platform.value}>{platform.label}</option>)}</select><div className="grid gap-2"><input value={item.url} onChange={(event) => updateSocialLink(index, { url: event.target.value })} disabled={!canEdit} placeholder="https://" className="min-h-10 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" />{item.platform === 'other' && <input value={item.label ?? ''} onChange={(event) => updateSocialLink(index, { label: event.target.value })} disabled={!canEdit} placeholder="Nama platform" className="min-h-10 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" />}</div><button type="button" onClick={() => removeSocialLink(index)} disabled={!canEdit} className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Hapus</button></div>)}</div></div>

                    <div className="rounded-xl border border-border bg-white p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-montserrat text-lg font-semibold text-dgb-900">Pembayaran dan QRIS</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">QRIS memakai aset gambar siap dari pustaka media.</p></div></div><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field label="URL pembayaran" hint="Opsional, gunakan URL http atau https." error={profile.errors.payment_url}><input value={profile.data.payment_url} onChange={(event) => profile.setData('payment_url', event.target.value)} disabled={!canEdit} inputMode="url" className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" /></Field><Field label="QRIS" error={profile.errors.qris_media_id}><select value={profile.data.qris_media_id} onChange={(event) => profile.setData('qris_media_id', event.target.value)} disabled={!canEdit} className="min-h-11 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb disabled:bg-muted"><option value="">Tanpa QRIS</option>{mediaOptions.map((asset) => <option key={asset.id} value={asset.id}>{asset.filename}</option>)}</select></Field></div>{selectedQris && <img src={selectedQris.url} alt={selectedQris.alt ?? 'QRIS peserta'} className="mt-5 h-48 w-full rounded-lg border border-border object-contain bg-muted p-3" />}</div>

                    <div className="rounded-xl border border-border bg-white p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-montserrat text-lg font-semibold text-dgb-900">Foto profil</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Satu foto closeup aktif menjadi foto utama pada daftar publik.</p></div>{canManageMedia && <button type="button" onClick={addMedia} disabled={!canEdit || mediaOptions.length === 0} className="rounded-md border border-dgb px-3 py-2 text-sm font-semibold text-dgb hover:bg-dgb hover:text-white">Tambah foto</button>}</div>{!canManageMedia ? <p className="mt-5 rounded-md bg-muted p-4 text-sm text-muted-foreground">Izin pustaka media diperlukan untuk mengubah foto peserta.</p> : <div className="mt-5 grid gap-4">{(profile.data.media ?? []).length === 0 ? <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">Belum ada foto profil.</p> : profile.data.media?.map((item, index) => <div key={item.id ?? index} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[10rem_1fr_auto]"><div className="grid gap-2"><select value={item.role} onChange={(event) => updateMedia(index, { role: event.target.value })} disabled={!canEdit} className="min-h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb disabled:bg-muted">{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select><label className="flex items-center gap-2 text-xs font-semibold text-dgb-900"><input type="checkbox" checked={item.active} onChange={(event) => updateMedia(index, { active: event.target.checked })} disabled={!canEdit} className="size-4 accent-dgb" />Aktif</label></div><div className="grid gap-2"><select value={item.mediaId} onChange={(event) => updateMedia(index, { mediaId: event.target.value })} disabled={!canEdit} className="min-h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb disabled:bg-muted">{mediaOptions.map((asset) => <option key={asset.id} value={asset.id}>{asset.filename}</option>)}</select><input value={item.caption ?? ''} onChange={(event) => updateMedia(index, { caption: event.target.value })} disabled={!canEdit} placeholder="Keterangan foto" className="min-h-10 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" /></div><button type="button" onClick={() => removeMedia(index)} disabled={!canEdit} className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Hapus</button></div>)}</div>}</div>

                    <div className="rounded-xl border border-border bg-white p-5 sm:p-6"><h2 className="font-montserrat text-lg font-semibold text-dgb-900">Gelar terpasang</h2>{participant.titles.length === 0 ? <p className="mt-4 rounded-md bg-muted p-4 text-sm text-muted-foreground">Belum ada gelar. Assignment gelar dikelola pada workspace gelar.</p> : <ul className="mt-4 grid gap-2">{participant.titles.map((title) => <li key={title.id} className="rounded-md bg-dgb-50 px-3 py-2 text-sm font-semibold text-dgb-800">{title.name}</li>)}</ul>}</div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Field label="Alasan perubahan profil" hint="Opsional, dicatat pada audit." error={profile.errors.reason}><input value={profile.data.reason} onChange={(event) => profile.setData('reason', event.target.value)} disabled={!canEdit} className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted" /></Field><button type="submit" disabled={!canEdit || profile.processing} className="inline-flex min-h-10 items-center justify-center rounded-md bg-dgb px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-dgb-600 disabled:opacity-60">{profile.processing ? 'Menyimpan' : 'Simpan profil'}</button></div>
                </form>}
            </section>
        </>
    )
}

Form.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactElement }) {
    return <label className="grid gap-1 text-xs font-semibold text-dgb-900"><span>{label}</span>{hint && <span className="font-normal text-muted-foreground">{hint}</span>}{children}{error && <span className="font-normal text-red-700">{error}</span>}</label>
}

function slugify(value: string): string {
    return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
}
