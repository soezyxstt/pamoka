import type { ReactElement } from 'react'
import AdminLayout from '../../layouts/AdminLayout'

type DashboardProps = {
    user: {
        name: string
        email: string
    }
}

export default function AdminDashboard({ user }: DashboardProps) {
    return (
        <section>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Ringkasan</p>
            <h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Selamat datang, {user.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Fondasi ruang kerja admin Laravel sudah aktif. Modul CMS akan dipindahkan melalui migration slice berikutnya.
            </p>
        </section>
    )
}

AdminDashboard.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
