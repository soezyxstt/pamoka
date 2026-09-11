import { Link, useForm, usePage } from '@inertiajs/react'
import type { ReactNode } from 'react'

type AdminLayoutProps = {
    children: ReactNode
}

type EditionContext = {
    id: string
    year: number
    slug: string
    name: string
    lifecycle: string
}

type AdminSharedProps = {
    user: {
        name: string
        email: string
    }
    admin?: {
        activeEdition: EditionContext | null
        editions: EditionContext[]
    }
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const { props } = usePage<AdminSharedProps>()
    const { user, admin } = props
    const form = useForm({ edition_id: admin?.activeEdition?.id ?? '' })

    const selectEdition = (editionId: string) => {
        form.setData('edition_id', editionId)
        form.post('/admin/context/edition', { preserveScroll: true })
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="border-b border-border bg-white">
                <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
                    <Link href="/admin" className="font-montserrat text-sm font-extrabold tracking-[0.16em] text-dgb-900">
                        PAMOKA ADMIN
                    </Link>
                    <div className="flex items-center gap-4 text-right">
                        {admin?.editions && admin.editions.length > 0 && (
                            <label className="hidden items-center gap-2 text-left text-xs text-muted-foreground sm:flex">
                                <span className="sr-only">Edisi aktif</span>
                                <select
                                    value={form.data.edition_id}
                                    onChange={(event) => selectEdition(event.target.value)}
                                    disabled={form.processing}
                                    className="rounded-md border border-border bg-white px-2 py-2 text-sm font-semibold text-dgb-900 outline-none focus:border-dgb"
                                >
                                    {admin.editions.map((edition) => (
                                        <option key={edition.id} value={edition.id}>
                                            {edition.year} · {edition.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                        <div className="hidden sm:block">
                            <p className="text-sm font-semibold text-dgb-900">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <Link
                            href="/logout"
                            method="post"
                            as="button"
                            className="rounded-md border border-dgb px-3 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white"
                        >
                            Keluar
                        </Link>
                    </div>
                </div>
            </header>
            <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12">{children}</main>
        </div>
    )
}
