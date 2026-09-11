import { Head, Link } from '@inertiajs/react'

type Participant = {
    number: number
    name: string
    slug: string
    bio: string | null
    image: string | null
    imageAlt: string | null
    achievements: string[]
    socialLinks: SocialLink[]
    titles: ParticipantTitle[]
}

type ParticipantTitle = {
    name: string
    description: string | null
}

type SocialLink = {
    platform: string
    label: string | null
    url: string
}

type ParticipantDetailProps = {
    meta: {
        title: string
        description: string
    }
    pageTitle: string
    edition: {
        year: number
        name: string
        slogan: string | null
    } | null
    category: {
        code: string
        label: string
        slug: string
    }
    stage: {
        key: string
        name: string
        label: string
        slug: string
    }
    participant: Participant
    profileIndexPath: string
}

export default function Show({
    meta,
    pageTitle,
    edition,
    category,
    stage,
    participant,
    profileIndexPath,
}: ParticipantDetailProps) {
    const image = participant.image ?? '/finalis/hero.webp'
    const number = String(participant.number).padStart(2, '0')

    return (
        <>
            <Head title={meta.title}>
                <meta name="description" content={meta.description} />
                <meta property="og:image" content={image} />
            </Head>

            <main className="min-h-screen bg-dgb-900 px-4 py-6 sm:px-8 md:px-16 md:py-12">
                <section className="relative isolate mx-auto flex min-h-[calc(100svh-3rem)] max-w-7xl items-end overflow-hidden rounded-2xl bg-dgb-700 px-6 py-8 sm:px-10 md:px-20 md:py-16">
                    <img
                        src={image}
                        alt={participant.imageAlt ?? participant.name}
                        width="1600"
                        height="1000"
                        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
                    />
                    <div className="absolute inset-0 -z-10 bg-linear-to-t from-dgb-900 via-dgb-900/75 to-dgb-900/20" />
                    <div className="relative w-full max-w-3xl text-white">
                        <Link
                            href={profileIndexPath}
                            className="inline-flex rounded-md border border-white/45 px-4 py-2 font-montserrat text-sm font-semibold transition-colors hover:border-white hover:bg-white hover:text-dgb-900"
                        >
                            Kembali ke daftar
                        </Link>
                        <p className="mt-12 font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-300">
                            {stage.label} · {category.code}-{number}
                        </p>
                        <h1 className="mt-4 font-montserrat text-4xl font-semibold leading-tight md:text-6xl">{participant.name}</h1>
                        <p className="mt-2 font-montserrat text-lg text-white/80">{category.label}{edition ? ` · ${edition.year}` : ''}</p>
                        <div className="mt-8 h-px w-full bg-white/30" />
                        <p className="mt-8 max-w-2xl font-inter text-base leading-7 text-white/90">
                            {participant.bio ?? 'Profil peserta sedang disiapkan.'}
                        </p>

                        {participant.titles.length > 0 ? (
                            <div className="mt-8 grid gap-3">
                                <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-300">Gelar edisi</p>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {participant.titles.map((title) => (
                                        <article key={title.name} className="rounded-xl border border-white/20 bg-black/15 p-4 backdrop-blur-sm">
                                            <h2 className="font-montserrat font-semibold text-white">{title.name}</h2>
                                            {title.description ? <p className="mt-1 font-inter text-sm leading-6 text-white/75">{title.description}</p> : null}
                                        </article>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {participant.achievements.length > 0 ? (
                            <div className="mt-8">
                                <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-300">Prestasi</p>
                                <ul className="mt-3 grid list-decimal gap-2 pl-5 font-inter text-sm leading-6 text-white/85">
                                    {participant.achievements.map((achievement) => (
                                        <li key={achievement}>{achievement}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}

                        {participant.socialLinks.length > 0 ? (
                            <div className="mt-8 flex flex-wrap gap-3">
                                {participant.socialLinks.map((link) => (
                                    <a
                                        key={`${link.platform}-${link.url}`}
                                        href={link.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-md border border-white/35 px-4 py-2 font-inter text-sm text-white transition-colors hover:border-white hover:bg-white hover:text-dgb-900"
                                    >
                                        {link.label ?? link.platform}
                                    </a>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </section>
            </main>
        </>
    )
}
