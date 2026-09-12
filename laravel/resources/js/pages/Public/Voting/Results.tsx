import { Head, Link } from '@inertiajs/react'

type Result = {
    name: string
    slug: string
    number: number
    image: string | null
    percentage: number
    amount: number | null
}

type VotingCategory = {
    slug: string
    code: string
    label: string
}

type ResultsProps = {
    meta: {
        title: string
        description: string
    }
    pageTitle: string
    category: VotingCategory
    categories: VotingCategory[]
    campaign: {
        name: string
        statusLabel: string
        resultVisibility: string
    } | null
    results: Result[]
    hasPublishedResults: boolean
    summary: {
        participantCount: number
        leader: string | null
    }
    emptyState: string | null
}

export default function Results({
    meta,
    pageTitle,
    category,
    categories,
    campaign,
    results,
    hasPublishedResults,
    summary,
    emptyState,
}: ResultsProps) {
    return (
        <>
            <Head title={meta.title}>
                <meta name="description" content={meta.description} />
            </Head>

            <main className="min-h-screen bg-dgb-900 px-5 py-16 text-white sm:px-8 md:px-12 md:py-24">
                <div className="mx-auto w-full max-w-7xl">
                    <header className="mx-auto max-w-3xl text-center">
                        <p className="font-montserrat text-xs font-bold uppercase tracking-[0.2em] text-fb-300">
                            Pasanggiri Mojang Jajaka Kabupaten Garut
                        </p>
                        <h1 className="mt-3 font-montserrat text-3xl font-semibold uppercase leading-tight sm:text-4xl md:text-5xl">{pageTitle}</h1>
                        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/80">
                            Peringkat dan persentase dukungan finalis ditampilkan berdasarkan visibility hasil campaign.
                        </p>
                    </header>

                    <nav className="mx-auto mt-7 grid max-w-xl grid-cols-2 gap-2 rounded-xl bg-white/15 p-2 sm:flex sm:w-fit" aria-label="Kategori hasil voting">
                        {categories.map((item) => (
                            <Link
                                key={item.slug}
                                href={`/voting/hasil/${item.slug}`}
                                aria-current={item.slug === category.slug ? 'page' : undefined}
                                className={`rounded-md border border-fb px-3 py-2 text-center text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${item.slug === category.slug ? 'bg-fb text-dgb-900' : 'text-white hover:bg-white/10'}`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <section className="mt-5 overflow-hidden rounded-xl border border-white/20 bg-white/10 backdrop-blur-md">
                        <div className="border-b border-white/20 px-5 py-5 sm:px-7 sm:py-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-fb-300">Kategori aktif</p>
                                    <h2 className="mt-1 font-montserrat text-2xl font-semibold text-white md:text-3xl">{category.label}</h2>
                                </div>
                                <div className="rounded-md border border-fb px-3 py-2 text-xs font-semibold text-white">
                                    {hasPublishedResults ? 'Hasil tersedia' : campaign ? 'Menunggu hasil' : 'Campaign belum tersedia'}
                                </div>
                            </div>
                        </div>

                        <div className="grid border-b border-white/20 bg-dgb-900/25 sm:grid-cols-2">
                            <Summary label="Jumlah finalis" value={`${summary.participantCount} orang`} />
                            <Summary label="Peringkat pertama" value={summary.leader ?? 'Belum ditetapkan'} />
                        </div>

                        <div className="p-5 sm:p-7">
                            {hasPublishedResults ? (
                                <ol className="grid gap-3" aria-label={`Peringkat ${category.label}`}>
                                    {results.map((result, index) => (
                                        <li key={result.slug} className="grid gap-3 rounded-lg border border-white/15 bg-dgb-900/35 p-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_6rem] sm:items-center">
                                            <span className="grid size-9 place-items-center rounded-md border border-fb font-montserrat text-sm font-bold text-white">{index + 1}</span>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-white sm:text-base">{result.name}</p>
                                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
                                                    <div className="h-full rounded-full bg-fb" style={{ width: `${Math.min(100, Math.max(0, result.percentage))}%` }} />
                                                </div>
                                            </div>
                                            <p className="font-montserrat text-lg font-semibold text-white sm:text-right">{result.percentage.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%</p>
                                        </li>
                                    ))}
                                </ol>
                            ) : (
                                <div>
                                    <div className="rounded-xl border border-dashed border-fb bg-dgb-900/35 px-5 py-8 text-center">
                                        <h3 className="font-montserrat text-lg font-semibold text-white">Hasil belum tersedia</h3>
                                        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/75">{emptyState ?? 'Belum ada dukungan yang dapat dihitung untuk kategori ini.'}</p>
                                    </div>
                                    {results.length > 0 ? (
                                        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                            {results.map((result, index) => (
                                                <div key={result.slug} className="flex items-center gap-3 rounded-lg border border-white/15 bg-dgb-900/30 px-3 py-3">
                                                    <span className="grid size-8 shrink-0 place-items-center rounded-md border border-fb text-xs font-bold text-white">{index + 1}</span>
                                                    <span className="min-w-0 truncate text-sm font-medium text-white">{result.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </>
    )
}

function Summary({ label, value }: { label: string; value: string }) {
    return (
        <div className="border-white/20 px-5 py-4 sm:px-7">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">{label}</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-white">{value}</p>
        </div>
    )
}
