import { useForm } from '@inertiajs/react'
import type { ReactElement } from 'react'
import AdminLayout from '../../layouts/AdminLayout'

type AccessRequest = {
    id: string
    reason: string
    areas: string[]
    createdAt: string | null
    user: {
        name: string
        email: string
    }
}

type Role = {
    slug: string
    label: string
}

type UsersProps = {
    user: {
        name: string
        email: string
    }
    openRequests: AccessRequest[]
    assignableRoles: Role[]
}

function AccessRequestReview({ request, roles }: { request: AccessRequest; roles: Role[] }) {
    const form = useForm({ role: roles[0]?.slug ?? '', note: '' })

    return (
        <article className="rounded-xl border border-border bg-white p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="font-montserrat text-lg font-semibold text-dgb-900">{request.user.name}</h2>
                    <p className="text-sm text-muted-foreground">{request.user.email}</p>
                </div>
                <span className="rounded-md bg-fb-50 px-2 py-1 text-xs font-semibold text-dgb-800">Menunggu</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-foreground">{request.reason}</p>
            <p className="mt-3 text-xs text-muted-foreground">Area: {request.areas.length > 0 ? request.areas.join(', ') : 'Belum ditentukan'}</p>
            <form
                className="mt-5 grid gap-3 border-t border-border pt-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
                onSubmit={(event) => {
                    event.preventDefault()
                    form.post(`/admin/users/access-requests/${request.id}/approve`)
                }}
            >
                <label className="grid gap-1 text-xs font-semibold text-dgb-900">
                    Role
                    <select
                        value={form.data.role}
                        onChange={(event) => form.setData('role', event.target.value)}
                        className="rounded-md border border-border px-3 py-2 text-sm font-normal outline-none focus:border-dgb"
                    >
                        {roles.map((role) => (
                            <option key={role.slug} value={role.slug}>
                                {role.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold text-dgb-900">
                    Catatan
                    <input
                        value={form.data.note}
                        onChange={(event) => form.setData('note', event.target.value)}
                        maxLength={500}
                        className="rounded-md border border-border px-3 py-2 text-sm font-normal outline-none focus:border-dgb"
                        placeholder="Opsional"
                    />
                </label>
                <button
                    type="submit"
                    disabled={form.processing || roles.length === 0}
                    className="rounded-md bg-dgb px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-dgb-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Setujui
                </button>
            </form>
            {form.errors.role && <p className="mt-2 text-xs text-red-700">{form.errors.role}</p>}
        </article>
    )
}

export default function AdminUsers({ user, openRequests, assignableRoles }: UsersProps) {
    return (
        <section>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Operasional</p>
            <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Pengguna dan akses</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Tinjau permintaan akses dan tetapkan role yang sesuai. Super admin tetap dikelola melalui prosedur manual.
            </p>
            <div className="mt-8 grid gap-4">
                {openRequests.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-white p-8 text-sm text-muted-foreground">
                        Belum ada permintaan akses terbuka.
                    </div>
                ) : (
                    openRequests.map((request) => <AccessRequestReview key={request.id} request={request} roles={assignableRoles} />)
                )}
            </div>
        </section>
    )
}

AdminUsers.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
