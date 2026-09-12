import { useRef, useState } from 'react'

type UploadKind = 'image' | 'video' | 'pdf'

type UploadThingConfig = {
    enabled: boolean
    endpoint: string
    version: string
    routes: string[]
}

type PresignedFile = {
    url: string
    key: string
    name: string
    customId: string | null
}

const policies: Record<UploadKind, { accept: string; maxFiles: number; maxBytes: number; label: string }> = {
    image: { accept: 'image/jpeg,image/png,image/webp,image/avif', maxFiles: 10, maxBytes: 20 * 1024 * 1024, label: 'gambar' },
    video: { accept: 'video/mp4,video/webm', maxFiles: 1, maxBytes: 512 * 1024 * 1024, label: 'video' },
    pdf: { accept: 'application/pdf', maxFiles: 5, maxBytes: 64 * 1024 * 1024, label: 'PDF' },
}

export default function MediaUploader({
    config,
    folderId,
    onUploaded,
}: {
    config: UploadThingConfig
    folderId: string | null
    onUploaded: () => void
}) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [kind, setKind] = useState<UploadKind>('image')
    const [processing, setProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [status, setStatus] = useState<string | null>(null)
    const policy = policies[kind]

    if (!config.enabled) {
        return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Token UploadThing belum dikonfigurasi pada sidecar Laravel. Pustaka tetap dapat mengelola aset yang sudah tersedia.</div>
    }

    const upload = async (files: File[]) => {
        setError(null)
        setStatus(null)
        const rejected = files.find((file) => file.size > policy.maxBytes || !file.type.split('/')[0])
        const invalidMime = files.find((file) => !acceptedMime(kind, file.type))
        if (files.length < 1) {
            setError('Pilih minimal satu file.')
            return
        }
        if (files.length > policy.maxFiles) {
            setError(`Maksimal ${policy.maxFiles} file untuk ${policy.label}.`)
            return
        }
        if (rejected) {
            setError(`Ada file yang melebihi batas ${formatBytes(policy.maxBytes)}.`)
            return
        }
        if (invalidMime) {
            setError(`Jenis file tidak sesuai untuk ${policy.label}.`)
            return
        }

        setProcessing(true)
        try {
            const response = await fetch(`${config.endpoint}?slug=${kind}&actionType=upload`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-UploadThing-Package': 'uploadthing/laravel-inertia',
                    'X-UploadThing-Version': config.version,
                },
                body: JSON.stringify({
                    files: files.map((file) => ({
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        lastModified: file.lastModified,
                    })),
                    input: { folderId },
                }),
            })
            const responseData = await response.json().catch(() => null)
            if (!response.ok || !Array.isArray(responseData)) {
                throw new Error(readMessage(responseData) ?? 'Pendaftaran unggah ditolak.')
            }

            const presigned = responseData as PresignedFile[]
            if (presigned.length !== files.length || presigned.some((item) => typeof item?.url !== 'string')) {
                throw new Error('Respons URL unggah tidak lengkap.')
            }

            for (const [index, item] of presigned.entries()) {
                const file = files[index]
                if (!file) continue
                const formData = new FormData()
                formData.append('file', file)
                const uploadResponse = await fetch(item.url, {
                    method: 'PUT',
                    headers: {
                        Range: 'bytes=0-',
                        'X-UploadThing-Version': config.version,
                    },
                    body: formData,
                })
                const uploadData = await uploadResponse.json().catch(() => null)
                if (!uploadResponse.ok || isErrorResponse(uploadData)) {
                    throw new Error(readMessage(uploadData) ?? `Unggah ${file.name} gagal.`)
                }
            }

            setStatus(`${files.length} file berhasil diunggah. Daftar aset diperbarui.`)
            if (inputRef.current) inputRef.current.value = ''
            onUploaded()
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : 'Unggah media gagal diproses.')
        } finally {
            setProcessing(false)
        }
    }

    const handleInput = (event: React.ChangeEvent<HTMLInputElement>) => {
        void upload(Array.from(event.target.files ?? []))
    }

    return <section className="rounded-xl border border-dgb-100 bg-dgb-50/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h2 className="font-montserrat text-base font-semibold text-dgb-900">Unggah media</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">File dikirim langsung ke UploadThing. Aset baru masuk setelah callback provider tervalidasi.</p>
            </div>
            <div className="grid gap-1 text-xs font-semibold text-dgb-900">
                <label htmlFor="media-upload-kind">Jenis media</label>
                <select id="media-upload-kind" value={kind} onChange={(event) => setKind(event.target.value as UploadKind)} disabled={processing} className="input min-w-32">
                    {config.routes.filter((route): route is UploadKind => route in policies).map((route) => <option key={route} value={route}>{policies[route].label}</option>)}
                </select>
            </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-dashed border-dgb-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs leading-5 text-muted-foreground">Maksimal {policy.maxFiles} file, {formatBytes(policy.maxBytes)} per file. Folder tujuan: {folderId === null ? 'root' : 'folder terpilih'}.</div>
            <button type="button" className="button-primary" disabled={processing} onClick={() => inputRef.current?.click()}>{processing ? 'Mengunggah' : 'Pilih file'}</button>
            <input ref={inputRef} className="hidden" type="file" accept={policy.accept} multiple={policy.maxFiles > 1} disabled={processing} onChange={handleInput} />
        </div>
        {error !== null && <p className="mt-3 text-xs leading-5 text-red-700">{error}</p>}
        {status !== null && <p className="mt-3 text-xs leading-5 text-dgb-800">{status}</p>}
    </section>
}

function acceptedMime(kind: UploadKind, mime: string): boolean {
    if (kind === 'image') return ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(mime)
    if (kind === 'video') return ['video/mp4', 'video/webm'].includes(mime)

    return mime === 'application/pdf'
}

function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`

    return `${Math.round(bytes / (1024 * 1024))} MB`
}

function isErrorResponse(value: unknown): boolean {
    return typeof value === 'object' && value !== null && 'error' in value
}

function readMessage(value: unknown): string | null {
    if (typeof value !== 'object' || value === null || !('message' in value)) return null
    const message = value.message

    return typeof message === 'string' ? message : null
}
