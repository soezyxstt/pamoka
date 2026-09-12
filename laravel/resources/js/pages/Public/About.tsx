import { Head } from '@inertiajs/react'

type Person = {
    name: string
    position: string
    image: string
    gender: 'L' | 'P'
}

type Video = {
    id: string
    title: string
}

type AboutProps = {
    meta: {
        title: string
        description: string
    }
    hero: {
        title: string
        image: string
    }
    vision: {
        title: string
        description: string
        image: string
    }
    missions: string[]
    legal: {
        title: string
        description: string
        documentUrl: string
    }
    leadership: Person[]
    pastLeaders: Person[]
    videos: Video[]
    emptyState: string
}

export default function About({ meta, hero, vision, missions, legal, leadership, pastLeaders, videos, emptyState }: AboutProps) {
    return (
        <>
            <Head title={meta.title}>
                <meta name="description" content={meta.description} />
            </Head>

            <main className="relative min-h-screen">
                <section className="relative grid min-h-[34rem] place-items-center overflow-hidden px-5 py-24 sm:px-8 md:h-[75svh]">
                    <img src={hero.image} alt="" width="1600" height="900" className="absolute inset-0 h-full w-full object-cover opacity-40" />
                    <div className="absolute inset-0 bg-linear-to-br from-dgb-900/55 via-dgb-600/30 to-fb-300/25" />
                    <h1 className="relative mx-auto max-w-3xl text-center font-montserrat text-4xl font-semibold leading-tight text-white md:text-6xl">
                        {hero.title}
                    </h1>
                </section>

                <section
                    id="visi-misi"
                    className="relative overflow-hidden bg-cover bg-center px-5 pb-16 sm:px-8 md:pb-24"
                    style={{ backgroundImage: 'url("/gf-1.webp")' }}
                >
                    <div className="relative mx-auto -mt-12 max-w-5xl md:-mt-20">
                        <img
                            src="/gf-about.webp"
                            alt="Kebersamaan keluarga PAMOKA Garut"
                            width="1080"
                            height="720"
                            className="aspect-[16/9] w-full rounded-l-full rounded-br-full object-cover shadow-xl shadow-dgb-900/15"
                        />
                    </div>

                    <div className="relative mx-auto mt-10 grid max-w-7xl items-end gap-8 md:grid-cols-[minmax(0,1fr)_25rem] md:gap-16">
                        <div className="md:pl-[6%]">
                            <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-500">Arah organisasi</p>
                            <h2 className="mt-3 font-montserrat text-3xl font-semibold text-dgb-900 md:text-5xl">{vision.title}</h2>
                            <p className="mt-4 max-w-2xl font-montserrat text-base leading-7 text-[#505050]">{vision.description}</p>
                        </div>
                        <img
                            src={vision.image}
                            alt="Kegiatan PAMOKA Garut"
                            width="500"
                            height="360"
                            className="hidden aspect-[5/3] w-full rounded-tl-2xl object-cover md:block"
                        />
                    </div>

                    <div className="relative mt-16 ml-auto w-[96%] rounded-tl-[56px] bg-linear-to-bl from-dgb-300 via-dgb-300 to-fb-300 px-6 py-10 text-white md:w-[90%] md:rounded-tl-[80px] md:px-12 md:py-12">
                        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-0">
                            {missions.map((mission, index) => (
                                <article key={mission} className="font-montserrat lg:border-l lg:border-white/25 lg:px-6 lg:first:border-l-0 lg:first:pl-0 lg:last:pr-0">
                                    <div className="mb-3 flex items-center gap-2">
                                        <span className="grid size-6 place-items-center rounded-full border border-white/50 text-xs font-bold">
                                            {index + 1}
                                        </span>
                                        <h3 className="font-semibold">Misi {index + 1}</h3>
                                    </div>
                                    <p className="text-sm leading-6 text-white/85">{mission}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section
                    className="relative overflow-hidden bg-cover bg-center px-5 py-16 sm:px-8 md:px-20 md:py-24"
                    style={{ backgroundImage: 'url("/logogram-dg.png")' }}
                >
                    <div className="absolute inset-0 bg-fb-50/90" />
                    <div className="relative mx-auto max-w-7xl">
                        <div className="grid items-center gap-10 md:grid-cols-[0.75fr_1.25fr] md:gap-16">
                            <img src="/logo-dg.png" alt="PAMOKA Garut" width="600" height="300" className="w-full max-w-md object-contain" />
                            <div>
                                <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-500">{legal.title}</p>
                                <p className="mt-3 font-montserrat text-base leading-7 text-[#505050]">{legal.description}</p>
                                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                                    <a
                                        href={legal.documentUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb px-4 font-montserrat text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white"
                                    >
                                        Lihat dokumen
                                    </a>
                                    <a
                                        href={legal.documentUrl}
                                        download="SK_MOKA.pdf"
                                        className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb bg-dgb px-4 font-montserrat text-sm font-semibold text-white transition-colors hover:bg-dgb-600"
                                    >
                                        Unduh PDF
                                    </a>
                                </div>
                            </div>
                        </div>

                        <PeopleSection title="Struktur organisasi" heading="Pengurus Paguyuban Mojang Jajaka Kabupaten Garut" people={leadership} emptyState={emptyState} />
                        <PeopleSection title="Lintas masa" heading="Para Ketua Paguyuban Mojang Jajaka Kabupaten Garut" people={pastLeaders} emptyState={emptyState} alignRight />
                    </div>
                </section>

                <section
                    id="gallery"
                    className="relative overflow-hidden bg-cover bg-center px-5 py-16 sm:px-8 md:px-24 md:py-24"
                    style={{ backgroundImage: 'url("/bagendit.jpg")' }}
                >
                    <div className="absolute inset-0 bg-dgb-50/90" />
                    <div className="relative mx-auto max-w-6xl">
                        <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-500">Dokumentasi</p>
                        <h2 className="mt-3 font-montserrat text-3xl font-semibold text-dgb-900 md:text-5xl">Galeri PAMOKA</h2>
                        {videos.length > 0 ? (
                            <div className="mt-8 grid gap-6 md:grid-cols-2">
                                {videos.map((video) => (
                                    <div key={video.id} className="overflow-hidden rounded-xl bg-dgb-900 shadow-lg">
                                        <iframe
                                            src={`https://www.youtube.com/embed/${video.id}`}
                                            title={video.title}
                                            loading="lazy"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            allowFullScreen
                                            className="aspect-video w-full"
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-8 rounded-xl border border-dashed border-dgb-200 bg-white/70 p-8 text-center font-montserrat text-sm text-dgb-700">
                                {emptyState}
                            </p>
                        )}
                    </div>
                </section>
            </main>
        </>
    )
}

function PeopleSection({ title, heading, people, emptyState, alignRight = false }: { title: string; heading: string; people: Person[]; emptyState: string; alignRight?: boolean }) {
    return (
        <div className="mt-16">
            <div className={alignRight ? 'max-w-3xl md:ml-auto md:text-right' : 'max-w-3xl'}>
                <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-500">{title}</p>
                <h2 className="mt-3 font-montserrat text-3xl font-semibold text-dgb-900 md:text-5xl">{heading}</h2>
            </div>
            {people.length > 0 ? (
                <div className="mt-8 grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {people.map((person) => (
                        <article key={`${person.position}-${person.name}`} className="overflow-hidden rounded-xl border border-dgb-100 bg-white shadow-sm">
                            <img src={person.image} alt={`${person.name}, ${person.position}`} width="500" height="500" className="aspect-square w-full object-cover" />
                            <div className="grid gap-1 p-4">
                                <h3 className="font-montserrat font-semibold text-dgb-900">{person.gender === 'L' ? 'Kang' : 'Teh'} {person.name}</h3>
                                <p className="text-sm leading-5 text-dgb-600">{person.position}</p>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <p className="mt-8 rounded-xl border border-dashed border-dgb-200 bg-white/70 p-8 text-center font-montserrat text-sm text-dgb-700">
                    {emptyState}
                </p>
            )}
        </div>
    )
}
