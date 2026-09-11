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

            <main className="min-h-screen bg-[#f6f6f1] text-[#173b33]">
                <section className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16 md:px-12">
                    <div className="grid w-full gap-10 md:grid-cols-[1.15fr_0.85fr] md:items-end">
                        <div>
                            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.24em] text-[#d86b2f]">
                                {migrationStage} migrasi
                            </p>
                            <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
                                Nu Nyunda Tur Nyakola
                            </h1>
                            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#52615c]">
                                Fondasi Laravel dan Inertia React sudah aktif berdampingan dengan aplikasi Next.js lama.
                                Setiap fitur akan dipindahkan melalui checkpoint yang dapat diuji.
                            </p>
                        </div>

                        <div className="rounded-xl border border-[#cbd7d0] bg-white p-6 shadow-sm">
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#52615c]">
                                Status arsitektur
                            </p>
                            <dl className="mt-6 space-y-5">
                                <div>
                                    <dt className="text-sm text-[#6b7772]">Aplikasi lama</dt>
                                    <dd className="mt-1 text-lg font-semibold">{legacyApp}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-[#6b7772]">Aplikasi target</dt>
                                    <dd className="mt-1 text-lg font-semibold">{targetApp}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-[#6b7772]">Database</dt>
                                    <dd className="mt-1 text-lg font-semibold">MySQL, disiapkan pada tahap berikutnya</dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </section>
            </main>
        </>
    )
}
