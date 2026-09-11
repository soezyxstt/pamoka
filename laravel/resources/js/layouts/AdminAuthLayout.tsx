import type { ReactNode } from 'react'

type AdminAuthLayoutProps = {
    children: ReactNode
}

export default function AdminAuthLayout({ children }: AdminAuthLayoutProps) {
    return (
        <div className="min-h-screen bg-dgb-50 px-5 py-10 text-foreground sm:px-8 lg:px-12">
            <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
                <div className="mb-8 text-center">
                    <p className="font-montserrat text-2xl font-extrabold tracking-[0.18em] text-dgb-900">PAMOKA</p>
                    <p className="mt-2 text-sm text-dgb-700">Ruang kerja PAMOKA Garut</p>
                </div>
                <div className="rounded-xl border border-dgb-100 bg-white p-6 shadow-sm sm:p-8">{children}</div>
            </div>
        </div>
    )
}
