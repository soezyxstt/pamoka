import { Head, Link } from '@inertiajs/react'

type Finalist = {
    id: string
    name: string
    title: string
    slug: string
    categorySlug: string
}

type Sponsor = {
    name: string
    image: string
}

type Props = {
    finalists: Finalist[]
    sponsors: Sponsor[]
}

export default function Pasanggiri({ finalists, sponsors }: Props) {
    return (
        <>
            <Head title="Pasanggiri | MOKA Garut" />

            <main className="min-h-screen bg-dgb-900 text-white">
                <section className="relative isolate grid min-h-[32rem] place-items-center overflow-hidden px-5 py-24 sm:px-8 md:min-h-[42rem] md:justify-items-start md:px-20">
                    <img src="/hero.webp" alt="" width="1600" height="900" className="absolute inset-0 -z-20 h-full w-full object-cover" />
                    <div className="absolute inset-0 -z-10 bg-linear-to-r from-black/75 via-black/55 to-dgb-900/30" />
                    <div className="relative max-w-2xl">
                        <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-300">Pasanggiri</p>
                        <h1 className="mt-3 font-montserrat text-4xl font-semibold md:text-7xl">Gala Dinner Night</h1>
                        <p className="mt-5 max-w-xl text-base leading-7 text-white/80">Dukung finalis pilihanmu melalui halaman voting MOKA Garut.</p>
                    </div>
                </section>

                <section className="px-5 py-16 sm:px-8 md:px-20 md:py-24">
                    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                        <div>
                            <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-300">Finalis</p>
                            <h2 className="mt-3 font-montserrat text-3xl font-semibold md:text-6xl">Dukung pilihanmu</h2>
                        </div>
                        <Link href="/voting/mojang-dewasa" className="inline-flex min-h-10 w-fit items-center rounded-md border border-white/60 px-4 text-sm font-semibold transition-colors hover:bg-white hover:text-dgb-900">
                            Lihat voting
                        </Link>
                    </div>

                    {finalists.length > 0 ? (
                        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {finalists.map((finalist) => (
                                <article key={finalist.id} className="rounded-xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
                                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-300">{finalist.title}</p>
                                    <h3 className="mt-3 font-montserrat text-lg font-semibold">{finalist.name}</h3>
                                    <Link href={`/voting/${finalist.categorySlug}/${finalist.slug}`} className="mt-5 inline-flex text-sm font-semibold text-white/75 underline-offset-4 hover:text-white hover:underline">
                                        Buka profil
                                    </Link>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-10 rounded-xl border border-dashed border-white/30 p-8 text-center text-white/75">Data finalis sedang disiapkan.</p>
                    )}
                </section>

                <section className="bg-white px-5 py-16 text-dgb-900 sm:px-8 md:px-20 md:py-24">
                    <p className="text-center font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-500">Dukungan</p>
                    <h2 className="mt-3 text-center font-montserrat text-3xl font-semibold md:text-6xl">Mitra kegiatan</h2>
                    <div className="mx-auto mt-10 grid max-w-6xl grid-cols-2 items-center gap-5 sm:grid-cols-3 md:grid-cols-5">
                        {sponsors.map((sponsor) => (
                            <div key={`${sponsor.name}:${sponsor.image}`} className="grid min-h-24 place-items-center rounded-xl border border-dgb-100 bg-white p-4">
                                <img src={sponsor.image} alt={sponsor.name} width="180" height="90" className="max-h-16 w-full object-contain" />
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </>
    )
}
