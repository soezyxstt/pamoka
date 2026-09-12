import { Head, Link, router, useForm } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import type { FormEvent, ReactElement, ReactNode } from 'react'
import AdminLayout from '../../../layouts/AdminLayout'

type Unit = {
    id: string
    editionId: string
    parentId: string | null
    name: string
    displayOrder: number
    active: boolean
    memberCount: number
}

type Member = {
    id: string
    unitId: string
    personId: string
    title: string
    displayOrder: number
    active: boolean
    version: number
    unitName: string | null
    personName: string | null
    personSlug: string | null
    portraitUrl: string | null
    shortBio: string | null
}

type PersonOption = {
    id: string
    name: string
    slug: string
    shortBio: string | null
    portraitMediaId: string | null
    portraitUrl: string | null
}

type MediaOption = {
    id: string
    url: string
    filename: string
    alt: string | null
}

type Props = {
    editionName: string
    units: Unit[]
    members: Member[]
    people: PersonOption[]
    mediaOptions: MediaOption[]
    canEdit: boolean
}

type FlatUnit = Unit & { level: number }

export default function Index({ editionName, units, members, people, mediaOptions, canEdit }: Props) {
    const flatUnits = useMemo(() => flattenUnits(units), [units])
    const [activeMemberFilter, setActiveMemberFilter] = useStateFilter()
    const filteredMembers = useMemo(() => {
        return members.filter((member) => {
            if (activeMemberFilter.unitId !== 'all' && member.unitId !== activeMemberFilter.unitId) return false
            if (activeMemberFilter.status === 'active' && !member.active) return false
            if (activeMemberFilter.status === 'inactive' && member.active) return false
            const query = activeMemberFilter.search.trim().toLowerCase()
            if (query === '') return true

            return [member.personName, member.title, member.unitName]
                .filter((value): value is string => value !== null)
                .some((value) => value.toLowerCase().includes(query))
        })
    }, [activeMemberFilter, members])

    const reorderUnit = (unit: FlatUnit, direction: -1 | 1) => {
        if (!canEdit) return
        const siblings = units
            .filter((candidate) => candidate.parentId === unit.parentId)
            .sort((left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name))
        const currentIndex = siblings.findIndex((candidate) => candidate.id === unit.id)
        const targetIndex = currentIndex + direction
        if (currentIndex < 0 || targetIndex < 0 || targetIndex >= siblings.length) return

        const reordered = [...siblings]
        const [moved] = reordered.splice(currentIndex, 1)
        if (!moved) return
        reordered.splice(targetIndex, 0, moved)
        router.post('/admin/content/committee/units/reorder', {
            items: reordered.map((candidate, index) => ({ id: candidate.id, display_order: index })),
        }, { preserveScroll: true })
    }

    return (
        <>
            <Head title="Panitia" />
            <section>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Konten edisi</p>
                        <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Panitia</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Susun unit dan penugasan panitia untuk {editionName}. Setiap perubahan tercatat pada audit.</p>
                    </div>
                    <Link href="/admin" className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Kembali ke dashboard</Link>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                    <Stat label="Unit" value={units.length} />
                    <Stat label="Unit aktif" value={units.filter((unit) => unit.active).length} />
                    <Stat label="Penugasan" value={members.length} />
                </div>

                {canEdit && <UnitCreator units={flatUnits} />}

                <section className="mt-8 rounded-xl border border-border bg-white p-4 sm:p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-fb-500">Struktur</p>
                            <h2 className="mt-1 font-montserrat text-xl font-semibold text-dgb-900">Unit panitia</h2>
                        </div>
                        <p className="text-xs text-muted-foreground">Maksimal 4 tingkat kedalaman</p>
                    </div>
                    <div className="mt-4 grid gap-2">
                        {flatUnits.length === 0 ? <Empty text="Belum ada unit panitia pada edisi ini." /> : flatUnits.map((unit) => <UnitRow key={unit.id} unit={unit} units={flatUnits} canEdit={canEdit} onMove={reorderUnit} />)}
                    </div>
                </section>

                {canEdit && <QuickPersonCreator mediaOptions={mediaOptions} />}

                {canEdit && <AssignmentCreator units={flatUnits} people={people} memberCount={members.length} />}

                <section className="mt-8 rounded-xl border border-border bg-white p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-fb-500">Direktori edisi</p>
                            <h2 className="mt-1 font-montserrat text-xl font-semibold text-dgb-900">Penugasan panitia</h2>
                        </div>
                        <span className="text-sm text-muted-foreground">{filteredMembers.length} dari {members.length}</span>
                    </div>
                    <div className="mt-4 grid gap-3 rounded-lg border border-dgb-100 bg-dgb-50/30 p-3 sm:grid-cols-[minmax(0,1fr)_12rem_10rem]">
                        <label className="grid gap-1 text-xs font-semibold text-dgb-900">Cari anggota
                            <input value={activeMemberFilter.search} onChange={(event) => setActiveMemberFilter({ search: event.target.value })} placeholder="Nama, jabatan, atau unit" className="input" />
                        </label>
                        <label className="grid gap-1 text-xs font-semibold text-dgb-900">Unit
                        <select value={activeMemberFilter.unitId} onChange={(event) => setActiveMemberFilter({ unitId: event.target.value })} className="input"><option value="all">Semua unit</option>{flatUnits.map((unit) => <option key={unit.id} value={unit.id}>{unitLabel(unit)}</option>)}</select>
                        </label>
                        <label className="grid gap-1 text-xs font-semibold text-dgb-900">Status
                            <select value={activeMemberFilter.status} onChange={(event) => setActiveMemberFilter({ status: event.target.value as MemberStatus })} className="input"><option value="all">Semua</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select>
                        </label>
                    </div>
                    <div className="mt-4 grid gap-2">
                        {filteredMembers.length === 0 ? <Empty text={members.length === 0 ? 'Belum ada penugasan panitia.' : 'Tidak ada penugasan yang sesuai filter.'} /> : filteredMembers.map((member) => <MemberRow key={`${member.id}:${member.version}`} member={member} units={flatUnits} people={people} canEdit={canEdit} />)}
                    </div>
                </section>
            </section>
        </>
    )
}

type MemberStatus = 'all' | 'active' | 'inactive'

function useStateFilter() {
    const [state, setState] = useState({ search: '', unitId: 'all', status: 'all' as MemberStatus })
    return [state, (next: Partial<typeof state>) => setState((current) => ({ ...current, ...next }))] as const
}

function UnitCreator({ units }: { units: FlatUnit[] }) {
    const form = useForm({ name: '', parent_id: '', display_order: units.length, active: true })
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        form.post('/admin/content/committee/units', { preserveScroll: true, onSuccess: () => form.reset() })
    }

    return <section className="mt-8 rounded-xl border border-dgb-100 bg-dgb-50/40 p-4 sm:p-5"><h2 className="font-montserrat text-lg font-semibold text-dgb-900">Tambah unit panitia</h2><form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_auto] sm:items-end"><Field label="Nama unit" error={form.errors.name}><input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} placeholder="Contoh: Divisi Acara" required className="input" /></Field><Field label="Unit induk" error={form.errors.parent_id}><select value={form.data.parent_id} onChange={(event) => form.setData('parent_id', event.target.value)} className="input"><option value="">Unit utama</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unitLabel(unit)}</option>)}</select></Field><Field label="Urutan" error={form.errors.display_order}><input type="number" min={0} value={form.data.display_order} onChange={(event) => form.setData('display_order', Number(event.target.value))} className="input" /></Field><button type="submit" disabled={form.processing} className="button-primary">{form.processing ? 'Menyimpan' : 'Tambah unit'}</button></form></section>
}

function UnitRow({ unit, units, canEdit, onMove }: { unit: FlatUnit; units: FlatUnit[]; canEdit: boolean; onMove: (unit: FlatUnit, direction: -1 | 1) => void }) {
    const form = useForm({ name: unit.name, parent_id: unit.parentId ?? '', display_order: unit.displayOrder, active: unit.active })
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        form.put(`/admin/content/committee/units/${unit.id}`, { preserveScroll: true })
    }
    const remove = () => {
        if (!window.confirm(`Hapus unit ${unit.name} beserta turunannya?`)) return
        router.delete(`/admin/content/committee/units/${unit.id}`, { preserveScroll: true })
    }
    const siblings = units.filter((candidate) => candidate.parentId === unit.parentId).sort((left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name))
    const siblingIndex = siblings.findIndex((candidate) => candidate.id === unit.id)

    return <form onSubmit={submit} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_8rem_8rem_auto] sm:items-end" style={{ marginLeft: `${Math.min(unit.level - 1, 3) * 1.25}rem` }}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-dgb-50 px-2 py-1 text-xs font-semibold text-dgb-800">Tingkat {unit.level}</span><span className={unit.active ? 'rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800' : 'rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground'}>{unit.active ? 'Aktif' : 'Nonaktif'}</span><span className="text-xs text-muted-foreground">{unit.memberCount} penugasan</span></div><label className="mt-2 grid gap-1 text-xs font-semibold text-dgb-900">Nama unit<input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} disabled={!canEdit} className="input" /></label>{form.errors.name && <p className="mt-1 text-xs text-red-700">{form.errors.name}</p>}</div><Field label="Unit induk" error={form.errors.parent_id}><select value={form.data.parent_id} onChange={(event) => form.setData('parent_id', event.target.value)} disabled={!canEdit} className="input"><option value="">Unit utama</option>{units.filter((candidate) => candidate.id !== unit.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{unitLabel(candidate)}</option>)}</select></Field><Field label="Urutan" error={form.errors.display_order}><input type="number" min={0} value={form.data.display_order} onChange={(event) => form.setData('display_order', Number(event.target.value))} disabled={!canEdit} className="input" /></Field><Field label="Status" error={form.errors.active}><select value={form.data.active ? '1' : '0'} onChange={(event) => form.setData('active', event.target.value === '1')} disabled={!canEdit} className="input"><option value="1">Aktif</option><option value="0">Nonaktif</option></select></Field><div className="flex flex-wrap items-center gap-2 sm:justify-end"><button type="button" onClick={() => onMove(unit, -1)} disabled={!canEdit || siblingIndex <= 0} className="button-outline px-3 py-2" aria-label={`Pindahkan ${unit.name} ke atas`}>↑</button><button type="button" onClick={() => onMove(unit, 1)} disabled={!canEdit || siblingIndex === siblings.length - 1} className="button-outline px-3 py-2" aria-label={`Pindahkan ${unit.name} ke bawah`}>↓</button><button type="submit" disabled={!canEdit || form.processing} className="button-primary">Simpan</button><button type="button" onClick={remove} disabled={!canEdit || form.processing} className="button-danger">Hapus</button></div></form>
}

function QuickPersonCreator({ mediaOptions }: { mediaOptions: MediaOption[] }) {
    const form = useForm({ name: '', short_bio: '', portrait_media_id: '' })
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        form.post('/admin/content/committee/people', { preserveScroll: true, onSuccess: () => form.reset() })
    }

    return <section className="mt-8 rounded-xl border border-fb-100 bg-fb-50/30 p-4 sm:p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-fb-500">Direktori bersama</p><h2 className="mt-1 font-montserrat text-lg font-semibold text-dgb-900">Tambah profil orang</h2><p className="mt-2 text-sm text-muted-foreground">Profil ini dapat dipakai ulang pada penugasan panitia dan kepengurusan.</p><form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Nama lengkap" error={form.errors.name}><input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} required className="input" /></Field><Field label="Foto portrait" error={form.errors.portrait_media_id}><select value={form.data.portrait_media_id} onChange={(event) => form.setData('portrait_media_id', event.target.value)} className="input"><option value="">Tanpa foto</option>{mediaOptions.map((media) => <option key={media.id} value={media.id}>{media.filename}</option>)}</select></Field><Field label="Bio singkat" error={form.errors.short_bio}><textarea value={form.data.short_bio} onChange={(event) => form.setData('short_bio', event.target.value)} rows={2} className="textarea sm:col-span-2" /></Field><div className="sm:col-span-2"><button type="submit" disabled={form.processing} className="button-primary">{form.processing ? 'Menyimpan' : 'Tambah profil'}</button></div></form></section>
}

function AssignmentCreator({ units, people, memberCount }: { units: FlatUnit[]; people: PersonOption[]; memberCount: number }) {
    const form = useForm({ unit_id: units[0]?.id ?? '', person_id: people[0]?.id ?? '', title: '', display_order: memberCount, active: true })
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        form.post('/admin/content/committee/assignments', { preserveScroll: true, onSuccess: () => form.reset('title') })
    }

    return <section className="mt-8 rounded-xl border border-dgb-100 bg-dgb-50/40 p-4 sm:p-5"><h2 className="font-montserrat text-lg font-semibold text-dgb-900">Tambah penugasan</h2><form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_8rem_auto] sm:items-end"><Field label="Unit panitia" error={form.errors.unit_id}><select value={form.data.unit_id} onChange={(event) => form.setData('unit_id', event.target.value)} disabled={units.length === 0} className="input"><option value="">Pilih unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unitLabel(unit)}</option>)}</select></Field><Field label="Profil orang" error={form.errors.person_id}><select value={form.data.person_id} onChange={(event) => form.setData('person_id', event.target.value)} disabled={people.length === 0} className="input"><option value="">Pilih profil</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field><Field label="Jabatan" error={form.errors.title}><input value={form.data.title} onChange={(event) => form.setData('title', event.target.value)} placeholder="Contoh: Ketua Pelaksana" required className="input" /></Field><Field label="Urutan" error={form.errors.display_order}><input type="number" min={0} value={form.data.display_order} onChange={(event) => form.setData('display_order', Number(event.target.value))} className="input" /></Field><button type="submit" disabled={form.processing || units.length === 0 || people.length === 0} className="button-primary">{form.processing ? 'Menyimpan' : 'Tugaskan'}</button></form></section>
}

function MemberRow({ member, units, people, canEdit }: { member: Member; units: FlatUnit[]; people: PersonOption[]; canEdit: boolean }) {
    const form = useForm({ unit_id: member.unitId, person_id: member.personId, title: member.title, display_order: member.displayOrder, active: member.active, version: member.version })
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        form.put(`/admin/content/committee/assignments/${member.id}`, { preserveScroll: true })
    }
    const remove = () => {
        if (!window.confirm(`Hapus penugasan ${member.personName ?? 'ini'}?`)) return
        router.delete(`/admin/content/committee/assignments/${member.id}`, { data: { version: member.version }, preserveScroll: true })
    }

    return <form onSubmit={submit} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_8rem_8rem_auto] sm:items-end"><div className="size-14 overflow-hidden rounded-lg border border-border bg-dgb-50/50">{member.portraitUrl ? <img src={member.portraitUrl} alt={member.personName ?? 'Portrait panitia'} className="size-full object-cover" /> : <div className="grid size-full place-items-center text-[10px] font-semibold text-dgb-700">Tanpa foto</div>}</div><Field label="Unit" error={form.errors.unit_id}><select value={form.data.unit_id} onChange={(event) => form.setData('unit_id', event.target.value)} disabled={!canEdit} className="input">{units.map((unit) => <option key={unit.id} value={unit.id}>{unitLabel(unit)}</option>)}</select></Field><Field label="Profil" error={form.errors.person_id}><select value={form.data.person_id} onChange={(event) => form.setData('person_id', event.target.value)} disabled={!canEdit} className="input">{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field><Field label="Jabatan" error={form.errors.title}><input value={form.data.title} onChange={(event) => form.setData('title', event.target.value)} disabled={!canEdit} className="input" /></Field><Field label="Urutan" error={form.errors.display_order}><input type="number" min={0} value={form.data.display_order} onChange={(event) => form.setData('display_order', Number(event.target.value))} disabled={!canEdit} className="input" /></Field><Field label="Status" error={form.errors.active}><select value={form.data.active ? '1' : '0'} onChange={(event) => form.setData('active', event.target.value === '1')} disabled={!canEdit} className="input"><option value="1">Aktif</option><option value="0">Nonaktif</option></select></Field><div className="flex flex-wrap items-center gap-2 sm:justify-end"><button type="submit" disabled={!canEdit || form.processing} className="button-primary">Simpan</button><button type="button" onClick={remove} disabled={!canEdit || form.processing} className="button-danger">Hapus</button></div>{form.errors.version && <p className="text-xs text-red-700 sm:col-span-7">{form.errors.version}</p>}</form>
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return <label className="grid gap-1 text-xs font-semibold text-dgb-900"><span>{label}</span>{children}{error && <span className="font-normal text-red-700">{error}</span>}</label>
}

function Stat({ label, value }: { label: string; value: number }) {
    return <div className="rounded-xl border border-border bg-white p-4"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 font-montserrat text-2xl font-semibold text-dgb-900">{value}</p></div>
}

function Empty({ text }: { text: string }) {
    return <div className="rounded-xl border border-dashed border-border bg-white p-7 text-center text-sm text-muted-foreground">{text}</div>
}

function flattenUnits(units: Unit[]): FlatUnit[] {
    const children = new Map<string | null, Unit[]>()
    for (const unit of units) {
        const list = children.get(unit.parentId) ?? []
        list.push(unit)
        children.set(unit.parentId, list)
    }
    const flattened: FlatUnit[] = []
    const visit = (parentId: string | null, level: number) => {
        const siblings = [...(children.get(parentId) ?? [])].sort((left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name))
        for (const unit of siblings) {
            flattened.push({ ...unit, level })
            visit(unit.id, level + 1)
        }
    }
    visit(null, 1)

    return flattened
}

function unitLabel(unit: FlatUnit): string {
    return `${'· '.repeat(Math.max(0, unit.level - 1))}${unit.name}`
}

Index.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
