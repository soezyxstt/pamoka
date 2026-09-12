import { Head } from '@inertiajs/react'
import type { ReactElement } from 'react'
import AdminLayout from '../../layouts/AdminLayout'

type MonitorCategory = {
    code: string
    label: string
    candidateCount: number
    totalAmount: number
    top: Array<{
        name: string
        shortName: string
        totalAmount: number
    }>
}

type MonitorProps = {
    meta: {
        title: string
        description: string
    }
    pageTitle: string
    edition: {
        year: number
        name: string
    } | null
    campaign: {
        name: string
        statusLabel: string
        pricePerPoint: number
    } | null
    categories: MonitorCategory[]
    totalAmount: number
    emptyState: string | null
}

export default function Monitor({ meta, pageTitle, edition, campaign, categories, totalAmount, emptyState }: MonitorProps) {
    return (
        <>
            <Head title={meta.title}>
                <meta name="description" content={meta.description} />
            </Head>

            <section className="grid gap-8">
                <header className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Operasional · voting</p>
                        <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">{pageTitle}</h1>
                        <p className="mt-2 text-sm text-muted-foreground">{edition ? `${edition.name} · ${campaign?.name ?? 'Belum ada campaign'}` : 'Belum ada edisi aktif'}</p>
                    </div>
                    {campaign ? <span className="rounded-md border border-fb px-3 py-2 text-xs font-semibold text-fb-700">{campaign.statusLabel}</span> : null}
                </header>

                {campaign ? (
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Stat label="Total voting" value={formatAmount(totalAmount)} />
                        <Stat label="Harga per poin" value={formatAmount(campaign.pricePerPoint)} />
                        <Stat label="Kategori" value={`${categories.length} kategori`} />
                    </div>
                ) : null}

                {emptyState ? <p className="rounded-xl border border-dashed border-dgb-200 bg-white p-8 text-center text-sm text-dgb-700">{emptyState}</p> : null}

                {categories.map((category) => (
                    <section key={category.code} className="grid gap-4 rounded-xl border border-border bg-white p-5 shadow-sm">
                        <div className="flex items-end justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">{category.code}</p>
                                <h2 className="mt-1 font-montserrat text-xl font-semibold text-dgb-900">Top 3 {category.label}</h2>
                            </div>
                            <p className="text-sm font-semibold text-dgb-700">{formatAmount(category.totalAmount)}</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[28rem] text-left text-sm">
                                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-3 font-semibold">Nama</th>
                                        <th className="px-3 py-3 text-right font-semibold">Total vote</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {category.top.map((candidate) => (
                                        <tr key={candidate.name} className="border-b border-border last:border-0">
                                            <td className="px-3 py-3 font-medium text-dgb-900">{candidate.shortName}</td>
                                            <td className="px-3 py-3 text-right text-dgb-700">{formatAmount(candidate.totalAmount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ))}
            </section>
        </>
    )
}

Monitor.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 font-montserrat text-2xl font-semibold text-dgb-900">{value}</p>
        </div>
    )
}

function formatAmount(value: number): string {
    return `Rp${value.toLocaleString('id-ID')}`
}
