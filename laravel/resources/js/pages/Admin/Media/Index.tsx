import { Head, Link, router, useForm } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode, ReactElement } from 'react'
import AdminLayout from '../../../layouts/AdminLayout'

type FolderScope = 'all' | 'edition' | 'global'
type AssetType = 'all' | 'image' | 'video' | 'pdf'

type Edition = {
    id: string
    year: number
    name: string
    lifecycle: string
}

type Folder = {
    id: string
    parentId: string | null
    editionId: string | null
    name: string
    slug: string
    assetCount: number
}

type Asset = {
    id: string
    provider: string
    providerKey: string | null
    url: string
    filename: string
    mimeType: string
    bytes: number
    alt: string | null
    decorative: boolean
    lifecycle: string
    folderId: string | null
    folderName: string | null
    createdAt: string | null
}

type Props = {
    editionName: string
    assets: Asset[]
    folders: Folder[]
    editions: Edition[]
    activeEditionId: string | null
    selectedEditionId: string | null
    folderSelection: string
    currentFolderId: string | null
    currentFolder: Folder | null
    folderScope: FolderScope
    type: AssetType
    search: string
    page: number
    limit: number
    total: number
    hasMore: boolean
    canManage: boolean
}

export default function Index({
    editionName,
    assets,
    folders,
    editions,
    activeEditionId,
    selectedEditionId,
    folderSelection,
    currentFolderId,
    currentFolder,
    folderScope,
    type: assetType,
    search: initialSearch,
    page,
    limit,
    total,
    hasMore,
    canManage,
}: Props) {
    const [search, setSearch] = useState(initialSearch)
    const folderRows = useMemo(() => flattenFolders(folders), [folders])

    const navigate = (overrides: Record<string, string | number | undefined> = {}) => {
        const values: Record<string, string | number | undefined> = {
            folder_scope: folderScope,
            edition_id: selectedEditionId ?? undefined,
            type: assetType,
            search,
            page: 1,
            limit,
            folder_id: folderSelection || undefined,
            ...overrides,
        }
        const query: Record<string, string | number> = {}
        Object.entries(values).forEach(([key, value]) => {
            if (value !== undefined && value !== '') query[key] = value
        })
        router.get('/admin/media', query, { preserveState: true, preserveScroll: true, replace: true })
    }

    return (
        <>
            <Head title="Pustaka media" />
            <section>
                <PageHeader editionName={editionName} />

                <div className="mt-8 grid gap-3 sm:grid-cols-4">
                    <Stat label="Aset tampil" value={assets.length} />
                    <Stat label="Total hasil" value={total} />
                    <Stat label="Folder" value={folders.length} />
                    <Stat label="Halaman" value={page} />
                </div>

                <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    Upload provider langsung belum tersedia pada sidecar Laravel. Tahap ini mengelola aset siap pakai, folder, metadata, dan binding dengan audit.
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
                    <aside className="grid content-start gap-5">
                        <FolderPanel
                            folders={folders}
                            folderRows={folderRows}
                            editions={editions}
                            activeEditionId={activeEditionId}
                            selectedEditionId={selectedEditionId}
                            folderSelection={folderSelection}
                            currentFolderId={currentFolderId}
                            currentFolder={currentFolder}
                            folderScope={folderScope}
                            canManage={canManage}
                            navigate={navigate}
                        />
                    </aside>

                    <div className="min-w-0">
                        <FilterBar
                            search={search}
                            setSearch={setSearch}
                            assetType={assetType}
                            selectedEditionId={selectedEditionId}
                            editions={editions}
                            folders={folderRows}
                            folderSelection={folderSelection}
                            navigate={navigate}
                        />
                        {assets.length === 0 ? (
                            <Empty text="Belum ada media siap pakai pada filter ini." />
                        ) : (
                            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {assets.map((asset) => <AssetCard key={asset.id} asset={asset} folders={folderRows} canManage={canManage} />)}
                            </div>
                        )}
                        <Pagination page={page} hasMore={hasMore} navigate={navigate} />
                    </div>
                </div>
            </section>
        </>
    )
}

Index.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>

function PageHeader({ editionName }: { editionName: string }) {
    return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Konten / media</p><h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Pustaka media</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Telusuri aset siap pakai untuk {editionName}. Folder dan perubahan metadata tercatat pada audit.</p></div><Link href="/admin" className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Kembali ke dashboard</Link></div>
}

function FolderPanel({
    folders,
    folderRows,
    editions,
    activeEditionId,
    selectedEditionId,
    folderSelection,
    currentFolderId,
    currentFolder,
    folderScope,
    canManage,
    navigate,
}: {
    folders: Folder[]
    folderRows: Array<Folder & { depth: number }>
    editions: Edition[]
    activeEditionId: string | null
    selectedEditionId: string | null
    folderSelection: string
    currentFolderId: string | null
    currentFolder: Folder | null
    folderScope: FolderScope
    canManage: boolean
    navigate: (overrides?: Record<string, string | number | undefined>) => void
}) {
    return <>
        <section className="rounded-xl border border-border bg-white p-4"><div className="flex flex-wrap gap-2"><ScopeButton active={folderScope === 'edition'} onClick={() => navigate({ folder_scope: 'edition', folder_id: undefined })}>Edisi</ScopeButton><ScopeButton active={folderScope === 'global'} onClick={() => navigate({ folder_scope: 'global', folder_id: undefined })}>Global</ScopeButton><ScopeButton active={folderScope === 'all'} onClick={() => navigate({ folder_scope: 'all', folder_id: undefined })}>Semua</ScopeButton></div><div className="mt-4 grid gap-1"><button type="button" onClick={() => navigate({ folder_id: undefined })} className={folderSelection === '' ? 'rounded-md bg-dgb-50 px-3 py-2 text-left text-sm font-semibold text-dgb-900' : 'rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted'}>Semua media</button><button type="button" onClick={() => navigate({ folder_id: 'root' })} className={folderSelection === 'root' ? 'rounded-md bg-dgb-50 px-3 py-2 text-left text-sm font-semibold text-dgb-900' : 'rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted'}>Tanpa folder</button>{folderRows.map((folder) => <button type="button" key={folder.id} onClick={() => navigate({ folder_id: folder.id })} className={currentFolderId === folder.id ? 'rounded-md bg-dgb-50 px-3 py-2 text-left text-sm font-semibold text-dgb-900' : 'rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted'} style={{ paddingLeft: `${12 + folder.depth * 14}px` }}>{folder.name}<span className="ml-1 text-xs text-muted-foreground">({folder.assetCount})</span></button>)}</div></section>
        {canManage && <CreateFolder folders={folderRows} editions={editions} activeEditionId={activeEditionId} selectedEditionId={selectedEditionId} currentFolderId={currentFolderId} />}
        {canManage && currentFolder !== null && <RenameFolder folder={currentFolder} editions={editions} />}
        <p className="px-1 text-xs leading-5 text-muted-foreground">{folders.length} folder pada cakupan ini. Folder global dapat digunakan lintas edisi.</p>
    </>
}

function CreateFolder({ folders, editions, activeEditionId, selectedEditionId, currentFolderId }: { folders: Array<Folder & { depth: number }>; editions: Edition[]; activeEditionId: string | null; selectedEditionId: string | null; currentFolderId: string | null }) {
    const form = useForm({ name: '', parent_id: currentFolderId ?? '', edition_id: selectedEditionId ?? activeEditionId ?? '' })
    const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); form.post('/admin/media/folders', { preserveScroll: true, onSuccess: () => form.reset() }) }

    return <section className="rounded-xl border border-dgb-100 bg-dgb-50/40 p-4"><h2 className="font-montserrat text-base font-semibold text-dgb-900">Folder baru</h2><form onSubmit={submit} className="mt-4 grid gap-3"><Field label="Nama folder" error={form.errors.name}><input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} required className="input" placeholder="Foto kegiatan" /></Field><Field label="Folder induk" error={form.errors.parent_id}><select value={form.data.parent_id} onChange={(event) => form.setData('parent_id', event.target.value)} className="input"><option value="">Root</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{'· '.repeat(folder.depth)}{folder.name}</option>)}</select></Field><Field label="Edisi" error={form.errors.edition_id}><select value={form.data.edition_id} onChange={(event) => form.setData('edition_id', event.target.value)} className="input"><option value="">Global</option>{editions.map((edition) => <option key={edition.id} value={edition.id}>{edition.year} · {edition.name}</option>)}</select></Field><button type="submit" disabled={form.processing} className="button-primary">{form.processing ? 'Menyimpan' : 'Buat folder'}</button></form></section>
}

function RenameFolder({ folder, editions }: { folder: Folder; editions: Edition[] }) {
    const form = useForm({ name: folder.name, edition_id: folder.editionId ?? '' })
    const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); form.put(`/admin/media/folders/${folder.id}`, { preserveScroll: true }) }

    return <section className="rounded-xl border border-border bg-white p-4"><h2 className="font-montserrat text-base font-semibold text-dgb-900">Folder terpilih</h2><form onSubmit={submit} className="mt-4 grid gap-3"><Field label="Nama folder" error={form.errors.name}><input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} required className="input" /></Field><Field label="Edisi" error={form.errors.edition_id}><select value={form.data.edition_id} onChange={(event) => form.setData('edition_id', event.target.value)} className="input"><option value="">Global</option>{editions.map((edition) => <option key={edition.id} value={edition.id}>{edition.year} · {edition.name}</option>)}</select></Field><button type="submit" disabled={form.processing} className="button-outline">{form.processing ? 'Menyimpan' : 'Simpan folder'}</button></form></section>
}

function FilterBar({ search, setSearch, assetType, selectedEditionId, editions, folders, folderSelection, navigate }: { search: string; setSearch: (value: string) => void; assetType: AssetType; selectedEditionId: string | null; editions: Edition[]; folders: Array<Folder & { depth: number }>; folderSelection: string; navigate: (overrides?: Record<string, string | number | undefined>) => void }) {
    const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); navigate({ search, page: 1 }) }

    return <form onSubmit={submit} className="grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-[minmax(0,1fr)_9rem_12rem] sm:items-end"><Field label="Cari nama file atau alt"><input value={search} onChange={(event) => setSearch(event.target.value)} className="input" placeholder="Cari media" /></Field><Field label="Jenis"><select value={assetType} onChange={(event) => navigate({ type: event.target.value, page: 1 })} className="input"><option value="all">Semua</option><option value="image">Gambar</option><option value="video">Video</option><option value="pdf">PDF</option></select></Field><Field label="Folder"><select value={folderSelection || 'all'} onChange={(event) => navigate({ folder_id: event.target.value === 'all' ? undefined : event.target.value, page: 1 })} className="input"><option value="all">Semua folder</option><option value="root">Tanpa folder</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{'· '.repeat(folder.depth)}{folder.name}</option>)}</select></Field><Field label="Edisi" hint="Filter folder edition"><select value={selectedEditionId ?? ''} onChange={(event) => navigate({ edition_id: event.target.value || undefined, page: 1 })} className="input"><option value="">Edisi aktif</option>{editions.map((edition) => <option key={edition.id} value={edition.id}>{edition.year} · {edition.name}</option>)}</select></Field><button type="submit" className="button-primary sm:col-span-3 sm:w-fit">Terapkan pencarian</button></form>
}

function AssetCard({ asset, folders, canManage }: { asset: Asset; folders: Array<Folder & { depth: number }>; canManage: boolean }) {
    const metadata = useForm({ alt: asset.alt ?? '', decorative: asset.decorative })
    const move = useForm({ folder_id: asset.folderId ?? '' })
    const saveMetadata = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); metadata.put(`/admin/media/assets/${asset.id}`, { preserveScroll: true }) }
    const saveMove = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); move.put(`/admin/media/assets/${asset.id}/move`, { preserveScroll: true }) }

    return <article className="overflow-hidden rounded-xl border border-border bg-white"><Preview asset={asset} /><div className="grid gap-4 p-4"><div><h2 className="break-words font-montserrat text-base font-semibold text-dgb-900">{asset.filename}</h2><p className="mt-1 text-xs text-muted-foreground">{asset.mimeType} · {formatBytes(asset.bytes)}</p><p className="mt-1 text-xs text-muted-foreground">{asset.folderName ?? 'Tanpa folder'} · {asset.provider}</p></div>{canManage ? <><form onSubmit={saveMetadata} className="grid gap-3 border-t border-border pt-3"><Field label="Alt text" error={metadata.errors.alt}><textarea value={metadata.data.alt} onChange={(event) => metadata.setData('alt', event.target.value)} disabled={metadata.processing} rows={2} className="textarea" placeholder="Deskripsikan gambar untuk aksesibilitas" /></Field><label className="flex items-center gap-2 text-xs font-semibold text-dgb-900"><input type="checkbox" checked={metadata.data.decorative} onChange={(event) => metadata.setData('decorative', event.target.checked)} disabled={metadata.processing} />Aset dekoratif, tanpa alt text</label><button type="submit" disabled={metadata.processing} className="button-outline">{metadata.processing ? 'Menyimpan' : 'Simpan metadata'}</button></form><form onSubmit={saveMove} className="grid gap-3 border-t border-border pt-3"><Field label="Pindahkan ke" error={move.errors.folder_id}><select value={move.data.folder_id} onChange={(event) => move.setData('folder_id', event.target.value)} disabled={move.processing} className="input"><option value="">Root</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{'· '.repeat(folder.depth)}{folder.name}</option>)}</select></Field><button type="submit" disabled={move.processing} className="button-outline">{move.processing ? 'Memindahkan' : 'Simpan lokasi'}</button></form></> : <p className="text-xs leading-5 text-muted-foreground">Metadata hanya dapat diubah oleh pengguna dengan izin media.manage.</p>}</div></article>
}

function Preview({ asset }: { asset: Asset }) {
    if (asset.mimeType.startsWith('video/')) return <video src={asset.url} controls className="h-44 w-full bg-black object-cover" />
    if (asset.mimeType === 'application/pdf') return <a href={asset.url} target="_blank" rel="noreferrer" className="grid h-44 place-items-center bg-fb-50 text-sm font-semibold text-fb-800">Buka PDF</a>

    return <img src={asset.url} alt={asset.decorative ? '' : asset.alt ?? asset.filename} className="h-44 w-full bg-muted object-cover" />
}

function Pagination({ page, hasMore, navigate }: { page: number; hasMore: boolean; navigate: (overrides?: Record<string, string | number | undefined>) => void }) {
    if (page === 1 && !hasMore) return null

    return <div className="mt-5 flex items-center justify-between rounded-xl border border-border bg-white p-3"><button type="button" onClick={() => navigate({ page: page - 1 })} disabled={page === 1} className="button-outline">Sebelumnya</button><span className="text-xs font-semibold text-muted-foreground">Halaman {page}</span><button type="button" onClick={() => navigate({ page: page + 1 })} disabled={!hasMore} className="button-outline">Berikutnya</button></div>
}

function ScopeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
    return <button type="button" onClick={onClick} className={active ? 'button-primary' : 'button-outline'}>{children}</button>
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
    return <label className="grid gap-1 text-xs font-semibold text-dgb-900">{label}{hint && <span className="font-normal text-muted-foreground">{hint}</span>}{children}{error && <span className="font-normal text-red-700">{error}</span>}</label>
}

function Stat({ label, value }: { label: string; value: number }) {
    return <div className="rounded-xl border border-border bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-2 font-montserrat text-2xl font-semibold text-dgb-900">{value}</p></div>
}

function Empty({ text }: { text: string }) {
    return <div className="mt-5 rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">{text}</div>
}

function flattenFolders(folders: Folder[]): Array<Folder & { depth: number }> {
    const rows: Array<Folder & { depth: number }> = []
    const visit = (parentId: string | null, depth: number) => {
        folders.filter((folder) => folder.parentId === parentId).forEach((folder) => {
            rows.push({ ...folder, depth })
            visit(folder.id, depth + 1)
        })
    }
    visit(null, 0)

    return rows
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
