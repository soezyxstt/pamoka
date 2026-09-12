import { Head } from '@inertiajs/react'

type NewsItem = {
    title: string
    description: string
    image: string
    date: string
    href: string
}

type SiteAsset = {
    url: string
    alt: string | null
    focalX: number | null
    focalY: number | null
}

type HomeProps = {
    meta: {
        title: string
        description: string
    }
    hero: {
        title: string
        tagline: string
        image: string
        portrait: string
        portraitAlt: string
    }
    programImages: string[]
    programs: string[]
    news: NewsItem[]
    join: {
        eyebrow: string
        title: string
        description: string
        href: string
        label: string
        image: string
    }
    assets: Record<string, SiteAsset>
    emptyState: string
}

export default function Home({ meta, hero, programImages, programs, news, join, assets, emptyState }: HomeProps) {
    const assetUrl = (slotKey: string, fallback: string) => assets[slotKey]?.url ?? fallback

    return (
        <>
            <Head title={meta.title}>
                <meta name="description" content={meta.description} />
            </Head>

            <main className="min-h-screen">
                <section
                    className="relative isolate min-h-[75svh] overflow-hidden bg-cover bg-center"
                    style={{ backgroundImage: `url("${hero.image}")` }}
                >
                    <div className="absolute inset-0 -z-10 bg-linear-to-br from-dgb-900/85 via-dgb-700/55 to-fb-500/35" />
                    <div className="mx-auto grid min-h-[75svh] max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1fr_0.8fr] md:px-12">
                        <div className="max-w-2xl text-white">
                            <p className="font-montserrat text-sm font-semibold uppercase tracking-[0.24em] text-fb-300">
                                PAMOKA Garut
                            </p>
                            <h1 className="mt-5 font-montserrat text-4xl font-semibold leading-tight md:text-6xl">
                                {hero.title}
                            </h1>
                            <p className="mt-4 font-montserrat text-2xl italic text-white/90">{hero.tagline}</p>
                        </div>

                        <div className="flex items-end justify-center self-end md:justify-end">
                            <img
                                src={hero.portrait}
                                alt={hero.portraitAlt}
                                width="1000"
                                height="1000"
                                className="max-h-[60svh] w-full max-w-xl object-contain object-bottom"
                            />
                        </div>
                    </div>
                </section>

                <section
                    id="program"
                    className="relative overflow-hidden bg-cover bg-center px-5 py-16 sm:px-8 md:px-20 md:py-24"
                    style={{ backgroundImage: `url("${assetUrl('home.programs.bg', '/programs.jpg')}")` }}
                >
                    <div className="absolute inset-0 bg-dgb-50/90" />
                    <div className="relative mx-auto grid max-w-7xl items-center gap-12 md:grid-cols-[0.9fr_1.1fr] md:gap-20">
                        <div className="grid grid-cols-2 gap-3 rounded-full border border-fb-400 p-5 sm:gap-5 sm:p-10">
                            {programImages.map((image, index) => (
                                <img
                                    key={image}
                                    src={image}
                                    alt={`Dokumentasi program PAMOKA ${index + 1}`}
                                    width="500"
                                    height="500"
                                    className={`aspect-square w-full object-cover ${index % 2 === 0 ? 'rounded-bl-[55%] rounded-tl-[55%]' : 'rounded-br-[55%] rounded-tr-[55%]'}`}
                                />
                            ))}
                        </div>

                        <div>
                            <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-500">
                                Our Program
                            </p>
                            <h2 className="mt-3 font-montserrat text-3xl font-semibold leading-tight text-dgb-900 md:text-5xl">
                                Program Unggulan Paguyuban Mojang Jajaka Kabupaten Garut
                            </h2>
                            <ul className="mt-7 grid gap-3 pl-5 font-inter text-base leading-7 text-[#505050] marker:text-fb-500">
                                {programs.map((program) => (
                                    <li key={program}>{program}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                <section
                    id="berita"
                    className="relative overflow-hidden bg-cover bg-center px-5 py-16 sm:px-8 md:px-24 md:py-24"
                    style={{ backgroundImage: `url("${assetUrl('home.news.bg', '/bagendit.webp')}")` }}
                >
                    <div className="absolute inset-0 bg-fb-50/90" />
                    <div className="relative mx-auto max-w-7xl">
                        <div className="grid gap-5 md:grid-cols-[1fr_0.8fr] md:items-end">
                            <div>
                                <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-500">
                                    Informasi terbaru
                                </p>
                                <h2 className="mt-3 font-montserrat text-3xl font-semibold text-dgb-900 md:text-5xl">
                                    Berita dan Update
                                </h2>
                            </div>
                            <p className="font-montserrat text-base leading-7 text-[#505050]">
                                Tetap terinformasi dengan perkembangan terkini PAMOKA Garut.
                            </p>
                        </div>

                        {news.length > 0 ? (
                            <div className="mt-10 grid gap-6 md:grid-cols-3">
                                {news.map((item) => (
                                    <a
                                        key={item.href}
                                        href={item.href}
                                        target={isExternal(item.href) ? '_blank' : undefined}
                                        rel={isExternal(item.href) ? 'noreferrer' : undefined}
                                        className="group overflow-hidden rounded-xl border border-dgb-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                                    >
                                        <img
                                            src={item.image}
                                            alt=""
                                            width="800"
                                            height="500"
                                            className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="grid gap-3 p-5">
                                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fb-500">
                                                {item.date}
                                            </p>
                                            <h3 className="font-montserrat text-lg font-semibold leading-snug text-dgb-900">
                                                {item.title}
                                            </h3>
                                            <p className="line-clamp-3 text-sm leading-6 text-[#505050]">{item.description}</p>
                                            <span className="font-montserrat text-sm font-semibold text-dgb">Selengkapnya</span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-10 rounded-xl border border-dashed border-dgb-200 bg-white/70 p-8 text-center font-montserrat text-sm text-dgb-700">
                                {emptyState}
                            </p>
                        )}
                    </div>
                </section>

                <section
                    className="relative overflow-hidden bg-cover bg-center px-5 py-16 sm:px-8 md:px-20 md:py-24"
                    style={{ backgroundImage: `url("${assetUrl('home.cta.bg', '/gf-1.webp')}")` }}
                >
                    <div className="absolute inset-0 bg-fb-50/88" />
                    <div className="relative mx-auto grid max-w-7xl items-center gap-12 md:grid-cols-[0.9fr_1.1fr] md:gap-20">
                        <img
                            src={join.image}
                            alt="Logo MOKA Garut"
                            width="1000"
                            height="1000"
                            className="w-full max-w-xl rounded-bl-[65%] object-cover"
                        />
                        <div className="grid gap-5">
                            <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-500">
                                {join.eyebrow}
                            </p>
                            <h2 className="font-montserrat text-3xl font-semibold leading-tight text-dgb-900 md:text-5xl">
                                {join.title}
                            </h2>
                            <p className="font-montserrat text-base leading-7 text-[#505050]">{join.description}</p>
                            <a
                                href={join.href}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-h-10 w-fit items-center rounded-md bg-dgb px-5 py-2.5 font-montserrat text-sm font-semibold text-white transition-colors hover:bg-dgb-600"
                            >
                                {join.label}
                            </a>
                        </div>
                    </div>
                </section>
            </main>
        </>
    )
}

function isExternal(href: string): boolean {
    return href.startsWith('http://') || href.startsWith('https://')
}
