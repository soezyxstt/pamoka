import { Head, Link } from '@inertiajs/react'

type Campaign = {
    name: string
    status: string
    statusLabel: string
    startsAt: string | null
    endsAt: string | null
    pricePerPoint: number
    open: boolean
}

type Candidate = {
    number: number
    name: string
    slug: string
    image: string | null
    imageAlt: string | null
    qrisImage: string | null
}

type VotingIndexProps = {
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
    participants: Candidate[]
    voting: {
        available: boolean
        open: boolean
        pricePerPoint: number | null
    }
    resultPath: string
    emptyState: string
}

export default function Index({
    meta,
    pageTitle,
    edition,
    category,
    campaign,
    participants,
    voting,
    resultPath,
    emptyState,
}: VotingIndexProps) {
    return (
        <>
            <Head title={meta.title}>
                <meta name="description" content={meta.description} />
            </Head>

            <main className="min-h-screen bg-dgb-900 text-white">
                <section className="relative isolate overflow-hidden px-5 py-20 sm:px-8 md:px-20 md:py-28">
                    <img
                        src="/finalis/hero.webp"
                        alt="Dokumentasi finalis PAMOKA Garut"
                        width="1600"
                        height="900"
                        className="absolute inset-0 -z-20 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 -z-10 bg-linear-to-br from-dgb-900/95 via-dgb-900/80 to-fb-500/35" />
                    <div className="relative mx-auto max-w-7xl">
                        <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-300">
                            Voting · {category.code}
                        </p>
                        <h1 className="mt-4 max-w-4xl font-montserrat text-4xl font-semibold leading-tight md:text-6xl">
                            {pageTitle}
                        </h1>
                        <p className="mt-5 max-w-3xl text-base leading-7 text-white/80">
                            Dukung finalis pilihanmu melalui voting Kameumeut Pasanggiri Mojang Jajaka Kabupaten Garut.
                            {edition?.slogan ? ` ${edition.slogan}` : ''}
                        </p>

                        <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
                            <InfoItem label="Status" value={statusLabel(campaign, voting.open)} />
                            <InfoItem label="Harga" value={campaign ? `Rp${campaign.pricePerPoint.toLocaleString('id-ID')} per poin` : 'Belum tersedia'} />
                            <InfoItem label="Finalis" value={`${participants.length} orang`} />
                        </div>

                        <div className="mt-7 flex flex-wrap gap-3">
                            <Link
                                href={resultPath}
                                className="inline-flex min-h-10 items-center rounded-md border border-fb px-5 py-2.5 font-montserrat text-sm font-semibold text-fb-300 transition-colors hover:bg-fb hover:text-dgb-900"
                            >
                                Lihat hasil voting
                            </Link>
                            {campaign?.startsAt && campaign.endsAt ? (
                                <p className="self-center text-sm text-white/70">
                                    Periode {formatDate(campaign.startsAt)} sampai {formatDate(campaign.endsAt)}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </section>

                <section className="bg-background px-5 py-14 text-foreground sm:px-8 md:px-20 md:py-24">
                    <div className="mx-auto max-w-7xl">
                        <div className="flex flex-col gap-4 border-b border-dgb-100 pb-6 md:flex-row md:items-end md:justify-between">
                            <div>
                                <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-500">
                                    {edition?.name ?? 'Data publik'}
                                </p>
                                <h2 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900 md:text-5xl">
                                    Finalis {category.label}
                                </h2>
                            </div>
                            <p className="max-w-md text-sm leading-6 text-[#505050]">
                                Pilih profil untuk melihat detail peserta dan QR voting yang tersedia.
                            </p>
                        </div>

                        {participants.length > 0 ? (
                            <div className="mt-10 grid gap-5 sm:grid-cols-2 md:grid-cols-3">
                                {participants.map((participant) => (
                                    <Link
                                        key={participant.slug}
                                        href={`/voting/${category.slug}/${participant.slug}`}
                                        className="group overflow-hidden rounded-xl border border-dgb-100 bg-white transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-dgb-900/10"
                                    >
                                        <div className="relative aspect-square overflow-hidden bg-dgb-100">
                                            <img
                                                src={participant.image ?? '/finalis/hero.webp'}
                                                alt={participant.imageAlt ?? participant.name}
                                                width="600"
                                                height="600"
                                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-dgb-900/95 to-transparent px-5 pb-5 pt-12 text-white">
                                                <span className="font-montserrat text-sm font-bold tracking-[0.18em] text-fb-300">
                                                    {category.code}-{String(participant.number).padStart(2, '0')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="grid gap-2 p-5">
                                            <h3 className="font-montserrat text-xl font-semibold text-dgb-900">{participant.name}</h3>
                                            <p className="text-sm text-dgb-600">{participant.qrisImage ? 'QR voting tersedia' : 'Profil peserta'}</p>
                                        </div>
                                    </Link>
                                ))}
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

function InfoItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-white/15 bg-black/15 px-4 py-3 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-white/55">{label}</p>
            <p className="mt-1 text-sm font-semibold text-white">{value}</p>
        </div>
    )
}

function statusLabel(campaign: Campaign | null, open: boolean): string {
    if (open) return 'Sedang dibuka'
    if (campaign?.status === 'closed') return 'Ditutup'
    if (campaign) return campaign.statusLabel
    return 'Belum tersedia'
}

function formatDate(value: string): string {
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
    }).format(new Date(value))
}
