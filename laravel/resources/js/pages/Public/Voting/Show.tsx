import { Head, Link } from '@inertiajs/react'

type Campaign = {
    name: string
    status: string
    statusLabel: string
    pricePerPoint: number
    open: boolean
}

type Participant = {
    number: number
    name: string
    slug: string
    bio: string | null
    image: string | null
    imageAlt: string | null
    achievements: string[]
    qrisImage: string | null
}

type VotingShowProps = {
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
    campaign: Campaign | null
    participant: Participant
    profileIndexPath: string
    voting: {
        available: boolean
        open: boolean
        pricePerPoint: number | null
    }
}

export default function Show({
    meta,
    pageTitle,
    edition,
    category,
    campaign,
    participant,
    profileIndexPath,
    voting,
}: VotingShowProps) {
    const image = participant.image ?? '/finalis/hero.webp'

    return (
        <>
            <Head title={meta.title}>
                <meta name="description" content={meta.description} />
                <meta property="og:image" content={image} />
            </Head>

            <main className="min-h-screen bg-dgb-900 px-4 py-6 text-white sm:px-8 md:px-16 md:py-12">
                <section className="relative isolate mx-auto flex min-h-[calc(100svh-3rem)] max-w-7xl items-end overflow-hidden rounded-2xl bg-dgb-700 px-6 py-8 sm:px-10 md:px-20 md:py-16">
                    <img
                        src={image}
                        alt={participant.imageAlt ?? participant.name}
                        width="1600"
                        height="1000"
                        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
                    />
                    <div className="absolute inset-0 -z-10 bg-linear-to-t from-dgb-900 via-dgb-900/85 to-dgb-900/20" />
                    <div className="relative w-full max-w-4xl">
                        <Link
                            href={profileIndexPath}
                            className="inline-flex rounded-md border border-white/45 px-4 py-2 font-montserrat text-sm font-semibold transition-colors hover:border-white hover:bg-white hover:text-dgb-900"
                        >
                            Kembali ke daftar finalis
                        </Link>
                        <p className="mt-12 font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-300">
                            {category.label} · {category.code}-{String(participant.number).padStart(2, '0')}
                        </p>
                        <h1 className="mt-4 font-montserrat text-4xl font-semibold leading-tight md:text-6xl">{participant.name}</h1>
                        <p className="mt-2 font-montserrat text-lg text-white/80">
                            {pageTitle}{edition ? ` · ${edition.year}` : ''}
                        </p>
                        <div className="mt-8 h-px w-full bg-white/30" />

                        <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_12rem] md:items-start">
                            <div>
                                <p className="max-w-2xl text-base leading-7 text-white/90">
                                    {participant.bio ?? 'Profil peserta sedang disiapkan.'}
                                </p>
                                {participant.achievements.length > 0 ? (
                                    <div className="mt-8">
                                        <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-300">Prestasi</p>
                                        <ul className="mt-3 grid list-decimal gap-2 pl-5 text-sm leading-6 text-white/85">
                                            {participant.achievements.map((achievement) => <li key={achievement}>{achievement}</li>)}
                                        </ul>
                                    </div>
                                ) : null}
                            </div>

                            <div className="grid justify-items-center gap-3 rounded-xl border border-white/20 bg-black/20 p-4 backdrop-blur-sm">
                                <p className="text-center text-sm font-semibold">QR voting</p>
                                {participant.qrisImage ? (
                                    <>
                                        <img
                                            src={participant.qrisImage}
                                            alt={`QR voting ${participant.name}`}
                                            width="200"
                                            height="200"
                                            className="aspect-square w-40 rounded-lg bg-white p-1"
                                        />
                                        <a
                                            href={participant.qrisImage}
                                            download={`qr-${participant.slug}.jpg`}
                                            className="inline-flex min-h-9 w-full items-center justify-center rounded-md bg-fb px-4 py-2 text-sm font-semibold text-dgb-900 transition-colors hover:bg-fb-200"
                                        >
                                            Unduh QR
                                        </a>
                                    </>
                                ) : (
                                    <p className="text-center text-xs leading-5 text-white/70">QR voting belum tersedia.</p>
                                )}
                                <p className="text-center text-xs text-white/70">
                                    {voting.available && campaign ? `1 poin: Rp${campaign.pricePerPoint.toLocaleString('id-ID')}` : 'Kampanye belum tersedia'}
                                </p>
                                {voting.available && !voting.open ? <p className="text-center text-xs text-fb-200">Voting sedang ditutup.</p> : null}
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </>
    )
}
