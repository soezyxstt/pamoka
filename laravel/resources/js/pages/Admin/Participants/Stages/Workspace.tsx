import { Head, Link, router } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import AdminLayout from '../../../../layouts/AdminLayout'

type Stage = {
    id: string
    name: string
    slug: string
    displayOrder: number
    targetParticipantCount: number
    lifecycle: string
    finalStage: boolean
    version: number
}

type Entry = {
    id: string
    participantId: string
    decision: 'pending' | 'advanced' | 'eliminated'
    decidedAt: string | null
    reason: string | null
    version: number
    participantNumber: number
    participantName: string
    participantSlug: string
    participantActive: boolean
    categoryCode: string
    categoryLabel: string
    categoryId: string
}

type Props = {
    editionName: string
    stage: Stage
    nextStage: { id: string; name: string; targetParticipantCount: number } | null
    previousStage: { id: string; name: string } | null
    categories: { id: string; code: string; label: string }[]
    entries: Entry[]
    canEdit: boolean
}

const decisionLabels: Record<Entry['decision'], string> = {
    pending: 'Pending',
    advanced: 'Lolos',
    eliminated: 'Tidak lolos',
}

export default function Workspace({ editionName, stage, nextStage, previousStage, categories, entries, canEdit }: Props) {
    const [search, setSearch] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [decision, setDecision] = useState('')
    const [selected, setSelected] = useState<string[]>([])

    const filtered = useMemo(() => {
        const needle = search.trim().toLowerCase()
        return entries.filter((entry) => {
            const matchesSearch = needle === '' || entry.participantName.toLowerCase().includes(needle) || String(entry.participantNumber).includes(needle)
            const matchesCategory = categoryId === '' || entry.categoryId === categoryId
            const matchesDecision = decision === '' || entry.decision === decision
            return matchesSearch && matchesCategory && matchesDecision
        })
    }, [entries, search, categoryId, decision])

    const filteredIds = filtered.map((entry) => entry.id)
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.includes(id))
    const pendingCount = entries.filter((entry) => entry.decision === 'pending').length
    const advancedCount = entries.filter((entry) => entry.decision === 'advanced').length
    const eliminatedCount = entries.filter((entry) => entry.decision === 'eliminated').length

    const toggleAll = () => {
        if (allSelected) {
            setSelected((current) => current.filter((id) => !filteredIds.includes(id)))
        } else {
            setSelected((current) => Array.from(new Set([...current, ...filteredIds])))
        }
    }

    const toggleRow = (id: string) => {
        setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
    }

    const decide = (nextDecision: 'advanced' | 'eliminated') => {
        if (!canEdit || selected.length === 0) return
        const selectedEntries = entries.filter((entry) => selected.includes(entry.id))
        if (nextDecision === 'advanced' && nextStage !== null) {
            const selectedAlreadyAdvanced = selectedEntries.filter((entry) => entry.decision === 'advanced').length
            const proposed = advancedCount - selectedAlreadyAdvanced + selectedEntries.length
            if (proposed > nextStage.targetParticipantCount) {
                window.alert(`Jumlah peserta lolos (${proposed}) melebihi target tahap berikutnya (${nextStage.targetParticipantCount}).`)
                return
            }
        }
        const reason = window.prompt('Alasan keputusan, opsional', '')
        if (reason === null) return
        router.post(`/admin/content/participants/stages/${stage.id}/decisions`, {
            decision: nextDecision,
            reason,
            entries: selectedEntries.map((entry) => ({ id: entry.id, version: entry.version })),
        }, { preserveScroll: true, onSuccess: () => setSelected([]) })
    }

    const rollback = (entry: Entry) => {
        if (!canEdit || entry.decision === 'pending') return
        const reason = window.prompt('Alasan rollback, minimal 5 karakter', '')
        if (reason === null || reason.trim().length < 5) return
        router.post(`/admin/content/participants/stages/${stage.id}/entries/${entry.id}/rollback`, {
            version: entry.version,
            reason,
        }, { preserveScroll: true })
    }

    const open = () => {
        if (canEdit) router.post(`/admin/content/participants/stages/${stage.id}/open`, { version: stage.version }, { preserveScroll: true })
    }

    const close = () => {
        if (!canEdit) return
        const underTarget = nextStage !== null && advancedCount < nextStage.targetParticipantCount
        if (underTarget && !window.confirm('Jumlah peserta lolos masih di bawah target tahap berikutnya. Tetap tutup tahap ini?')) return
        const reason = underTarget ? window.prompt('Alasan penutupan di bawah target', '') ?? '' : ''
        router.post(`/admin/content/participants/stages/${stage.id}/close`, {
            version: stage.version,
            allow_under_target: underTarget,
            reason,
        }, { preserveScroll: true })
    }

    const reopen = () => {
        if (!canEdit) return
        const reason = window.prompt('Alasan membuka kembali tahap', '')
        if (reason === null || reason.trim().length < 5) return
        router.post(`/admin/content/participants/stages/${stage.id}/reopen`, { version: stage.version, reason }, { preserveScroll: true })
    }

    return (
        <>
            <Head title={`Workspace ${stage.name}`} />
            <section>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Peserta / workspace keputusan</p>
                        <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">{stage.name}</h1>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">Edisi {editionName}. Target tahap {stage.targetParticipantCount} peserta.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link href="/admin/content/participants/stages" className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Daftar tahap</Link>
                        {canEdit && stage.lifecycle === 'draft' && <button type="button" onClick={open} className="rounded-md bg-dgb px-4 py-2 text-sm font-semibold text-white hover:bg-dgb-600">Buka tahap</button>}
                        {canEdit && stage.lifecycle === 'active' && <button type="button" onClick={close} className="rounded-md border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50">Tutup tahap</button>}
                        {canEdit && stage.lifecycle === 'closed' && !stage.finalStage && <button type="button" onClick={reopen} className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-dgb hover:border-dgb">Buka kembali</button>}
                    </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className={`rounded-md px-2 py-1 font-semibold ${stage.lifecycle === 'active' ? 'bg-emerald-50 text-emerald-800' : stage.lifecycle === 'closed' ? 'bg-muted text-muted-foreground' : 'bg-amber-50 text-amber-800'}`}>{stage.lifecycle === 'active' ? 'Aktif' : stage.lifecycle === 'closed' ? 'Tertutup' : 'Draft'}</span>
                    {stage.finalStage && <span className="rounded-md bg-fb-50 px-2 py-1 font-semibold text-fb-700">Tahap final</span>}
                    {previousStage && <span>Sebelumnya: {previousStage.name}</span>}
                    {nextStage && <span>Berikutnya: {nextStage.name}</span>}
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat label="Total peserta" value={entries.length} className="bg-dgb-50 text-dgb-900" />
                    <Stat label="Pending" value={pendingCount} className="bg-amber-50 text-amber-900" />
                    <Stat label="Lolos" value={advancedCount} className="bg-emerald-50 text-emerald-900" />
                    <Stat label="Tidak lolos" value={eliminatedCount} className="bg-red-50 text-red-900" />
                </div>

                <div className="mt-6 grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]">
                    <label className="grid gap-1 text-xs font-semibold text-dgb-900">Cari peserta<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nama atau nomor peserta" className="min-h-10 rounded-md border border-border px-3 text-sm font-normal outline-none focus:border-dgb" /></label>
                    <label className="grid gap-1 text-xs font-semibold text-dgb-900">Kategori<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="min-h-10 rounded-md border border-border bg-white px-3 text-sm font-normal outline-none focus:border-dgb"><option value="">Semua kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.code} · {category.label}</option>)}</select></label>
                    <label className="grid gap-1 text-xs font-semibold text-dgb-900">Keputusan<select value={decision} onChange={(event) => setDecision(event.target.value)} className="min-h-10 rounded-md border border-border bg-white px-3 text-sm font-normal outline-none focus:border-dgb"><option value="">Semua keputusan</option><option value="pending">Pending</option><option value="advanced">Lolos</option><option value="eliminated">Tidak lolos</option></select></label>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dgb-100 bg-dgb-50/40 p-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-dgb-900"><input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!canEdit || filtered.length === 0} className="size-4 accent-dgb" />Pilih semua hasil filter ({selected.length})</label>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => decide('advanced')} disabled={!canEdit || selected.length === 0 || stage.lifecycle !== 'active'} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Tandai lolos</button>
                        <button type="button" onClick={() => decide('eliminated')} disabled={!canEdit || selected.length === 0 || stage.lifecycle !== 'active'} className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Tandai tidak lolos</button>
                    </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
                    <table className="w-full min-w-[48rem] text-left text-sm">
                        <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr><th className="w-12 px-4 py-3" /><th className="px-4 py-3">Peserta</th><th className="px-4 py-3">Kategori</th><th className="px-4 py-3">Keputusan</th><th className="px-4 py-3">Alasan</th><th className="px-4 py-3">Aksi</th></tr></thead>
                        <tbody>
                            {filtered.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Tidak ada peserta pada filter ini.</td></tr> : filtered.map((entry) => <tr key={entry.id} className="border-b border-border last:border-0">
                                <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(entry.id)} onChange={() => toggleRow(entry.id)} disabled={!canEdit} className="size-4 accent-dgb" aria-label={`Pilih ${entry.participantName}`} /></td>
                                <td className="px-4 py-3"><Link href={`/admin/content/participants/${entry.participantId}`} className="font-semibold text-dgb-900 hover:text-fb-500">{entry.participantNumber}. {entry.participantName}</Link>{!entry.participantActive && <span className="ml-2 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">Nonaktif</span>}</td>
                                <td className="px-4 py-3"><span className="font-semibold text-dgb-700">{entry.categoryCode}</span><span className="ml-2 text-xs text-muted-foreground">{entry.categoryLabel}</span></td>
                                <td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-xs font-semibold ${entry.decision === 'advanced' ? 'bg-emerald-50 text-emerald-800' : entry.decision === 'eliminated' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>{decisionLabels[entry.decision]}</span></td>
                                <td className="max-w-xs px-4 py-3 text-xs text-muted-foreground">{entry.reason ?? 'Tidak ada alasan'}</td>
                                <td className="px-4 py-3">{canEdit && entry.decision !== 'pending' && stage.lifecycle === 'active' && <button type="button" onClick={() => rollback(entry)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-dgb hover:border-dgb">Rollback</button>}</td>
                            </tr>)}
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    )
}

function Stat({ label, value, className }: { label: string; value: number; className: string }) {
    return <div className={`rounded-xl p-4 ${className}`}><p className="text-xs font-medium opacity-75">{label}</p><p className="mt-1 font-montserrat text-2xl font-semibold">{value}</p></div>
}

Workspace.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
