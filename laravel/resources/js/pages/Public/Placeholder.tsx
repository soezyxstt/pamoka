import { Head, Link } from '@inertiajs/react'

type PlaceholderProps = {
    pageKey: string
    pageTitle: string
    routePath: string
    parameters: Record<string, string>
}

export default function Placeholder({ pageKey, pageTitle, routePath, parameters }: PlaceholderProps) {
    return (
        <>
            <Head title={`${pageTitle} | MOKA Garut`} />

            <section className="bg-background px-5 py-16 sm:px-8 md:py-24 lg:px-12">
                <div className="mx-auto max-w-5xl">
                    <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-500">
                        Kontrak route Laravel
                    </p>
                    <h1 className="mt-4 max-w-3xl font-montserrat text-4xl font-semibold leading-tight text-dgb-900 md:text-6xl">
                        {pageTitle}
                    </h1>
                    <p className="mt-6 max-w-2xl text-base leading-7 text-dgb-700 md:text-lg">
                        Route dan shell publik sudah tersedia. Isi fitur akan dipindahkan melalui migration slice berikutnya.
                    </p>

                    <div className="mt-10 grid gap-4 rounded-xl border border-dgb-100 bg-white p-6 shadow-sm sm:grid-cols-2">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dgb-500">Page key</p>
                            <p className="mt-2 font-mono text-sm text-dgb-900">{pageKey}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dgb-500">Route</p>
                            <p className="mt-2 font-mono text-sm text-dgb-900">{routePath}</p>
                        </div>
                        <div className="sm:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dgb-500">Parameter</p>
                            <p className="mt-2 font-mono text-sm text-dgb-900">
                                {Object.entries(parameters).map(([key, value]) => `${key}=${value}`).join(', ') || 'Tidak ada'}
                            </p>
                        </div>
                    </div>

                    <Link
                        href="/"
                        className="mt-8 inline-flex min-h-10 items-center rounded-md bg-dgb px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-dgb-600"
                    >
                        Kembali ke beranda
                    </Link>
                </div>
            </section>
        </>
    )
}
