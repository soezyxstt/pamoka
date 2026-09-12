import { Head } from '@inertiajs/react'

type Faq = {
    question: string
    answer: string
}

type Social = {
    label: string
    url: string
}

type Props = {
    meta: {
        title: string
        description: string
    }
    faqs: Faq[]
    email: string
    socials: Social[]
}

export default function Contact({ meta, faqs, email, socials }: Props) {
    return (
        <>
            <Head title={meta.title}>
                <meta name="description" content={meta.description} />
            </Head>

            <main className="relative min-h-screen overflow-hidden bg-dgb-50 px-5 py-16 sm:px-8 md:px-20 md:py-24">
                <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{ backgroundImage: 'url("/babancong.webp")' }} />
                <section className="relative mx-auto grid max-w-7xl gap-12 md:grid-cols-[1fr_0.8fr] md:gap-20">
                    <div>
                        <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-500">Kontak</p>
                        <h1 className="mt-3 font-montserrat text-4xl font-semibold text-dgb-900 md:text-7xl">Hubungi Kami</h1>
                        <p className="mt-6 max-w-2xl font-montserrat text-base leading-7 text-[#505050]">
                            Untuk pertanyaan, kolaborasi, atau informasi kegiatan, silakan gunakan kanal resmi MOKA Garut.
                        </p>

                        <div className="mt-10 grid gap-6 sm:grid-cols-2">
                            <div className="rounded-xl border border-dgb-100 bg-white/80 p-5">
                                <p className="font-montserrat text-sm font-bold uppercase tracking-[0.14em] text-fb-500">Email</p>
                                <a href={`mailto:${email}`} className="mt-3 block break-words font-montserrat text-sm text-dgb-900 hover:text-fb-500">
                                    {email}
                                </a>
                            </div>
                            <div className="rounded-xl border border-dgb-100 bg-white/80 p-5">
                                <p className="font-montserrat text-sm font-bold uppercase tracking-[0.14em] text-fb-500">Media sosial</p>
                                <div className="mt-3 grid gap-2 text-sm">
                                    {socials.map((social) => (
                                        <a key={social.label} href={social.url} target="_blank" rel="noreferrer" className="text-dgb-900 hover:text-fb-500">
                                            {social.label}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-dgb-100 bg-white/85 p-5 shadow-sm sm:p-8">
                        <p className="font-montserrat text-sm font-bold uppercase tracking-[0.14em] text-fb-500">Pertanyaan umum</p>
                        <div className="mt-5 divide-y divide-dgb-100">
                            {faqs.map((faq) => (
                                <details key={faq.question} className="group py-4">
                                    <summary className="cursor-pointer list-none pr-8 font-montserrat font-semibold text-dgb-900 marker:content-none">
                                        {faq.question}
                                    </summary>
                                    <p className="mt-3 font-montserrat text-sm leading-6 text-[#505050]">{faq.answer}</p>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>
            </main>
        </>
    )
}
