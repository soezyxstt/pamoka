import { useForm } from '@inertiajs/react'
import type { FormEvent, ReactElement } from 'react'
import AdminAuthLayout from '../../layouts/AdminAuthLayout'

type RequestAccessProps = {
    user: {
        name: string
        email: string
    }
    status: string | undefined
}

export default function AdminRequestAccess({ user, status }: RequestAccessProps) {
    const form = useForm<{ reason: string; areas: string[] }>({ reason: '', areas: [] })

    const toggleArea = (area: string) => {
        form.setData(
            'areas',
            form.data.areas.includes(area) ? form.data.areas.filter((item) => item !== area) : [...form.data.areas, area],
        )
    }

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        form.post('/admin/request-access')
    }

    return (
        <>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Permintaan akses</p>
            <h1 className="mt-3 font-montserrat text-2xl font-bold text-dgb-900">Akun sedang ditinjau</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {user.name} ({user.email}) belum memiliki akses ke ruang kerja admin.
            </p>
            <div className="mt-6 rounded-md border border-fb-200 bg-fb-50 p-4 text-sm leading-6 text-dgb-800">
                Status akun: <strong>{status ?? 'pending'}</strong>. Role Administrator perlu menyetujui akses sebelum dashboard dapat dibuka.
            </div>
            <form className="mt-6 space-y-5" onSubmit={submit}>
                <div>
                    <label htmlFor="reason" className="text-sm font-semibold text-dgb-900">
                        Alasan kebutuhan akses
                    </label>
                    <textarea
                        id="reason"
                        value={form.data.reason}
                        onChange={(event) => form.setData('reason', event.target.value)}
                        minLength={10}
                        maxLength={500}
                        required
                        className="mt-2 min-h-28 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-dgb"
                        placeholder="Contoh: Saya perlu mengelola berita dan galeri kegiatan."
                    />
                    {form.errors.reason && <p className="mt-1 text-xs text-red-700">{form.errors.reason}</p>}
                </div>
                <fieldset>
                    <legend className="text-sm font-semibold text-dgb-900">Area yang diperlukan</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        {[
                            ['content', 'Konten'],
                            ['voting', 'Voting'],
                            ['users', 'Pengguna'],
                        ].map(([value, label]) => (
                            <label key={value} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={form.data.areas.includes(value)}
                                    onChange={() => toggleArea(value)}
                                />
                                {label}
                            </label>
                        ))}
                    </div>
                </fieldset>
                <button
                    type="submit"
                    disabled={form.processing}
                    className="w-full rounded-md bg-dgb px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-dgb-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {form.processing ? 'Mengirim...' : 'Kirim permintaan akses'}
                </button>
            </form>
        </>
    )
}

AdminRequestAccess.layout = (page: ReactElement) => <AdminAuthLayout>{page}</AdminAuthLayout>
