import { Head, Link, router, useForm } from '@inertiajs/react'
import { useMemo, useState } from 'react'
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
}

type Unit = {
    id: string
    periodId: string
    parentId: string | null
    name: string
    displayOrder: number
    active: boolean
}

type Member = {
    id: string
    periodId: string
    unitId: string
    personId: string
    title: string
    displayOrder: number
    active: boolean
    version: number
    personName: string
    personSlug: string | null
    portraitUrl: string | null
}

type Edition = {
    id: string
    year: number
    name: string
    slug: string
    lifecycle: string
    organizationPeriodId: string | null
    organizationPeriodLabel: string | null
}

type PersonOption = { id: string; name: string; slug: string; portraitUrl: string | null }

type LegacyAssignment = {
    id: string
    personId: string
    personName: string
    title: string
    group: string
    termLabel: string | null
    displayOrder: number
    active: boolean
    isMapped: boolean
}

type Props = {
    period: Period
    units: Unit[]
    members: Member[]
    availableEditions: Edition[]
    peopleOptions: PersonOption[]
    legacyAssignments: LegacyAssignment[]
    canEdit: boolean
}

type PeriodFormData = {
    label: string
    start_year: number
    end_year: number
    vision: string
    missions: string[]
    lifecycle: string
    version: number
}

type UnitFormData = {
    parent_id: string
    name: string
    display_order: number
    active: boolean
}

type MembershipFormData = {
    organization_unit_id: string
    person_id: string
    title: string
    display_order: number
    active: boolean
    version?: number
}

export default function Period({ period, units, members, availableEditions, peopleOptions, legacyAssignments, canEdit }: Props) {
    const [selectedEditionIds, setSelectedEditionIds] = useState(() => availableEditions.filter((edition) => edition.organizationPeriodId === period.id).map((edition) => edition.id))
    const [confirmedReassignmentIds, setConfirmedReassignmentIds] = useState<string[]>([])
    const [savingEditions, setSavingEditions] = useState(false)
    const conflicts = availableEditions.filter((edition) => selectedEditionIds.includes(edition.id) && edition.organizationPeriodId !== null && edition.organizationPeriodId !== period.id)
    const metadata = useForm<PeriodFormData>({ label: period.label, start_year: period.startYear, end_year: period.endYear, vision: period.vision ?? '', missions: period.missions.length > 0 ? period.missions : [''], lifecycle: period.lifecycle, version: period.version })
    const createUnit = useForm<UnitFormData>({ parent_id: '', name: '', display_order: 0, active: true })
    const createMember = useForm<MembershipFormData>({ organization_unit_id: units[0]?.id ?? '', person_id: peopleOptions[0]?.id ?? '', title: '', display_order: 0, active: true })
    const treeUnits = useMemo(() => units.slice().sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)), [units])

    const saveMetadata = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canEdit) return
        metadata.put(`/admin/organization/periods/${period.id}`, { preserveScroll: true })
    }
    const saveEditions = () => {
        if (!canEdit || savingEditions || conflicts.some((edition) => !confirmedReassignmentIds.includes(edition.id))) return
        setSavingEditions(true)
        router.post(`/admin/organization/periods/${period.id}/editions`, { period_version: period.version, edition_ids: selectedEditionIds, confirmed_reassignment_ids: confirmedReassignmentIds }, { preserveScroll: true, onFinish: () => setSavingEditions(false) })
    }
    const submitUnit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canEdit) return
        createUnit.transform((data) => ({ ...data, organization_period_id: period.id, parent_id: data.parent_id || null }))
        createUnit.post('/admin/organization/units', { preserveScroll: true, onSuccess: () => createUnit.reset('name', 'parent_id', 'display_order') })
    }
    const submitMember = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canEdit) return
        createMember.transform((data) => ({ ...data, organization_period_id: period.id }))
        createMember.post('/admin/organization/memberships', { preserveScroll: true, onSuccess: () => createMember.reset('title', 'display_order') })
    }
    const moveUnit = (unit: Unit, direction: -1 | 1) => {
        if (!canEdit) return
        const siblings = treeUnits.filter((candidate) => candidate.parentId === unit.parentId)
        const index = siblings.findIndex((candidate) => candidate.id === unit.id)
        const target = index + direction
        if (index < 0 || target < 0 || target >= siblings.length) return
        const order = siblings.map((candidate) => candidate.id)
        ;[order[index], order[target]] = [order[target], order[index]]
        router.post('/admin/organization/units/reorder', { items: order.map((id, displayOrder) => ({ id, display_order: displayOrder })) }, { preserveScroll: true })
    }
    const removePeriod = () => {
        if (!canEdit || !window.confirm('Hapus periode ini beserta struktur unitnya?')) return
        router.delete(`/admin/organization/periods/${period.id}`, { data: { version: period.version } })
    }

    return <>
        <Head title={`Detail ${period.label}`} />
        <section>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><Link href="/admin/organization" className="text-sm font-semibold text-dgb hover:text-fb-500">Kembali ke kepengurusan</Link><p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Umum / detail periode</p><h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">{period.label}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Kelola metadata, edisi terhubung, struktur unit, dan penugasan pengurus.</p></div>{canEdit && <button type="button" onClick={removePeriod} className="button-danger self-start">Hapus periode</button>}</div>

            <form onSubmit={saveMetadata} className="mt-8 rounded-xl border border-border bg-white p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-fb-500">Metadata</p><h2 className="mt-1 font-montserrat text-xl font-semibold text-dgb-900">Identitas periode</h2></div><span className="rounded-md bg-dgb-50 px-2 py-1 text-xs font-semibold text-dgb-800">{lifecycleLabel(period.lifecycle)} · versi {period.version}</span></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Label periode" error={metadata.errors.label}><input value={metadata.data.label} onChange={(event) => metadata.setData('label', event.target.value)} disabled={!canEdit} required className="input" /></Field><Field label="Status" error={metadata.errors.lifecycle}><select value={metadata.data.lifecycle} onChange={(event) => metadata.setData('lifecycle', event.target.value)} disabled={!canEdit} className="input"><option value="draft">Draft</option><option value="active">Aktif</option><option value="archived">Arsip</option></select></Field><Field label="Tahun mulai" error={metadata.errors.start_year}><input type="number" min={1900} value={metadata.data.start_year} onChange={(event) => metadata.setData('start_year', Number(event.target.value))} disabled={!canEdit} required className="input" /></Field><Field label="Tahun selesai" error={metadata.errors.end_year}><input type="number" min={1900} value={metadata.data.end_year} onChange={(event) => metadata.setData('end_year', Number(event.target.value))} disabled={!canEdit} required className="input" /></Field><Field label="Visi" error={metadata.errors.vision}><textarea value={metadata.data.vision} onChange={(event) => metadata.setData('vision', event.target.value)} disabled={!canEdit} rows={3} className="textarea" /></Field><Field label="Misi" hint="Satu poin per baris." error={metadata.errors.missions}><textarea value={metadata.data.missions.join('\n')} onChange={(event) => metadata.setData('missions', event.target.value.split('\n'))} disabled={!canEdit} rows={3} className="textarea" /></Field></div><div className="mt-4 flex justify-end"><button type="submit" disabled={!canEdit || metadata.processing} className="button-primary">{metadata.processing ? 'Menyimpan' : 'Simpan metadata'}</button></div></form>

            <section className="mt-6 rounded-xl border border-border bg-white p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-fb-500">Relasi edisi</p><h2 className="mt-1 font-montserrat text-xl font-semibold text-dgb-900">Edisi terhubung</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Satu periode dapat digunakan oleh beberapa edisi. Pemindahan dari periode lain harus dikonfirmasi.</p></div><button type="button" onClick={saveEditions} disabled={!canEdit || savingEditions || conflicts.some((edition) => !confirmedReassignmentIds.includes(edition.id))} className="button-primary">{savingEditions ? 'Menyimpan' : 'Simpan edisi'}</button></div><div className="mt-5 grid gap-2">{availableEditions.length === 0 ? <Empty text="Belum ada edisi." /> : availableEditions.map((edition) => { const selected = selectedEditionIds.includes(edition.id); const conflict = edition.organizationPeriodId !== null && edition.organizationPeriodId !== period.id; return <div key={edition.id} className="rounded-lg border border-border p-3"><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={selected} disabled={!canEdit} onChange={(event) => { setSelectedEditionIds((current) => event.target.checked ? [...new Set([...current, edition.id])] : current.filter((id) => id !== edition.id)); if (!event.target.checked) setConfirmedReassignmentIds((current) => current.filter((id) => id !== edition.id)) }} className="mt-0.5 size-4 accent-dgb" /><span className="min-w-0 flex-1"><span className="block font-semibold text-dgb-900">{edition.name} ({edition.year})</span>{conflict && <span className="mt-1 block text-xs text-muted-foreground">Saat ini terhubung ke {edition.organizationPeriodLabel ?? 'periode lain'}.</span>}</span></label>{selected && conflict && <label className="mt-3 flex items-start gap-3 rounded-md bg-fb-50 p-2.5 text-xs text-fb-900"><input type="checkbox" checked={confirmedReassignmentIds.includes(edition.id)} disabled={!canEdit} onChange={(event) => setConfirmedReassignmentIds((current) => event.target.checked ? [...new Set([...current, edition.id])] : current.filter((id) => id !== edition.id))} className="mt-0.5 size-4 accent-fb" />Konfirmasi pindahkan edisi ini ke periode {period.label}</label>}</div> })}</div></section>

            <section className="mt-6 rounded-xl border border-border bg-white p-5 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-fb-500">Struktur</p><h2 className="mt-1 font-montserrat text-xl font-semibold text-dgb-900">Unit organisasi</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Hierarki dibatasi maksimal 4 tingkat dan tidak boleh membentuk siklus.</p></div>{canEdit && <form onSubmit={submitUnit} className="mt-5 grid gap-3 rounded-lg border border-dgb-100 bg-dgb-50/40 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_auto] sm:items-end"><Field label="Nama unit" error={createUnit.errors.name}><input value={createUnit.data.name} onChange={(event) => createUnit.setData('name', event.target.value)} placeholder="Contoh: Bidang Kebudayaan" required className="input" /></Field><Field label="Unit induk" error={createUnit.errors.parent_id}><select value={createUnit.data.parent_id} onChange={(event) => createUnit.setData('parent_id', event.target.value)} className="input"><option value="">Unit utama</option>{treeUnits.map((unit) => <option key={unit.id} value={unit.id}>{unitLabel(unit, treeUnits)}</option>)}</select></Field><Field label="Urutan" error={createUnit.errors.display_order}><input type="number" min={0} value={createUnit.data.display_order} onChange={(event) => createUnit.setData('display_order', Number(event.target.value))} className="input" /></Field><button type="submit" disabled={createUnit.processing} className="button-primary">Tambah unit</button></form>}<div className="mt-5 grid gap-3">{treeUnits.length === 0 ? <Empty text="Belum ada unit kerja." /> : treeUnits.map((unit) => <UnitEditor key={unit.id} unit={unit} units={treeUnits} canEdit={canEdit} onMove={moveUnit} />)}</div></section>

            <section className="mt-6 rounded-xl border border-border bg-white p-5 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-fb-500">Penugasan</p><h2 className="mt-1 font-montserrat text-xl font-semibold text-dgb-900">Pengurus per unit</h2></div>{canEdit && <form onSubmit={submitMember} className="mt-5 grid gap-3 rounded-lg border border-dgb-100 bg-dgb-50/40 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_8rem_auto] sm:items-end"><Field label="Unit" error={createMember.errors.organization_unit_id}><select value={createMember.data.organization_unit_id} onChange={(event) => createMember.setData('organization_unit_id', event.target.value)} className="input"><option value="">Pilih unit</option>{treeUnits.map((unit) => <option key={unit.id} value={unit.id}>{unitLabel(unit, treeUnits)}</option>)}</select></Field><Field label="Profil orang" error={createMember.errors.person_id}><select value={createMember.data.person_id} onChange={(event) => createMember.setData('person_id', event.target.value)} className="input"><option value="">Pilih profil</option>{peopleOptions.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field><Field label="Jabatan" error={createMember.errors.title}><input value={createMember.data.title} onChange={(event) => createMember.setData('title', event.target.value)} placeholder="Contoh: Ketua" required className="input" /></Field><Field label="Urutan" error={createMember.errors.display_order}><input type="number" min={0} value={createMember.data.display_order} onChange={(event) => createMember.setData('display_order', Number(event.target.value))} className="input" /></Field><button type="submit" disabled={createMember.processing || treeUnits.length === 0 || peopleOptions.length === 0} className="button-primary">Tambah</button></form>}<div className="mt-5 grid gap-3">{members.length === 0 ? <Empty text="Belum ada penugasan pada periode ini." /> : members.map((member) => <MembershipEditor key={`${member.id}:${member.version}`} member={member} units={treeUnits} people={peopleOptions} canEdit={canEdit} />)}</div></section>

            <section className="mt-6 rounded-xl border border-border bg-white p-5 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-fb-500">Rekonsiliasi</p><h2 className="mt-1 font-montserrat text-xl font-semibold text-dgb-900">Petakan penugasan lama</h2></div>{legacyAssignments.filter((assignment) => !assignment.isMapped).length === 0 ? <p className="mt-4 rounded-md bg-muted p-4 text-sm text-muted-foreground">Tidak ada penugasan lama yang belum dipetakan.</p> : <div className="mt-4 grid gap-3">{legacyAssignments.filter((assignment) => !assignment.isMapped).map((assignment) => <LegacyMapper key={assignment.id} assignment={assignment} periodId={period.id} units={treeUnits} people={peopleOptions} canEdit={canEdit} />)}</div>}</section>
        </section>
    </>
}

function UnitEditor({ unit, units, canEdit, onMove }: { unit: Unit; units: Unit[]; canEdit: boolean; onMove: (unit: Unit, direction: -1 | 1) => void }) {
    const form = useForm<UnitFormData>({ parent_id: unit.parentId ?? '', name: unit.name, display_order: unit.displayOrder, active: unit.active })
    const siblings = units.filter((candidate) => candidate.parentId === unit.parentId)
    const depth = unitDepth(unit, units)
    const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (canEdit) form.put(`/admin/organization/units/${unit.id}`, { preserveScroll: true }) }
    const remove = () => { if (canEdit && window.confirm(`Hapus unit ${unit.name}?`)) form.delete(`/admin/organization/units/${unit.id}`, { preserveScroll: true }) }

    return <form onSubmit={submit} className="rounded-lg border border-border p-4" style={{ marginLeft: `${Math.min(depth - 1, 3) * 1.25}rem` }}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Tingkat {depth}</p><p className="mt-1 font-semibold text-dgb-900">{unit.name}</p></div>{canEdit && <div className="flex flex-wrap gap-1"><button type="button" onClick={() => onMove(unit, -1)} disabled={siblings.findIndex((candidate) => candidate.id === unit.id) <= 0} className="button-small" aria-label={`Naikkan ${unit.name}`}>Naik</button><button type="button" onClick={() => onMove(unit, 1)} disabled={siblings.findIndex((candidate) => candidate.id === unit.id) >= siblings.length - 1} className="button-small" aria-label={`Turunkan ${unit.name}`}>Turun</button><button type="button" onClick={remove} className="button-danger px-2 py-1 text-xs">Hapus</button></div>}</div>{canEdit && <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_auto] sm:items-end"><Field label="Nama unit" error={form.errors.name}><input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} className="input" /></Field><Field label="Unit induk" error={form.errors.parent_id}><select value={form.data.parent_id} onChange={(event) => form.setData('parent_id', event.target.value)} className="input"><option value="">Unit utama</option>{units.filter((candidate) => candidate.id !== unit.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{unitLabel(candidate, units)}</option>)}</select></Field><Field label="Urutan" error={form.errors.display_order}><input type="number" min={0} value={form.data.display_order} onChange={(event) => form.setData('display_order', Number(event.target.value))} className="input" /></Field><button type="submit" disabled={form.processing} className="button-outline">Simpan</button></div>}</form>
}

function MembershipEditor({ member, units, people, canEdit }: { member: Member; units: Unit[]; people: PersonOption[]; canEdit: boolean }) {
    const form = useForm<MembershipFormData>({ organization_unit_id: member.unitId, person_id: member.personId, title: member.title, display_order: member.displayOrder, active: member.active, version: member.version })
    const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (canEdit) form.put(`/admin/organization/memberships/${member.id}`, { preserveScroll: true }) }
    const remove = () => { if (canEdit && window.confirm(`Hapus penugasan ${member.title}?`)) form.delete(`/admin/organization/memberships/${member.id}`, { preserveScroll: true }) }

    return <form onSubmit={submit} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_8rem_auto] sm:items-end"><Field label="Unit" error={form.errors.organization_unit_id}><select value={form.data.organization_unit_id} onChange={(event) => form.setData('organization_unit_id', event.target.value)} disabled={!canEdit} className="input"><option value="">Pilih unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unitLabel(unit, units)}</option>)}</select></Field><Field label="Profil orang" error={form.errors.person_id}><select value={form.data.person_id} onChange={(event) => form.setData('person_id', event.target.value)} disabled={!canEdit} className="input">{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field><Field label="Jabatan" error={form.errors.title}><input value={form.data.title} onChange={(event) => form.setData('title', event.target.value)} disabled={!canEdit} className="input" /></Field><Field label="Urutan" error={form.errors.display_order}><input type="number" min={0} value={form.data.display_order} onChange={(event) => form.setData('display_order', Number(event.target.value))} disabled={!canEdit} className="input" /></Field><div className="flex gap-2"><button type="submit" disabled={!canEdit || form.processing} className="button-outline">Simpan</button><button type="button" onClick={remove} disabled={!canEdit || form.processing} className="button-danger px-2 py-2 text-xs">Hapus</button></div>{form.errors.version && <p className="text-xs font-normal text-red-700 sm:col-span-5">{form.errors.version}</p>}</form>
}

function LegacyMapper({ assignment, periodId, units, people, canEdit }: { assignment: LegacyAssignment; periodId: string; units: Unit[]; people: PersonOption[]; canEdit: boolean }) {
    const form = useForm({ organization_unit_id: units[0]?.id ?? '', person_id: assignment.personId, title: assignment.title, legacy_assignment_id: assignment.id, organization_period_id: periodId })
    const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (canEdit) form.post('/admin/organization/legacy/map', { preserveScroll: true }) }

    return <form onSubmit={submit} className="grid gap-3 rounded-lg border border-fb-200 bg-fb-50/30 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"><div className="sm:col-span-4"><p className="text-sm font-semibold text-dgb-900">{assignment.personName} · {assignment.title}</p><p className="mt-1 text-xs text-muted-foreground">Sumber lama: {assignment.group}{assignment.termLabel ? ` · ${assignment.termLabel}` : ''}</p></div><Field label="Unit modern" error={form.errors.organization_unit_id}><select value={form.data.organization_unit_id} onChange={(event) => form.setData('organization_unit_id', event.target.value)} disabled={!canEdit} className="input"><option value="">Pilih unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unitLabel(unit, units)}</option>)}</select></Field><Field label="Profil orang" error={form.errors.person_id}><select value={form.data.person_id} onChange={(event) => form.setData('person_id', event.target.value)} disabled={!canEdit} className="input">{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field><Field label="Jabatan modern" error={form.errors.title}><input value={form.data.title} onChange={(event) => form.setData('title', event.target.value)} disabled={!canEdit} className="input" /></Field><button type="submit" disabled={!canEdit || form.processing || units.length === 0} className="button-primary">Petakan</button></form>
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactElement }) {
    return <label className="grid gap-1 text-xs font-semibold text-dgb-900"><span>{label}</span>{hint && <span className="font-normal text-muted-foreground">{hint}</span>}{children}{error && <span className="font-normal text-red-700">{error}</span>}</label>
}

function Empty({ text }: { text: string }) {
    return <div className="rounded-xl border border-dashed border-border bg-white p-7 text-center text-sm text-muted-foreground">{text}</div>
}

function unitDepth(unit: Unit, units: Unit[]): number {
    let depth = 1
    let parentId = unit.parentId
    const visited = new Set<string>()
    while (parentId && !visited.has(parentId)) {
        visited.add(parentId)
        depth += 1
        parentId = units.find((candidate) => candidate.id === parentId)?.parentId ?? null
    }

    return depth
}

function unitLabel(unit: Unit, units: Unit[]): string {
    return `${'· '.repeat(Math.max(0, unitDepth(unit, units) - 1))}${unit.name}`
}

function lifecycleLabel(value: string): string {
    if (value === 'active') return 'Aktif'
    if (value === 'archived') return 'Arsip'

    return 'Draft'
}

Period.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
