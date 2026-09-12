import { Head, Link } from '@inertiajs/react'
import type { ReactElement } from 'react'
import AdminLayout from '../../layouts/AdminLayout'

type Props = {
    user: {
        name: string
        email: string
    }
    profileStatus: string
    roles: Array<{ slug: string; label: string }>
    permissions: string[]
}

export default function AdminProfile({ user, profileStatus, roles, permissions }: Props) {
    return <>
        <Head title="Profil admin" />
        <section><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Akun / profil</p><h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Profil admin</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Identitas dan izin efektif yang sedang digunakan pada ruang kerja ini.</p></div><Link href="/admin" className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Kembali ke dashboard</Link></div><div className="mt-8 max-w-3xl rounded-xl border border-border bg-white p-5 sm:p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="grid size-20 shrink-0 place-items-center rounded-md bg-dgb text-2xl font-semibold text-white">{initials(user.name)}</div><div><h2 className="font-montserrat text-xl font-semibold text-dgb-900">{user.name}</h2><p className="mt-1 text-sm text-muted-foreground">{user.email}</p><span className="mt-3 inline-flex rounded-md bg-dgb-50 px-2.5 py-1 text-xs font-semibold text-dgb-800">Status {statusLabel(profileStatus)}</span></div></div><div className="mt-7 border-t border-border pt-6"><h3 className="text-sm font-semibold text-dgb-900">Role</h3><div className="mt-3 flex flex-wrap gap-2">{roles.length === 0 ? <span className="text-sm text-muted-foreground">Belum ada role.</span> : roles.map((role) => <span key={role.slug} className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">{role.label}</span>)}</div><h3 className="mt-6 text-sm font-semibold text-dgb-900">Izin efektif</h3><p className="mt-1 text-xs text-muted-foreground">Izin dihitung dari role dan override akun.</p><div className="mt-3 flex flex-wrap gap-2">{permissions.length === 0 ? <span className="text-sm text-muted-foreground">Belum ada izin efektif.</span> : permissions.map((permission) => <span key={permission} className="rounded-md bg-dgb-50 px-2.5 py-1 text-xs font-medium text-dgb-800">{permission}</span>)}</div></div></div></section>
    </>
}

AdminProfile.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>

function initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}

function statusLabel(value: string): string {
    if (value === 'active') return 'Aktif'
    if (value === 'rejected') return 'Ditolak'
    if (value === 'suspended') return 'Ditangguhkan'

    return 'Menunggu'
}
