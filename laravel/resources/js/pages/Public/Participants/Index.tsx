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

type ParticipantsProps = {
    meta: {
        title: string
        description: string
    }
    pageTitle: string
    mode: 'finalists' | 'semifinalists'
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
    participants: Participant[]
    profileBasePath: string
    emptyState: string
}

export default function Index({
    meta,
    pageTitle,
    mode,
    edition,
    category,
    stage,
    participants,
    profileBasePath,
    emptyState,
}: ParticipantsProps) {
    const fallbackImage = '/finalis/hero.webp'

    return (
        <>
            <Head title={meta.title}>
                <meta name="description" content={meta.description} />
            </Head>

            <main className="min-h-screen overflow-hidden bg-dgb-900">
                <section className="relative isolate flex min-h-[28rem] items-end overflow-hidden px-5 py-14 sm:px-8 md:min-h-[70svh] md:px-20 md:py-24">
                    <img
                        src={fallbackImage}
                        alt="Dokumentasi Pasanggiri Mojang Jajaka Kabupaten Garut"
                        width="1600"
                        height="900"
                        className="absolute inset-0 -z-20 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 -z-10 bg-linear-to-t from-dgb-900 via-dgb-900/65 to-dgb-900/15" />
                    <div className="relative mx-auto w-full max-w-7xl">
                        <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-300">
                            {stage.label} · {category.code}
                        </p>
                        <h1 className="mt-4 max-w-4xl font-montserrat text-4xl font-semibold leading-tight text-white md:text-6xl">
                            {pageTitle}
                        </h1>
                        <p className="mt-5 max-w-2xl font-inter text-base leading-7 text-white/80">
                            {edition?.slogan ?? 'Nu Nyunda Tur Nyakola'}
                        </p>
                    </div>
                </section>

                <section className="relative bg-background px-5 py-14 sm:px-8 md:px-20 md:py-24">
                    <div className="mx-auto max-w-7xl">
                        <div className="flex flex-col gap-4 border-b border-dgb-100 pb-6 md:flex-row md:items-end md:justify-between">
                            <div>
                                <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-500">
                                    {edition?.name ?? 'Data publik'}
                                </p>
                                <h2 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900 md:text-5xl">
                                    {category.label}
                                </h2>
                            </div>
                            <p className="max-w-md font-inter text-sm leading-6 text-[#505050]">
                                {`Pilih profil untuk melihat informasi peserta ${mode === 'finalists' ? 'finalis' : 'semifinalis'}.`}
                            </p>
                        </div>

                        {participants.length > 0 ? (
                            <div className="mt-10 grid gap-5 sm:grid-cols-2 md:grid-cols-3">
                                {participants.map((participant) => {
                                    const number = String(participant.number).padStart(2, '0')

                                    return (
                                        <Link
                                            key={participant.slug}
                                            href={`${profileBasePath}/${participant.slug}`}
                                            className="group overflow-hidden rounded-xl border border-dgb-100 bg-white transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-dgb-900/10"
                                        >
                                            <div className="relative aspect-square overflow-hidden bg-dgb-100">
                                                <img
                                                    src={participant.image ?? fallbackImage}
                                                    alt={participant.imageAlt ?? participant.name}
                                                    width="600"
                                                    height="600"
                                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                />
                                                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-dgb-900/90 to-transparent px-5 pb-5 pt-12 text-white">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="font-montserrat text-sm font-bold tracking-[0.18em] text-fb-300">
                                                            {category.code}-{number}
                                                        </span>
                                                        <span className="font-inter text-xs text-white/75">Lihat profil</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid gap-2 p-5">
                                                <h3 className="font-montserrat text-xl font-semibold text-dgb-900">{participant.name}</h3>
                                                <p className="font-inter text-sm leading-6 text-dgb-600">
                                                    {participant.titles[0]?.name ?? stage.name}
                                                </p>
                                            </div>
                                        </Link>
                                    )
                                })}
                            </div>
                        ) : (
                            <p className="mt-10 rounded-xl border border-dashed border-dgb-200 bg-white/70 p-8 text-center font-montserrat text-sm text-dgb-700">
                                {emptyState}
                            </p>
                        )}
                    </div>
                </section>
            </main>
        </>
    )
}
