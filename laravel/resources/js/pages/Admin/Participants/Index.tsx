import { Head, Link, router } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import AdminLayout from '../../../layouts/AdminLayout'

type Participant = {
    id: string
    categoryId: string
    categoryCode: string
    categoryLabel: string
    number: number
    name: string
    currentStageId: string | null
    currentStageName: string | null
    selectionStatus: string
    portraitUrl: string | null
    portraitAlt: string | null
    qrisMediaId: string | null
    active: boolean
    version: number
    achievementsCount: number
    socialLinksCount: number
    mediaCount: number
    titleCount: number
    hasCloseup: boolean
}

type Props = {
    editionName: string
    categories: { id: string; code: string; label: string }[]
    stages: { id: string; name: string }[]
    participants: Participant[]
    canEdit: boolean
}

const statusLabels: Record<string, string> = {
    registered: 'Terdaftar',
    active: 'Aktif',
    eliminated: 'Tidak lolos',
    completed: 'Selesai',
}

export default function Index({ editionName, categories, stages, participants, canEdit }: Props) {
    const [search, setSearch] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [stageId, setStageId] = useState('')
    const [status, setStatus] = useState('')
    const [photoFilter, setPhotoFilter] = useState('')
    const [titleFilter, setTitleFilter] = useState('')
    const [qrisFilter, setQrisFilter] = useState('')

    const filtered = useMemo(() => {
        const needle = search.trim().toLowerCase()

        return participants.filter((participant) => {
            const matchesSearch = needle === ''
                || participant.name.toLowerCase().includes(needle)
                || String(participant.number).includes(needle)
            const matchesCategory = categoryId === '' || participant.categoryId === categoryId
            const matchesStage = stageId === '' || participant.currentStageId === stageId
            const matchesStatus = status === '' || participant.selectionStatus === status
            const matchesPhoto = photoFilter === ''
                || (photoFilter === 'ready' ? participant.hasCloseup : !participant.hasCloseup)
            const matchesTitle = titleFilter === ''
                || (titleFilter === 'ready' ? participant.titleCount > 0 : participant.titleCount === 0)
            const matchesQris = qrisFilter === ''
                || (qrisFilter === 'ready' ? participant.qrisMediaId !== null : participant.qrisMediaId === null)

            return matchesSearch && matchesCategory && matchesStage && matchesStatus && matchesPhoto && matchesTitle && matchesQris
        })
    }, [participants, search, categoryId, stageId, status, photoFilter, titleFilter, qrisFilter])

    const toggleActive = (participant: Participant) => {
        if (!canEdit) return
        router.post(`/admin/content/participants/${participant.id}/toggle`, { version: participant.version }, { preserveScroll: true })
    }

    const removeParticipant = (participant: Participant) => {
        if (!canEdit || !window.confirm('Hapus pendaftar ini? Pendaftar yang sudah diproses tidak dapat dihapus.')) return
        router.delete(`/admin/content/participants/${participant.id}`, { data: { version: participant.version }, preserveScroll: true })
    }

    return (
        <>
            <Head title="Mojang Jajaka" />
            <section>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Konten peserta</p>
                        <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Mojang Jajaka</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Kelola pendaftar dan profil peserta untuk {editionName}.</p>
                    </div>
                    {canEdit && <Link href="/admin/content/participants/new" className="inline-flex min-h-10 items-center justify-center rounded-md bg-dgb px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-dgb-600">Tambah pendaftar</Link>}
                </div>

                <div className="mt-8 grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
                    <label className="grid gap-1 text-xs font-semibold text-dgb-900 sm:col-span-2 xl:col-span-1">
                        Cari peserta
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nama atau nomor" className="min-h-10 rounded-md border border-border bg-white px-3 text-sm font-normal outline-none focus:border-dgb" />
                    </label>
                    <Select label="Kategori" value={categoryId} onChange={setCategoryId} options={[{ value: '', label: 'Semua kategori' }, ...categories.map((category) => ({ value: category.id, label: category.code }))]} />
                    <Select label="Tahap" value={stageId} onChange={setStageId} options={[{ value: '', label: 'Semua tahap' }, ...stages.map((stage) => ({ value: stage.id, label: stage.name }))]} />
                    <Select label="Status" value={status} onChange={setStatus} options={[{ value: '', label: 'Semua status' }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} />
                    <Select label="Foto" value={photoFilter} onChange={setPhotoFilter} options={[{ value: '', label: 'Semua foto' }, { value: 'ready', label: 'Foto utama siap' }, { value: 'missing', label: 'Foto utama belum ada' }]} />
                    <Select label="Gelar" value={titleFilter} onChange={setTitleFilter} options={[{ value: '', label: 'Semua gelar' }, { value: 'ready', label: 'Sudah bergelar' }, { value: 'missing', label: 'Belum bergelar' }]} />
                    <Select label="QRIS" value={qrisFilter} onChange={setQrisFilter} options={[{ value: '', label: 'Semua QRIS' }, { value: 'ready', label: 'QRIS siap' }, { value: 'missing', label: 'QRIS belum ada' }]} />
                </div>

                <p className="mt-5 text-sm text-muted-foreground">{filtered.length} dari {participants.length} peserta</p>
                <div className="mt-3 grid gap-3">
                    {filtered.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">{participants.length === 0 ? 'Belum ada peserta pada edisi ini.' : 'Tidak ada peserta yang sesuai dengan filter.'}</div>
                    ) : filtered.map((participant) => (
                        <article key={participant.id} className="grid gap-4 rounded-xl border border-border bg-white p-4 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:items-center sm:p-5">
                            <div className="size-16 overflow-hidden rounded-lg bg-dgb-50">
                                {participant.portraitUrl ? <img src={participant.portraitUrl} alt={participant.portraitAlt ?? participant.name} className="size-full object-cover" /> : <div className="grid size-full place-items-center font-montserrat text-sm font-semibold text-dgb">{participant.categoryCode}</div>}
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="rounded-md bg-dgb-50 px-2 py-1 font-semibold text-dgb-800">{participant.categoryCode}</span>
                                    <span className="rounded-md bg-muted px-2 py-1 font-semibold text-muted-foreground">{statusLabels[participant.selectionStatus] ?? participant.selectionStatus}</span>
                                    {!participant.active && <span className="rounded-md bg-red-50 px-2 py-1 font-semibold text-red-700">Nonaktif</span>}
                                    <span className="text-muted-foreground">Versi {participant.version}</span>
                                </div>
                                <Link href={`/admin/content/participants/${participant.id}`} className="mt-2 block truncate font-montserrat text-base font-bold text-dgb-900 hover:text-dgb">{participant.number}. {participant.name}</Link>
                                <p className="mt-1 text-xs text-muted-foreground">{participant.currentStageName ?? 'Tahap belum terhubung'} · {participant.achievementsCount} prestasi · {participant.socialLinksCount} tautan · {participant.mediaCount} foto · {participant.titleCount} gelar</p>
                            </div>
                            <div className="flex flex-wrap gap-2 sm:justify-end">
                                <Link href={`/admin/content/participants/${participant.id}`} className="inline-flex min-h-9 items-center justify-center rounded-md border border-dgb px-3 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Detail</Link>
                                {canEdit && <button type="button" onClick={() => toggleActive(participant)} className="inline-flex min-h-9 items-center justify-center rounded-md border border-border px-3 py-2 text-sm font-semibold text-dgb transition-colors hover:border-dgb">{participant.active ? 'Nonaktifkan' : 'Aktifkan'}</button>}
                                {canEdit && <button type="button" onClick={() => removeParticipant(participant)} className="inline-flex min-h-9 items-center justify-center rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50">Hapus</button>}
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        </>
    )
}

Index.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
    return (
        <label className="grid gap-1 text-xs font-semibold text-dgb-900">
            {label}
            <select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-10 rounded-md border border-border bg-white px-3 text-sm font-normal outline-none focus:border-dgb">
                {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
        </label>
    )
}
