import { Head, Link } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
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
    logo: {
        url: string
        filename: string
        alt: string | null
    } | null
}

type SponsorsProps = {
    editionName: string
    sponsors: Sponsor[]
    canEdit: boolean
    canPublish: boolean
}

const tiers = [
    { value: 'all', label: 'Semua tingkat' },
    { value: 'utama', label: 'Utama' },
    { value: 'pendukung', label: 'Pendukung' },
    { value: 'pendamping', label: 'Pendamping' },
    { value: 'pelengkap', label: 'Pelengkap' },
] as const

export default function Index({ editionName, sponsors, canEdit, canPublish }: SponsorsProps) {
    const [search, setSearch] = useState('')
    const [tier, setTier] = useState<(typeof tiers)[number]['value']>('all')
    const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase()

        return sponsors.filter((sponsor) => {
            const matchesSearch = query === '' || sponsor.name.toLowerCase().includes(query)
            const matchesTier = tier === 'all' || sponsor.tier === tier
            const matchesStatus = status === 'all' || (status === 'active' && sponsor.active) || (status === 'inactive' && !sponsor.active)

            return matchesSearch && matchesTier && matchesStatus
        })
    }, [search, sponsors, status, tier])

    return (
        <>
            <Head title="Sponsor" />
            <section>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Konten edisi</p>
                        <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Sponsor</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                            Kelola partner pendukung untuk {editionName}. Sponsor baru menunggu penerbitan terpisah.
                        </p>
                    </div>
                    {canEdit && (
                        <Link href="/admin/content/sponsors/new" className="inline-flex min-h-10 items-center justify-center rounded-md bg-dgb px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-dgb-600">
                            Tambah sponsor
                        </Link>
                    )}
                </div>

                <div className="mt-8 grid gap-3 rounded-xl border border-border bg-white p-4 md:grid-cols-[1fr_auto_auto] md:items-end">
                    <label className="grid gap-1 text-xs font-semibold text-dgb-900">
                        Cari sponsor
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nama sponsor" className="min-h-10 rounded-md border border-border px-3 text-sm font-normal outline-none focus:border-dgb" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-dgb-900">
                        Tingkat
                        <select value={tier} onChange={(event) => setTier(event.target.value as (typeof tiers)[number]['value'])} className="min-h-10 rounded-md border border-border bg-white px-3 text-sm font-normal outline-none focus:border-dgb">
                            {tiers.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-dgb-900">
                        Status
                        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="min-h-10 rounded-md border border-border bg-white px-3 text-sm font-normal outline-none focus:border-dgb">
                            <option value="all">Semua status</option>
                            <option value="active">Aktif</option>
                            <option value="inactive">Nonaktif</option>
                        </select>
                    </label>
                </div>

                <div className="mt-5 grid gap-3">
                    {filtered.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">
                            {sponsors.length === 0 ? 'Belum ada sponsor pada edisi ini.' : 'Tidak ada sponsor yang sesuai dengan filter.'}
                        </div>
                    ) : filtered.map((sponsor) => (
                        <Link key={sponsor.id} href={`/admin/content/sponsors/${sponsor.id}`} className="grid gap-4 rounded-xl border border-border bg-white p-4 transition-colors hover:border-dgb-300 sm:grid-cols-[5rem_1fr_auto] sm:items-center">
                            <div className="grid h-16 place-items-center overflow-hidden rounded-lg border border-border bg-white p-2">
                                {sponsor.logo ? <img src={sponsor.logo.url} alt={sponsor.logo.alt ?? sponsor.name} className="max-h-full w-full object-contain" /> : <span className="text-center text-[11px] font-semibold text-dgb-600">Tanpa logo</span>}
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span className="rounded-md bg-dgb-50 px-2 py-1 font-semibold text-dgb-800">{tierLabel(sponsor.tier)}</span>
                                    <span className={sponsor.active ? 'rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-800' : 'rounded-md bg-muted px-2 py-1 font-semibold text-muted-foreground'}>{sponsor.active ? 'Aktif' : 'Nonaktif'}</span>
                                    <span>Urutan {sponsor.displayOrder}</span>
                                </div>
                                <h2 className="mt-2 truncate font-montserrat text-base font-bold text-dgb-900">{sponsor.name}</h2>
                                <p className="mt-1 truncate text-sm text-muted-foreground">{sponsor.website ?? 'Website belum diisi'}</p>
                            </div>
                            <div className="text-left text-xs text-muted-foreground sm:text-right">
                                <p>Versi {sponsor.version}</p>
                                <p className="mt-1 font-semibold text-dgb-700">Buka editor</p>
                                {canPublish && !sponsor.active && <p className="mt-1 text-fb-600">Siap diterbitkan</p>}
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </>
    )
}

Index.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>

function tierLabel(value: string): string {
    return tiers.find((tier) => tier.value === value)?.label ?? value
}
