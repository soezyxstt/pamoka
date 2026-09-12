import { Head, Link } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import AdminLayout from '../../../layouts/AdminLayout'

type NewsArticle = {
    id: string
    title: string
    slug: string
    excerpt: string | null
    status: string
    version: number
    publishedAt: string | null
    createdAt: string | null
    coverUrl: string | null
    coverAlt: string | null
}

type NewsIndexProps = {
    editionName: string
    articles: NewsArticle[]
    canEdit: boolean
}

const statusOptions = [
    { value: 'all', label: 'Semua' },
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Terbit' },
    { value: 'archived', label: 'Arsip' },
] as const

type StatusFilter = (typeof statusOptions)[number]['value']

export default function Index({ editionName, articles, canEdit }: NewsIndexProps) {
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState<StatusFilter>('all')

    const filteredArticles = useMemo(() => {
        const query = search.trim().toLowerCase()

        return articles.filter((article) => {
            const matchesSearch = query === ''
                || article.title.toLowerCase().includes(query)
                || article.slug.toLowerCase().includes(query)
                || (article.excerpt?.toLowerCase().includes(query) ?? false)
            const matchesStatus = status === 'all' || article.status === status

            return matchesSearch && matchesStatus
        })
    }, [articles, search, status])

    return (
        <>
            <Head title="Berita" />
            <section>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Studio editorial</p>
                        <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Berita</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                            Kelola berita untuk {editionName}. Setiap perubahan tersimpan sebagai versi dan tercatat pada audit.
                        </p>
                    </div>
                    {canEdit && (
                        <Link
                            href="/admin/content/news/new"
                            className="inline-flex min-h-10 items-center justify-center rounded-md bg-dgb px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-dgb-600"
                        >
                            Tulis berita baru
                        </Link>
                    )}
                </div>

                <div className="mt-8 grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    <label className="grid gap-1 text-xs font-semibold text-dgb-900">
                        Cari berita
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Judul, slug, atau ringkasan"
                            className="min-h-10 rounded-md border border-border bg-white px-3 text-sm font-normal outline-none focus:border-dgb"
                        />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-dgb-900">
                        Status
                        <select
                            value={status}
                            onChange={(event) => setStatus(event.target.value as StatusFilter)}
                            className="min-h-10 rounded-md border border-border bg-white px-3 text-sm font-normal outline-none focus:border-dgb"
                        >
                            {statusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label} ({option.value === 'all' ? articles.length : articles.filter((article) => article.status === option.value).length})
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="mt-5 grid gap-3">
                    {filteredArticles.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">
                            {articles.length === 0 ? 'Belum ada berita pada edisi ini.' : 'Tidak ada berita yang sesuai dengan filter.'}
                        </div>
                    ) : (
                        filteredArticles.map((article) => (
                            <Link
                                key={article.id}
                                href={`/admin/content/news/${article.id}`}
                                className="group grid gap-4 rounded-xl border border-border bg-white p-4 transition-colors hover:border-dgb-300 sm:grid-cols-[8rem_1fr_auto] sm:items-center"
                            >
                                <div className="h-24 overflow-hidden rounded-lg border border-border bg-dgb-50/50">
                                    {article.coverUrl ? (
                                        <img src={article.coverUrl} alt={article.coverAlt ?? article.title} className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                    ) : (
                                        <div className="grid size-full place-items-center text-xs font-semibold text-dgb-700">Tanpa sampul</div>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        <span className="rounded-md bg-dgb-50 px-2 py-1 font-semibold text-dgb-800">{statusLabel(article.status)}</span>
                                        <span>Versi {article.version}</span>
                                    </div>
                                    <h2 className="mt-2 truncate font-montserrat text-base font-bold text-dgb-900">{article.title}</h2>
                                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">/berita/{article.slug}</p>
                                    {article.excerpt && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{article.excerpt}</p>}
                                </div>
                                <div className="text-left text-xs text-muted-foreground sm:text-right">
                                    <p>{article.publishedAt ? `Terbit ${formatDate(article.publishedAt)}` : `Dibuat ${formatDate(article.createdAt)}`}</p>
                                    <p className="mt-1 font-semibold text-dgb-700">Buka editor</p>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </section>
        </>
    )
}

Index.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>

function statusLabel(status: string): string {
    if (status === 'published') return 'Terbit'
    if (status === 'archived') return 'Arsip'

    return 'Draft'
}

function formatDate(value: string | null): string {
    if (!value) return 'Tanggal belum tersedia'

    return new Date(value).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })
}
