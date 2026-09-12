import { Head, Link, router, useForm } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import AdminLayout from '../../../layouts/AdminLayout'

type Edition = {
    id: string
    year: number
    name: string
    lifecycle: string
}

type Campaign = {
    id: string
    editionId: string
    editionName: string | null
    year: number | null
    name: string
    slug: string
    timezone: string
    status: string
    statusLabel: string
    pricePerPoint: number
    startsAt: string
    endsAt: string
    eligibilityStageId: string | null
    stageName: string | null
    resultVisibility: string
    startedAt: string | null
    closedAt: string | null
    version: number
}

type Stage = {
    id: string
    name: string
    displayOrder: number
    finalStage: boolean
    lifecycle: string
}

type SnapshotParticipant = {
    campaignId: string
    id: string
    editionId: string
    name: string
    number: number
    categoryCode: string
    categoryLabel: string | null
    qrisMediaId: string | null
    qrisUrl: string | null
    qrisMimeType: string | null
    qrisLifecycle: string | null
    qrisReady: boolean
}

type Tally = {
    id: string
    campaignId: string
    participantId: string
    localDate: string
    amount: number
    version: number
    updatedAt: string | null
}

type Props = {
    edition: Edition | null
    editionName: string
    campaigns: Campaign[]
    stages: Stage[]
    participants: SnapshotParticipant[]
    tallies: Tally[]
    canManage: boolean
    canTally: boolean
}

export default function Index({ edition, editionName, campaigns, stages, participants, tallies, canManage, canTally }: Props) {
    const [selectedCampaignId, setSelectedCampaignId] = useState(campaigns[0]?.id ?? '')
    const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0] ?? null
    const campaignParticipants = useMemo(() => participants.filter((participant) => participant.campaignId === selectedCampaign?.id), [participants, selectedCampaign?.id])
    const campaignTallies = useMemo(() => tallies.filter((tally) => tally.campaignId === selectedCampaign?.id), [selectedCampaign?.id, tallies])

    useEffect(() => {
        if (selectedCampaignId === '' || !campaigns.some((campaign) => campaign.id === selectedCampaignId)) setSelectedCampaignId(campaigns[0]?.id ?? '')
    }, [campaigns, selectedCampaignId])

    if (edition === null) {
        return <><Head title="Voting tahunan" /><section><PageHeader editionName={editionName} /><Empty text="Belum ada edisi aktif untuk mengelola voting." /></section></>
    }

    return (
        <>
            <Head title={`Voting ${edition.name}`} />
            <section>
                <PageHeader editionName={edition.name} />
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                    <Stat label="Kampanye" value={campaigns.length} />
                    <Stat label="Tahap sumber" value={stages.length} />
                    <Stat label="Snapshot aktif" value={campaignParticipants.length} />
                </div>
                {canManage && <CampaignCreator stages={stages} editionYear={edition.year} />}

                {campaigns.length === 0 ? <Empty text="Belum ada kampanye voting pada edisi ini." /> : <div className="mt-6 grid gap-6 xl:grid-cols-[16rem_minmax(0,1fr)]">
                    <aside className="h-fit rounded-xl border border-border bg-white p-3">
                        <p className="px-2 pb-2 font-montserrat text-sm font-semibold text-dgb-900">Kampanye</p>
                        <div className="grid gap-1">{campaigns.map((campaign) => <button type="button" key={`${campaign.id}:${campaign.version}`} onClick={() => setSelectedCampaignId(campaign.id)} className={`rounded-md px-3 py-3 text-left transition-colors ${campaign.id === selectedCampaign?.id ? 'bg-dgb-50 text-dgb-900' : 'text-foreground hover:bg-muted'}`}><span className="block font-montserrat text-sm font-semibold">{campaign.name}</span><span className="mt-1 block text-xs text-muted-foreground">{campaign.statusLabel}</span></button>)}</div>
                    </aside>
                    {selectedCampaign && <div className="min-w-0 grid gap-6"><CampaignPanel campaign={selectedCampaign} stages={stages} canManage={canManage} /><TallyPanel campaign={selectedCampaign} participants={campaignParticipants} tallies={campaignTallies} canTally={canTally} /><StandingsPanel campaign={selectedCampaign} participants={campaignParticipants} tallies={campaignTallies} /></div>}
                </div>}
            </section>
        </>
    )
}

Index.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>

function PageHeader({ editionName }: { editionName: string }) {
    return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Operasional / voting</p><h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Voting tahunan</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Kelola kampanye, snapshot peserta, QRIS, dan tally untuk {editionName}.</p></div><Link href="/admin" className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Kembali ke dashboard</Link></div>
}

function CampaignCreator({ stages, editionYear }: { stages: Stage[]; editionYear: number }) {
    const form = useForm({ name: '', slug: '', eligibility_stage_id: stages.find((stage) => stage.finalStage)?.id ?? stages[0]?.id ?? '', starts_at: '', ends_at: '', price_per_point: 2000 })
    const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); form.post('/admin/voting/campaigns', { preserveScroll: true, onSuccess: () => form.reset() }) }

    return <details className="mt-6 rounded-xl border border-dgb-100 bg-dgb-50/40"><summary className="cursor-pointer p-4 font-montserrat text-base font-semibold text-dgb-900">Buat kampanye baru untuk {editionYear}</summary><form onSubmit={submit} className="grid gap-4 border-t border-dgb-100 p-4 sm:grid-cols-2 xl:grid-cols-3"><Field label="Nama kampanye" error={form.errors.name}><input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} placeholder={`Voting Kameumeut ${editionYear}`} required className="input" /></Field><Field label="Slug" error={form.errors.slug}><input value={form.data.slug} onChange={(event) => form.setData('slug', event.target.value)} placeholder={`voting-kameumeut-${editionYear}`} required className="input" /></Field><Field label="Tahap sumber" error={form.errors.eligibility_stage_id}><select value={form.data.eligibility_stage_id} onChange={(event) => form.setData('eligibility_stage_id', event.target.value)} disabled={stages.length === 0} className="input"><option value="">Pilih tahap</option>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}{stage.finalStage ? ' · final' : ''}</option>)}</select></Field><Field label="Harga per poin" error={form.errors.price_per_point}><input type="number" min={1} value={form.data.price_per_point} onChange={(event) => form.setData('price_per_point', Number(event.target.value))} required className="input" /></Field><Field label="Mulai, WIB" error={form.errors.starts_at}><input type="datetime-local" value={form.data.starts_at} onChange={(event) => form.setData('starts_at', event.target.value)} required className="input" /></Field><Field label="Selesai, WIB" error={form.errors.ends_at}><input type="datetime-local" value={form.data.ends_at} onChange={(event) => form.setData('ends_at', event.target.value)} required className="input" /></Field><div className="sm:col-span-2 xl:col-span-3"><button type="submit" disabled={form.processing || stages.length === 0} className="button-primary">{form.processing ? 'Menyimpan' : 'Buat draf'}</button></div></form></details>
}

function CampaignPanel({ campaign, stages, canManage }: { campaign: Campaign; stages: Stage[]; canManage: boolean }) {
    const stageForm = useForm({ stage_id: campaign.eligibilityStageId ?? '', version: campaign.version })
    const lifecycle = useForm({ confirmation: '', reason: '', version: campaign.version })
    const visibility = useForm({ visibility: campaign.resultVisibility, reason: '', version: campaign.version })
    const saveStage = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); stageForm.put(`/admin/voting/campaigns/${campaign.id}/stage`, { preserveScroll: true }) }
    const runLifecycle = (event: FormEvent<HTMLFormElement>, action: 'start' | 'close') => { event.preventDefault(); lifecycle.post(`/admin/voting/campaigns/${campaign.id}/${action}`, { preserveScroll: true }) }
    const saveVisibility = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); visibility.post(`/admin/voting/campaigns/${campaign.id}/visibility`, { preserveScroll: true }) }

    return <section className="rounded-xl border border-border bg-white p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-medium text-fb-700">{campaign.stageName ?? 'Tahap belum dipilih'}</p><h2 className="mt-1 font-montserrat text-2xl font-semibold text-dgb-900">{campaign.name}</h2><p className="mt-2 text-xs text-muted-foreground">{formatDateTime(campaign.startsAt)} sampai {formatDateTime(campaign.endsAt)} · versi {campaign.version}</p></div><span className="rounded-md bg-dgb-50 px-3 py-2 text-xs font-semibold text-dgb-800">{campaign.statusLabel}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Stat label="Snapshot" value="" detail={campaign.status === 'draft' ? 'Belum dibuat' : 'Tersedia'} /><Stat label="Harga per poin" value={`Rp${campaign.pricePerPoint.toLocaleString('id-ID')}`} /><Stat label="Hasil" value={campaign.resultVisibility === 'visible' ? 'Ditampilkan' : 'Disembunyikan'} /></div>{canManage && <div className="mt-5 grid gap-5 border-t border-border pt-5 lg:grid-cols-2"><form onSubmit={saveStage} className="grid gap-3"><Field label="Tahap sumber" error={stageForm.errors.stage_id}><select value={stageForm.data.stage_id} onChange={(event) => stageForm.setData('stage_id', event.target.value)} disabled={campaign.status !== 'draft' || stageForm.processing} className="input"><option value="">Pilih tahap</option>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}{stage.finalStage ? ' · final' : ''}</option>)}</select></Field>{stageForm.errors.version && <p className="text-xs text-red-700">{stageForm.errors.version}</p>}<button type="submit" disabled={campaign.status !== 'draft' || stageForm.processing} className="button-outline w-fit">Simpan tahap</button></form><form onSubmit={(event) => runLifecycle(event, campaign.status === 'draft' ? 'start' : 'close')} className="grid gap-3"><Field label={`Ketik nama untuk ${campaign.status === 'draft' ? 'memulai' : 'menutup'}`} error={lifecycle.errors.confirmation}><input value={lifecycle.data.confirmation} onChange={(event) => lifecycle.setData('confirmation', event.target.value)} disabled={campaign.status === 'closed'} className="input" /></Field><Field label="Alasan" error={lifecycle.errors.reason}><textarea value={lifecycle.data.reason} onChange={(event) => lifecycle.setData('reason', event.target.value)} disabled={campaign.status === 'closed'} required rows={2} className="textarea" /></Field>{campaign.status !== 'closed' && <button type="submit" disabled={lifecycle.processing} className="button-primary w-fit">{lifecycle.processing ? 'Menyimpan' : campaign.status === 'draft' ? 'Mulai voting' : 'Tutup voting'}</button>}{lifecycle.errors.version && <p className="text-xs text-red-700">{lifecycle.errors.version}</p>}</form><form onSubmit={saveVisibility} className="grid gap-3 lg:col-span-2"><Field label="Alasan visibilitas" error={visibility.errors.reason}><textarea value={visibility.data.reason} onChange={(event) => visibility.setData('reason', event.target.value)} rows={2} required className="textarea" /></Field><input type="hidden" value={visibility.data.visibility} readOnly /><button type="submit" disabled={visibility.processing} className="button-outline w-fit">{campaign.resultVisibility === 'visible' ? 'Sembunyikan hasil' : 'Tampilkan hasil'}</button>{visibility.errors.visibility && <p className="text-xs text-red-700">{visibility.errors.visibility}</p>}</form></div>}</section>
}

function TallyPanel({ campaign, participants, tallies, canTally }: { campaign: Campaign; participants: SnapshotParticipant[]; tallies: Tally[]; canTally: boolean }) {
    const ready = participants.filter((participant) => participant.qrisReady)
    const [participantId, setParticipantId] = useState(ready[0]?.id ?? '')
    const [localDate, setLocalDate] = useState(localDateFromIso(campaign.startsAt))
    const current = tallies.find((tally) => tally.participantId === participantId && tally.localDate === localDate)
    const form = useForm({ campaign_id: campaign.id, participant_id: participantId, local_date: localDate, amount: current?.amount ?? 0, version: current?.version ?? 0, reason: '' })

    useEffect(() => { const next = ready[0]?.id ?? ''; setParticipantId((value) => ready.some((participant) => participant.id === value) ? value : next) }, [participants, campaign.id])
    useEffect(() => { setLocalDate((value) => value || localDateFromIso(campaign.startsAt)) }, [campaign.startsAt])
    useEffect(() => { form.setData({ campaign_id: campaign.id, participant_id: participantId, local_date: localDate, amount: current?.amount ?? 0, version: current?.version ?? 0, reason: '' }) }, [campaign.id, current?.amount, current?.version, localDate, participantId])
    const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); form.post('/admin/voting/tallies', { preserveScroll: true }) }

    if (!canTally || campaign.status !== 'active') return null
    if (ready.length === 0) return <section className="rounded-xl border border-border bg-white p-5"><h3 className="font-montserrat text-lg font-semibold text-dgb-900">Tally harian</h3><p className="mt-2 text-sm text-muted-foreground">Belum ada peserta snapshot dengan QRIS gambar siap.</p></section>

    return <section className="rounded-xl border border-border bg-white p-5 sm:p-6"><h3 className="font-montserrat text-lg font-semibold text-dgb-900">Tally harian</h3><p className="mt-1 text-sm text-muted-foreground">Masukkan nominal pemasukan per peserta dan tanggal lokal WIB.</p><form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Peserta" error={form.errors.participant_id}><select value={participantId} onChange={(event) => setParticipantId(event.target.value)} className="input">{ready.map((participant) => <option key={participant.id} value={participant.id}>{participant.categoryCode} {participant.number}, {participant.name}</option>)}</select></Field><Field label="Tanggal" error={form.errors.local_date}><input type="date" min={localDateFromIso(campaign.startsAt)} max={localDateFromIso(campaign.endsAt)} value={localDate} onChange={(event) => setLocalDate(event.target.value)} className="input" /></Field><Field label="Nominal pemasukan" error={form.errors.amount}><input type="number" min={0} step={1} value={form.data.amount} onChange={(event) => form.setData('amount', Number(event.target.value))} required className="input" /></Field><Field label="Alasan perubahan" error={form.errors.reason}><textarea value={form.data.reason} onChange={(event) => form.setData('reason', event.target.value)} placeholder="Contoh: Rekap merchant sore" required rows={2} className="textarea" /></Field>{form.errors.version && <p className="text-xs text-red-700 sm:col-span-2">{form.errors.version}</p>}<button type="submit" disabled={form.processing} className="button-primary w-fit sm:col-span-2">{form.processing ? 'Menyimpan' : 'Simpan tally'}</button></form></section>
}

function StandingsPanel({ campaign, participants, tallies }: { campaign: Campaign; participants: SnapshotParticipant[]; tallies: Tally[] }) {
    const totals = new Map<string, number>()
    tallies.forEach((tally) => totals.set(tally.participantId, (totals.get(tally.participantId) ?? 0) + tally.amount))
    const standings = participants.map((participant) => ({ ...participant, amount: totals.get(participant.id) ?? 0, votes: Math.floor((totals.get(participant.id) ?? 0) / campaign.pricePerPoint) })).sort((left, right) => right.votes - left.votes || left.name.localeCompare(right.name, 'id'))

    return <section className="rounded-xl border border-border bg-white p-5 sm:p-6"><div className="flex items-end justify-between gap-3"><div><h3 className="font-montserrat text-lg font-semibold text-dgb-900">Rekap peserta</h3><p className="mt-1 text-sm text-muted-foreground">Berdasarkan snapshot kampanye</p></div><span className="text-xs text-muted-foreground">{standings.length} peserta</span></div>{standings.length === 0 ? <p className="mt-5 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Snapshot belum tersedia. Mulai voting untuk membuat snapshot peserta.</p> : <div className="mt-5 divide-y divide-border">{standings.map((participant, index) => <div key={participant.id} className="grid gap-2 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto_auto] sm:items-center"><span className="text-xs font-semibold text-fb-700">{index + 1}</span><div><p className="font-montserrat text-sm font-semibold text-dgb-900">{participant.name}</p><p className="text-xs text-muted-foreground">{participant.categoryCode} {participant.number}</p></div><span className={participant.qrisReady ? 'text-xs font-semibold text-emerald-700' : 'text-xs font-semibold text-red-700'}>{participant.qrisReady ? 'QRIS siap' : 'QRIS belum siap'}</span><div className="text-left sm:text-right"><p className="font-montserrat text-base font-semibold text-dgb-900">{participant.votes.toLocaleString('id-ID')} poin</p><p className="text-xs text-muted-foreground">Rp{participant.amount.toLocaleString('id-ID')}</p></div></div>)}</div>}</section>
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactElement }) {
    return <label className="grid gap-1 text-xs font-semibold text-dgb-900">{label}{children}{error && <span className="font-normal text-red-700">{error}</span>}</label>
}

function Stat({ label, value, detail }: { label: string; value: number | string; detail?: string }) {
    return <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">{label}</p>{value !== '' && <p className="mt-1 font-montserrat text-xl font-semibold text-dgb-900">{value}</p>}{detail && <p className="mt-1 text-xs font-semibold text-dgb-700">{detail}</p>}</div>
}

function Empty({ text }: { text: string }) {
    return <div className="mt-8 rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">{text}</div>
}

function formatDateTime(value: string): string {
    return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })
}

function localDateFromIso(value: string): string {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))

    return `${map.year}-${map.month}-${map.day}`
}
