import { Head, Link } from '@inertiajs/react'
import type { ReactElement } from 'react'
import AdminLayout from '../../../layouts/AdminLayout'

type Edition = {
    id: string
    year: number
    name: string
    lifecycle: string
}

type Module = {
    slug: string
    label: string
    description: string
    href: string
    available: boolean
}

type Props = {
    edition: Edition | null
    modules: Module[]
}

export default function AdminContent({ edition, modules }: Props) {
    return <>
        <Head title="Kelola konten" />
        <section><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Studio konten</p><h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Kelola konten</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Pilih modul untuk edisi aktif.</p></div>{edition && <span className="inline-flex h-fit rounded-md bg-dgb-50 px-3 py-2 text-xs font-semibold text-dgb-800">{edition.year} · {edition.name}</span>}</div><div className="mt-8 divide-y divide-dgb-100 rounded-xl border border-dgb-100 bg-white">{modules.map((module) => <div key={module.slug} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h2 className="font-montserrat text-base font-semibold text-dgb-900">{module.label}</h2><p className="mt-1 text-sm text-muted-foreground">{module.description}</p></div>{module.available ? <Link href={module.href} className="inline-flex min-h-9 items-center justify-center rounded-md border border-dgb px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Buka</Link> : <span className="text-xs font-semibold text-muted-foreground">Tahap berikutnya</span>}</div>)}</div></section>
    </>
}

AdminContent.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
