import { Head, Link } from '@inertiajs/react'

type Spotlight = {
    name: string
    title: string
    slug: string
    categorySlug: string | null
    image: string | null
    bio: string | null
    achievements: string[]
}

type Props = {
    spotlight: Spotlight
}

export default function Voting({ spotlight }: Props) {
    const image = spotlight.image ?? '/hero.webp'

    return (
        <>
            <Head title={`${spotlight.name} | MOKA Garut`} />
            <main className="min-h-screen bg-dgb-900 px-5 py-12 text-white sm:px-8 md:px-20 md:py-20">
                <section className="relative isolate mx-auto grid min-h-[36rem] max-w-6xl items-end overflow-hidden rounded-2xl bg-dgb-700 p-6 sm:p-10 md:p-16">
                    <img src={image} alt={spotlight.name} width="1400" height="900" className="absolute inset-0 -z-20 h-full w-full object-cover" />
                    <div className="absolute inset-0 -z-10 bg-linear-to-t from-dgb-900 via-dgb-900/80 to-dgb-900/20" />
                    <div className="relative max-w-3xl">
                        <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-300">{spotlight.title}</p>
                        <h1 className="mt-3 font-montserrat text-4xl font-semibold md:text-7xl">{spotlight.name}</h1>
                        <p className="mt-5 text-base leading-7 text-white/85">{spotlight.bio ?? 'Profil peserta sedang disiapkan.'}</p>
                        {spotlight.achievements.length > 0 ? (
                            <ul className="mt-6 grid list-disc gap-2 pl-5 text-sm leading-6 text-white/80">
                                {spotlight.achievements.map((achievement) => <li key={achievement}>{achievement}</li>)}
                            </ul>
                        ) : null}
                        {spotlight.categorySlug ? (
                            <Link href={`/voting/${spotlight.categorySlug}/${spotlight.slug}`} className="mt-8 inline-flex min-h-10 items-center rounded-md bg-fb px-5 text-sm font-semibold text-dgb-900 transition-colors hover:bg-fb-200">
                                Buka halaman voting
                            </Link>
                        ) : null}
                    </div>
                </section>
            </main>
        </>
    )
}
