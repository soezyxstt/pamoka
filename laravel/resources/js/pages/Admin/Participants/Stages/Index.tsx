import { Head, Link, router, useForm } from '@inertiajs/react'
import type { FormEvent, ReactElement } from 'react'
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
    stats: { total: number; pending: number; advanced: number; eliminated: number }
}

type Props = {
    editionName: string
    stages: Stage[]
    canEdit: boolean
}

type StageFormData = {
    name: string
    target_participant_count: number
    final_stage: boolean
    version?: number
}

const lifecycleLabels: Record<string, string> = {
    draft: 'Draft',
    active: 'Aktif',
    closed: 'Tertutup',
}

export default function Index({ editionName, stages, canEdit }: Props) {
    const create = useForm<StageFormData>({
        name: '',
        target_participant_count: 20,
        final_stage: false,
    })

    const submitCreate = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canEdit) return
        create.post('/admin/content/participants/stages', {
            preserveScroll: true,
            onSuccess: () => create.reset(),
        })
    }

    const move = (index: number, direction: -1 | 1) => {
        const target = index + direction
        if (!canEdit || target < 0 || target >= stages.length) return
        const items = stages.map((stage) => ({ id: stage.id, version: stage.version }))
        const current = items[index]
        items[index] = items[target]
        items[target] = current
        router.post('/admin/content/participants/stages/reorder', { items }, { preserveScroll: true })
    }

    const lifecycleAction = (stage: Stage, action: 'open' | 'close' | 'reopen') => {
        if (!canEdit) return
        if (action === 'open') {
            router.post(`/admin/content/participants/stages/${stage.id}/open`, { version: stage.version }, { preserveScroll: true })
            return
        }
        if (action === 'close') {
            const index = stages.findIndex((candidate) => candidate.id === stage.id)
            const next = index >= 0 ? stages[index + 1] : undefined
            const underTarget = next !== undefined && stage.stats.advanced < next.targetParticipantCount
            if (underTarget && !window.confirm('Jumlah peserta lolos masih di bawah target tahap berikutnya. Tetap tutup tahap ini?')) return
            const reason = underTarget ? window.prompt('Alasan penutupan di bawah target', '') ?? '' : ''
            router.post(`/admin/content/participants/stages/${stage.id}/close`, {
                version: stage.version,
                allow_under_target: underTarget,
                reason,
            }, { preserveScroll: true })
            return
        }
        const reason = window.prompt('Alasan membuka kembali tahap', '') ?? ''
        if (reason.trim().length < 5) return
        router.post(`/admin/content/participants/stages/${stage.id}/reopen`, { version: stage.version, reason }, { preserveScroll: true })
    }

    const remove = (stage: Stage) => {
        if (!canEdit || stage.stats.total > 0 || !window.confirm(`Hapus tahap ${stage.name}?`)) return
        router.delete(`/admin/content/participants/stages/${stage.id}`, { data: { version: stage.version }, preserveScroll: true })
    }

    return (
        <>
            <Head title="Tahap seleksi" />
            <section>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Peserta / alur seleksi</p>
                        <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Tahap seleksi</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Kelola alur linear seleksi untuk {editionName}.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link href="/admin/content/participants/titles" className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Atur gelar</Link>
                        <Link href="/admin/content/participants" className="inline-flex min-h-10 items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:border-dgb">Kembali ke peserta</Link>
                    </div>
                </div>

                {canEdit && <form onSubmit={submitCreate} className="mt-8 grid gap-4 rounded-xl border border-dgb-100 bg-dgb-50/40 p-5 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
                    <Field label="Nama tahap" error={create.errors.name}><input value={create.data.name} onChange={(event) => create.setData('name', event.target.value)} placeholder="Contoh: Seleksi berkas" required className="min-h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb" /></Field>
                    <Field label="Target peserta" error={create.errors.target_participant_count}><input type="number" min={1} step={1} value={create.data.target_participant_count} onChange={(event) => create.setData('target_participant_count', Number(event.target.value))} required className="min-h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb" /></Field>
                    <div className="grid gap-3">
                        <label className="flex items-center gap-2 text-xs font-semibold text-dgb-900"><input type="checkbox" checked={create.data.final_stage} onChange={(event) => create.setData('final_stage', event.target.checked)} className="size-4 accent-dgb" />Tahap final</label>
                        <button type="submit" disabled={create.processing} className="inline-flex min-h-10 items-center justify-center rounded-md bg-dgb px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-dgb-600 disabled:opacity-60">{create.processing ? 'Menyimpan' : 'Tambah tahap'}</button>
                    </div>
                </form>}

                {stages.length === 0 ? <div className="mt-8 rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">Belum ada tahap seleksi.</div> : <div className="mt-8 grid gap-4">
                    {stages.map((stage, index) => <article key={`${stage.id}:${stage.version}`} className="rounded-xl border border-border bg-white p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-dgb-50 font-montserrat text-sm font-bold text-dgb">{index + 1}</span>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="font-montserrat text-lg font-semibold text-dgb-900">{stage.name}</h2>
                                        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${stage.lifecycle === 'active' ? 'bg-emerald-50 text-emerald-800' : stage.lifecycle === 'closed' ? 'bg-muted text-muted-foreground' : 'bg-amber-50 text-amber-800'}`}>{lifecycleLabels[stage.lifecycle] ?? stage.lifecycle}</span>
                                        {stage.finalStage && <span className="rounded-md bg-fb-50 px-2 py-1 text-xs font-semibold text-fb-700">Tahap final</span>}
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">Target {stage.targetParticipantCount} peserta · versi {stage.version}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Link href={`/admin/content/participants/stages/${stage.id}`} className="inline-flex min-h-9 items-center justify-center rounded-md bg-dgb px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-dgb-600">Workspace keputusan</Link>
                                {canEdit && <>
                                    <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-dgb disabled:opacity-40" aria-label={`Pindahkan ${stage.name} ke atas`}>Naik</button>
                                    <button type="button" onClick={() => move(index, 1)} disabled={index === stages.length - 1} className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-dgb disabled:opacity-40" aria-label={`Pindahkan ${stage.name} ke bawah`}>Turun</button>
                                    {stage.lifecycle === 'draft' && <button type="button" onClick={() => lifecycleAction(stage, 'open')} className="rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">Buka</button>}
                                    {stage.lifecycle === 'active' && <button type="button" onClick={() => lifecycleAction(stage, 'close')} className="rounded-md border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50">Tutup</button>}
                                    {stage.lifecycle === 'closed' && !stage.finalStage && <button type="button" onClick={() => lifecycleAction(stage, 'reopen')} className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-dgb hover:border-dgb">Buka kembali</button>}
                                    <button type="button" onClick={() => remove(stage)} disabled={stage.stats.total > 0} className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40">Hapus</button>
                                </>}
                            </div>
                        </div>

                        {canEdit && <StageEditor stage={stage} />}

                        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
                            <Stat label="Total peserta" value={stage.stats.total} className="bg-dgb-50/50 text-dgb-900" />
                            <Stat label="Pending" value={stage.stats.pending} className="bg-amber-50 text-amber-900" />
                            <Stat label="Lolos" value={stage.stats.advanced} className="bg-emerald-50 text-emerald-900" />
                            <Stat label="Tidak lolos" value={stage.stats.eliminated} className="bg-red-50 text-red-900" />
                        </div>
                    </article>)}
                </div>}
            </section>
        </>
    )
}

function StageEditor({ stage }: { stage: Stage }) {
    const form = useForm<StageFormData>({
        name: stage.name,
        target_participant_count: stage.targetParticipantCount,
        final_stage: stage.finalStage,
        version: stage.version,
    })

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        form.put(`/admin/content/participants/stages/${stage.id}`, { preserveScroll: true })
    }

    return <form onSubmit={submit} className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
        <Field label="Nama tahap" error={form.errors.name}><input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} className="min-h-10 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb" /></Field>
        <Field label="Target peserta" error={form.errors.target_participant_count}><input type="number" min={Math.max(1, stage.stats.total)} value={form.data.target_participant_count} onChange={(event) => form.setData('target_participant_count', Number(event.target.value))} className="min-h-10 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb" /></Field>
        <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-dgb-900"><input type="checkbox" checked={form.data.final_stage} onChange={(event) => form.setData('final_stage', event.target.checked)} className="size-4 accent-dgb" />Final</label>
            <button type="submit" disabled={form.processing} className="rounded-md border border-dgb px-3 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white disabled:opacity-50">Simpan</button>
        </div>
        {form.errors.version && <p className="text-xs font-normal text-red-700 sm:col-span-3">{form.errors.version}</p>}
    </form>
}

function Stat({ label, value, className }: { label: string; value: number; className: string }) {
    return <div className={`rounded-md p-3 ${className}`}><p className="text-xs font-medium opacity-75">{label}</p><p className="mt-1 font-montserrat text-xl font-semibold">{value}</p></div>
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactElement }) {
    return <label className="grid gap-1 text-xs font-semibold text-dgb-900"><span>{label}</span>{children}{error && <span className="font-normal text-red-700">{error}</span>}</label>
}

Index.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
