import { Head, Link } from '@inertiajs/react'

type Participant = {
    number: number
    name: string
    slug: string
    bio: string | null
    image: string | null
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
                        alt={participant.name}
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
                    </div>
                </section>
            </main>
        </>
    )
}
