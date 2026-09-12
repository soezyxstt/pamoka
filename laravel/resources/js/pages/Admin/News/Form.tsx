import { Head, Link, useForm } from '@inertiajs/react'
import { useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import AdminLayout from '../../../layouts/AdminLayout'
import TipTapEditor, { type TipTapDocument, type TipTapMediaOption } from '../../../components/Admin/TipTapEditor'

type Article = {
    id: string
    title: string
    slug: string
    excerpt: string | null
    body: string | null
    bodyJson: TipTapDocument | null
    kind: 'internal' | 'file' | 'external'
    sourceUrl: string | null
    coverMediaId: string | null
    status: string
    version: number
    publishedAt: string | null
}

type MediaOption = {
    id: string
    url: string
    filename: string
    alt: string | null
    lifecycle: string
}

type Revision = {
    id: string
    version: number
    reason: string | null
    createdAt: string | null
    author: {
        name: string
        email: string
    } | null
}

type NewsFormData = {
    title: string
    slug: string
    excerpt: string
    body: string
    body_json: string
    kind: Article['kind']
    source_url: string
    cover_media_id: string
    version?: number
}

type NewsFormProps = {
    editionName: string
    article: Article | null
    revisions: Revision[]
    coverMediaOptions: MediaOption[]
    bodyMediaOptions: TipTapMediaOption[]
    canEdit: boolean
    canPublish: boolean
}

export default function Form({ editionName, article, revisions, coverMediaOptions, bodyMediaOptions, canEdit, canPublish }: NewsFormProps) {
    const [slugCustomized, setSlugCustomized] = useState(article !== null)
    const initialBodyJson = article?.bodyJson ?? plainTextDocument(article?.body ?? null)
    const form = useForm<NewsFormData>({
        title: article?.title ?? '',
        slug: article?.slug ?? '',
        excerpt: article?.excerpt ?? '',
        body: article?.body ?? '',
        body_json: initialBodyJson ? JSON.stringify(initialBodyJson) : '',
        kind: article?.kind ?? 'internal',
        source_url: article?.sourceUrl ?? '',
        cover_media_id: article?.coverMediaId ?? '',
        version: article?.version,
    })

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canEdit) return

        if (article) {
            form.put(`/admin/content/news/${article.id}`)
        } else {
            form.post('/admin/content/news')
        }
    }

    const publish = () => {
        if (!article || !canPublish || form.processing) return
        form.post(`/admin/content/news/${article.id}/publish`, { preserveScroll: true })
    }

    const unpublish = () => {
        if (!article || !canPublish || form.processing || !window.confirm('Tarik berita ini kembali ke draft?')) return
        form.post(`/admin/content/news/${article.id}/unpublish`, { preserveScroll: true })
    }

    const archive = () => {
        if (!article || !canEdit || form.processing || !window.confirm('Arsipkan berita ini?')) return
        form.post(`/admin/content/news/${article.id}/archive`, { preserveScroll: true })
    }

    const destroy = () => {
        if (!article || !canEdit || form.processing || !window.confirm('Hapus berita ini beserta revision history-nya?')) return
        form.delete(`/admin/content/news/${article.id}`)
    }

    const selectedMedia = coverMediaOptions.find((media) => media.id === form.data.cover_media_id)
    const errorMessages = Object.values(form.errors)

    return (
        <>
            <Head title={article ? `Edit ${article.title}` : 'Tulis berita baru'} />
            <section>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <Link href="/admin/content/news" className="text-sm font-semibold text-dgb transition-colors hover:text-fb-500">
                            Kembali ke daftar berita
                        </Link>
                        <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Studio editorial</p>
                        <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">{article ? 'Edit berita' : 'Tulis berita baru'}</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                            Edisi {editionName}. Editor teks ini menyimpan isi sebagai paragraf terstruktur yang dapat dibaca halaman publik.
                        </p>
                    </div>
                    {article && <span className="rounded-md bg-dgb-50 px-3 py-2 text-sm font-semibold text-dgb-800">{statusLabel(article.status)} · versi {article.version}</span>}
                </div>

                {errorMessages.length > 0 && (
                    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
                        <p className="font-semibold">Periksa kembali isian berita.</p>
                        <ul className="mt-2 grid gap-1">
                            {errorMessages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
                        </ul>
                    </div>
                )}

                <form className="mt-8 grid gap-6" onSubmit={submit}>
                    <div className="rounded-xl border border-border bg-white p-5 sm:p-6">
                        <div className="grid gap-5">
                            <Field label="Judul" error={form.errors.title}>
                                <input
                                    value={form.data.title}
                                    onChange={(event) => {
                                        const title = event.target.value
                                        form.setData('title', title)
                                        if (!slugCustomized) form.setData('slug', slugify(title))
                                    }}
                                    disabled={!canEdit}
                                    required
                                    minLength={3}
                                    className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted"
                                />
                            </Field>
                            <Field label="Slug" hint="Huruf kecil, angka, dan tanda minus." error={form.errors.slug}>
                                <input
                                    value={form.data.slug}
                                    onChange={(event) => {
                                        setSlugCustomized(true)
                                        form.setData('slug', slugify(event.target.value))
                                    }}
                                    disabled={!canEdit}
                                    required
                                    className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted"
                                />
                            </Field>
                            <Field label="Ringkasan" hint="Minimal 10 karakter saat berita diterbitkan." error={form.errors.excerpt}>
                                <textarea
                                    value={form.data.excerpt}
                                    onChange={(event) => form.setData('excerpt', event.target.value)}
                                    disabled={!canEdit}
                                    rows={3}
                                    className="rounded-md border border-border px-3 py-2 text-sm leading-6 outline-none focus:border-dgb disabled:bg-muted"
                                />
                            </Field>
                            <Field label="Isi berita" hint="Gunakan toolbar untuk heading, format teks, daftar, tautan, kutipan, dan gambar." error={form.errors.body_json ?? form.errors.body}>
                                <TipTapEditor
                                    content={initialBodyJson}
                                    mediaOptions={bodyMediaOptions}
                                    editable={canEdit}
                                    onChange={(document, rawText) => {
                                        form.setData('body_json', JSON.stringify(document))
                                        form.setData('body', rawText)
                                    }}
                                />
                            </Field>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-white p-5 sm:p-6">
                        <div className="grid gap-5 sm:grid-cols-2">
                            <Field label="Jenis sumber" error={form.errors.kind}>
                                <select
                                    value={form.data.kind}
                                    onChange={(event) => form.setData('kind', event.target.value as Article['kind'])}
                                    disabled={!canEdit}
                                    className="min-h-11 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb disabled:bg-muted"
                                >
                                    <option value="internal">Berita internal</option>
                                    <option value="file">Dokumen lokal</option>
                                    <option value="external">Sumber eksternal</option>
                                </select>
                            </Field>
                            <Field label="URL sumber" hint="Gunakan URL https atau jalur internal." error={form.errors.source_url}>
                                <input
                                    value={form.data.source_url}
                                    onChange={(event) => form.setData('source_url', event.target.value)}
                                    disabled={!canEdit}
                                    type="text"
                                    inputMode="url"
                                    className="min-h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-dgb disabled:bg-muted"
                                />
                            </Field>
                            <Field label="Sampul" hint="Hanya aset gambar berstatus siap." error={form.errors.cover_media_id}>
                                <select
                                    value={form.data.cover_media_id}
                                    onChange={(event) => form.setData('cover_media_id', event.target.value)}
                                    disabled={!canEdit}
                                    className="min-h-11 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-dgb disabled:bg-muted"
                                >
                                    <option value="">Tanpa sampul</option>
                                    {coverMediaOptions.map((media) => (
                                        <option key={media.id} value={media.id}>
                                            {media.filename}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <div className="flex items-end">
                                {selectedMedia && <img src={selectedMedia.url} alt={selectedMedia.alt ?? selectedMedia.filename} className="h-24 w-40 rounded-lg border border-border object-cover" />}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap gap-2">
                            {article && canPublish && article.status === 'published' && <ActionButton type="button" onClick={unpublish} disabled={form.processing}>Tarik ke draft</ActionButton>}
                            {article && canEdit && article.status !== 'archived' && <ActionButton type="button" onClick={archive} disabled={form.processing}>Arsipkan</ActionButton>}
                            {article && canEdit && <ActionButton type="button" onClick={destroy} disabled={form.processing} danger>Hapus</ActionButton>}
                        </div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                            <Link href="/admin/content/news" className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">
                                Batal
                            </Link>
                            {canEdit && <button type="submit" disabled={form.processing} className="inline-flex min-h-10 items-center justify-center rounded-md bg-dgb px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-dgb-600 disabled:cursor-not-allowed disabled:opacity-60">{form.processing ? 'Menyimpan' : 'Simpan draft'}</button>}
                            {article && canPublish && article.status !== 'published' && <button type="button" onClick={publish} disabled={form.processing} className="inline-flex min-h-10 items-center justify-center rounded-md bg-fb px-4 py-2 text-sm font-semibold text-dgb-900 transition-colors hover:bg-fb-300 disabled:cursor-not-allowed disabled:opacity-60">Terbitkan</button>}
                        </div>
                    </div>
                </form>

                {revisions.length > 0 && (
                    <details className="mt-8 rounded-xl border border-border bg-white p-5 sm:p-6">
                        <summary className="cursor-pointer font-montserrat text-base font-semibold text-dgb-900">Riwayat versi ({revisions.length})</summary>
                        <div className="mt-4 grid gap-2">
                            {revisions.map((revision) => (
                                <div key={revision.id} className="flex flex-col gap-1 border-t border-border pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                                    <span className="font-semibold text-dgb-800">Versi {revision.version}</span>
                                    <span className="text-muted-foreground">{revision.reason ?? 'Perubahan konten'} oleh {revision.author?.name ?? 'Sistem'} pada {formatDate(revision.createdAt)}</span>
                                </div>
                            ))}
                        </div>
                    </details>
                )}
            </section>
        </>
    )
}

Form.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactElement }) {
    return (
        <label className="grid gap-1.5 text-xs font-semibold text-dgb-900">
            <span>{label}</span>
            {children}
            {hint && <span className="font-normal leading-5 text-muted-foreground">{hint}</span>}
            {error && <span className="font-normal text-red-700">{error}</span>}
        </label>
    )
}

function ActionButton({ children, onClick, disabled, danger = false, type = 'button' }: { children: string; onClick: () => void; disabled: boolean; danger?: boolean; type?: 'button' }) {
    return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex min-h-10 items-center justify-center rounded-md border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${danger ? 'border-red-300 text-red-700 hover:bg-red-50' : 'border-dgb text-dgb hover:bg-dgb hover:text-white'}`}>{children}</button>
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function plainTextDocument(body: string | null): TipTapDocument | null {
    if (!body || body.trim() === '') return null

    return {
        type: 'doc',
        content: body.trim().split(/\r?\n\s*\r?\n/).map((paragraph) => ({
            type: 'paragraph',
            content: [{ type: 'text', text: paragraph }],
        })),
    }
}

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
