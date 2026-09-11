import { Head } from '@inertiajs/react'

type HomeProps = {
    migrationStage: string
    legacyApp: string
    targetApp: string
}

export default function Home({ migrationStage, legacyApp, targetApp }: HomeProps) {
    return (
        <>
            <Head title="PAMOKA Garut" />

            <section className="relative overflow-hidden bg-dgb-900 text-white">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(232,153,40,0.28),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(31,99,87,0.8),transparent_45%)]" />
                <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center px-5 py-16 sm:px-8 md:px-12">
                    <div className="grid w-full gap-10 md:grid-cols-[1.15fr_0.85fr] md:items-end">
                        <div>
                            <p className="mb-5 font-montserrat text-sm font-semibold uppercase tracking-[0.24em] text-fb-300">
                                {migrationStage} migrasi
                            </p>
                            <h1 className="max-w-3xl font-montserrat text-4xl font-semibold leading-tight md:text-6xl">
                                Nu Nyunda Tur Nyakola
                            </h1>
                            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75">
                                Shell publik Laravel dan Inertia React sudah aktif berdampingan dengan aplikasi Next.js lama.
                                Setiap fitur akan dipindahkan melalui checkpoint yang dapat diuji.
                            </p>
                        </div>

                        <div className="rounded-xl border border-white/15 bg-white/10 p-6 shadow-xl shadow-black/10 backdrop-blur-sm">
                            <p className="font-montserrat text-sm font-semibold uppercase tracking-[0.18em] text-fb-300">
                                Status arsitektur
                            </p>
                            <dl className="mt-6 space-y-5">
                                <div>
                                    <dt className="text-sm text-white/60">Aplikasi lama</dt>
                                    <dd className="mt-1 text-lg font-semibold text-white">{legacyApp}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-white/60">Aplikasi target</dt>
                                    <dd className="mt-1 text-lg font-semibold text-white">{targetApp}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-white/60">Database</dt>
                                    <dd className="mt-1 text-lg font-semibold text-white">MySQL, disiapkan pada tahap berikutnya</dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </div>
            </section>
        </>
    )
}
