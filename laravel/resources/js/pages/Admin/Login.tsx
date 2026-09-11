import type { ReactElement } from 'react'
import AdminAuthLayout from '../../layouts/AdminAuthLayout'

type LoginProps = {
    googleAuthUrl: string
    googleConfigured: boolean
}

export default function AdminLogin({ googleAuthUrl, googleConfigured }: LoginProps) {
    return (
        <>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Pintu masuk admin</p>
            <h1 className="mt-3 font-montserrat text-2xl font-bold text-dgb-900">Masuk ke ruang kerja PAMOKA</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Gunakan akun Google yang telah terdaftar untuk mengelola konten, media, edisi, dan operasional.
            </p>
            <a
                href={googleConfigured ? googleAuthUrl : undefined}
                aria-disabled={!googleConfigured}
                tabIndex={googleConfigured ? undefined : -1}
                className={`mt-7 flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors ${googleConfigured ? 'bg-dgb text-white hover:bg-dgb-800' : 'cursor-not-allowed border border-dgb-100 bg-dgb-50 text-dgb-700'}`}
            >
                {googleConfigured ? 'Lanjut dengan Google' : 'Google OAuth belum dikonfigurasi'}
            </a>
            {!googleConfigured && (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Isi GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET di file .env untuk mengaktifkan login.
                </p>
            )}
            <div className="mt-6 rounded-md border border-dgb-100 bg-dgb-50 p-4 text-xs leading-5 text-dgb-700">
                Akun baru berstatus menunggu. Akses diberikan setelah Role Administrator menyetujui permintaan Anda.
            </div>
        </>
    )
}

AdminLogin.layout = (page: ReactElement) => <AdminAuthLayout>{page}</AdminAuthLayout>
