import { Head } from '@inertiajs/react'
import { useState } from 'react'

type EventData = {
    slug: string
    label: string
    description: string
    images: string[]
}

type Sponsor = {
    name: string
    image: string
}

type EventShowProps = {
    meta: {
        title: string
        description: string
    }
    pageTitle: string
    event: EventData
    sponsors: Sponsor[]
    emptyState: string
}

export default function Show({ meta, pageTitle, event, sponsors, emptyState }: EventShowProps) {
    const [activeImage, setActiveImage] = useState(0)
    const image = event.images[activeImage] ?? null

    const changeImage = (direction: number) => {
        if (event.images.length === 0) return

        setActiveImage((current) => (current + direction + event.images.length) % event.images.length)
    }

    return (
        <>
            <Head title={meta.title}>
                <meta name="description" content={meta.description} />
            </Head>

            <main className="min-h-screen bg-dgb-900 text-white">
                <section className="relative isolate min-h-[80svh] overflow-hidden">
                    {image ? (
                        <img
                            src={image}
                            alt={`Dokumentasi ${event.label}`}
                            className="absolute inset-0 -z-20 h-full w-full object-cover"
                        />
                    ) : (
                        <div className="absolute inset-0 -z-20 bg-dgb-700" />
                    )}
                    <div className="absolute inset-0 -z-10 bg-linear-to-r from-dgb-900/90 via-dgb-900/60 to-dgb-900/20" />
                    <div className="absolute inset-0 -z-10 bg-linear-to-t from-dgb-900 via-transparent to-transparent" />

                    <div className="mx-auto flex min-h-[80svh] max-w-7xl flex-col justify-end gap-8 px-5 py-14 sm:px-8 md:px-20 md:py-20">
                        <div className="max-w-2xl">
                            <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-300">
                                Rangkaian kegiatan
                            </p>
                            <h1 className="mt-4 font-montserrat text-4xl font-semibold leading-tight md:text-6xl">
                                {pageTitle}
                            </h1>
                            <p className="mt-5 max-w-xl font-inter text-base leading-7 text-white/85">{event.description}</p>
                        </div>

                        {event.images.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-3" aria-label="Kontrol galeri kegiatan">
                                <button
                                    type="button"
                                    onClick={() => changeImage(-1)}
                                    className="inline-flex min-h-10 items-center rounded-md border border-white/50 px-4 text-sm font-semibold transition-colors hover:border-white hover:bg-white hover:text-dgb-900"
                                    aria-label="Foto sebelumnya"
                                >
                                    Sebelumnya
                                </button>
                                <button
                                    type="button"
                                    onClick={() => changeImage(1)}
                                    className="inline-flex min-h-10 items-center rounded-md bg-fb px-4 text-sm font-semibold text-dgb-900 transition-colors hover:bg-fb-200"
                                    aria-label="Foto berikutnya"
                                >
                                    Berikutnya
                                </button>
                                <span className="text-sm text-white/75">
                                    Foto {activeImage + 1} dari {event.images.length}
                                </span>
                            </div>
                        ) : null}
                    </div>
                </section>

                <section className="bg-background px-5 py-14 text-foreground sm:px-8 md:px-20 md:py-20">
                    <div className="mx-auto max-w-7xl">
                        <div className="flex flex-wrap gap-2" aria-label="Pilih foto dokumentasi">
                            {event.images.map((imagePath, index) => (
                                <button
                                    key={imagePath}
                                    type="button"
                                    onClick={() => setActiveImage(index)}
                                    className={`overflow-hidden rounded-md border-2 transition-all ${index === activeImage ? 'border-fb-500' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                    aria-label={`Tampilkan foto ${index + 1}`}
                                    aria-pressed={index === activeImage}
                                >
                                    <img src={imagePath} alt="" width="120" height="80" className="h-16 w-24 object-cover" />
                                </button>
                            ))}
                        </div>

                        <div className="mt-16 border-t border-dgb-100 pt-12">
                            <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-500">Dukungan</p>
                            <h2 className="mt-3 font-montserrat text-3xl font-semibold text-dgb-900 md:text-5xl">Sponsor kami</h2>
                            {sponsors.length > 0 ? (
                                <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                                    {sponsors.map((sponsor) => (
                                        <div key={sponsor.image} className="grid min-h-24 place-items-center rounded-xl border border-dgb-100 bg-white p-3">
                                            <img src={sponsor.image} alt={sponsor.name} width="240" height="120" className="max-h-20 w-full object-contain" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-8 rounded-xl border border-dashed border-dgb-200 bg-white/70 p-8 text-center font-montserrat text-sm text-dgb-700">
                                    {emptyState}
                                </p>
                            )}
                        </div>
                    </div>
                </section>
            </main>
        </>
    )
}
