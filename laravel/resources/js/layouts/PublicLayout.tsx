import { Link, usePage } from '@inertiajs/react'
import type { ReactNode } from 'react'

type PublicLayoutProps = {
    children: ReactNode
}

const navigationItems = [
    { href: '/', label: 'Beranda' },
    { href: '/tentang', label: 'Tentang' },
    { href: '/rangkaian-kegiatan/audisi', label: 'Rangkaian kegiatan' },
    { href: '/profil-finalis/mojang-rumaja', label: 'Profil finalis' },
    { href: '/voting/hasil/mojang-dewasa', label: 'Hasil voting' },
]

export default function PublicLayout({ children }: PublicLayoutProps) {
    const { url } = usePage()

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="sticky top-0 z-50 border-b border-white/10 bg-dgb-900/95 text-white shadow-lg shadow-dgb-900/10 backdrop-blur">
                <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-6 px-5 py-3 sm:px-8 lg:px-12">
                    <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Beranda PAMOKA Garut">
                        <span className="grid size-10 place-items-center rounded-full bg-fb font-montserrat text-lg font-extrabold text-dgb-900">
                            P
                        </span>
                        <span className="leading-none">
                            <span className="block font-montserrat text-sm font-extrabold tracking-[0.18em] text-white">
                                PAMOKA
                            </span>
                            <span className="mt-1 block text-xs text-white/65">Garut</span>
                        </span>
                    </Link>

                    <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
                        {navigationItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={navigationClass(url, item.href)}
                                aria-current={isActive(url, item.href) ? 'page' : undefined}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <Link
                            href="/admin/login"
                            className="ml-3 inline-flex min-h-10 items-center rounded-md border border-fb px-4 text-sm font-semibold text-fb transition-colors hover:bg-fb hover:text-dgb-900"
                        >
                            Masuk
                        </Link>
                    </nav>

                    <details className="relative md:hidden">
                        <summary className="cursor-pointer list-none rounded-md border border-fb px-3 py-2 text-sm font-semibold text-fb">
                            Menu
                        </summary>
                        <nav
                            className="absolute right-0 top-12 min-w-56 rounded-xl border border-white/10 bg-dgb-900 p-2 shadow-xl"
                            aria-label="Navigasi seluler"
                        >
                            {navigationItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="block rounded-md px-3 py-3 text-sm text-white/80 hover:bg-white/10 hover:text-white"
                                >
                                    {item.label}
                                </Link>
                            ))}
                            <Link
                                href="/admin/login"
                                className="mt-1 block rounded-md bg-fb px-3 py-3 text-sm font-semibold text-dgb-900"
                            >
                                Masuk
                            </Link>
                        </nav>
                    </details>
                </div>
            </header>

            <main>{children}</main>

            <footer className="bg-linear-to-br from-dgb to-fb text-white">
                <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.2fr_0.8fr] lg:px-12">
                    <div>
                        <p className="font-montserrat text-xl font-semibold">PAMOKA Garut</p>
                        <p className="mt-3 max-w-lg text-sm leading-7 text-white/75">
                            Paguyuban Mojang Jajaka Kabupaten Garut. Nu Nyunda Tur Nyakola.
                        </p>
                    </div>
                    <div>
                        <p className="font-montserrat text-sm font-bold uppercase tracking-[0.16em] text-fb-300">
                            Jelajahi
                        </p>
                        <div className="mt-3 grid gap-2 text-sm text-white/75 sm:grid-cols-2">
                            <Link href="/tentang" className="hover:text-white">
                                Tentang
                            </Link>
                            <Link href="/rangkaian-kegiatan/audisi" className="hover:text-white">
                                Kegiatan
                            </Link>
                            <Link href="/profil-finalis/mojang-rumaja" className="hover:text-white">
                                Profil finalis
                            </Link>
                            <Link href="/voting/hasil/mojang-dewasa" className="hover:text-white">
                                Hasil voting
                            </Link>
                        </div>
                    </div>
                </div>
                <div className="border-t border-white/15 px-5 py-4 text-center text-xs text-white/60 sm:px-8 lg:px-12">
                    © PAMOKA Garut. MOKA Garut.
                </div>
            </footer>
        </div>
    )
}

function isActive(url: string, href: string): boolean {
    return href === '/' ? url === '/' : url === href || url.startsWith(`${href}/`)
}

function navigationClass(url: string, href: string): string {
    const base = 'rounded-md px-3 py-2 text-sm font-medium transition-colors'

    return isActive(url, href) ? `${base} bg-white/10 text-fb-300` : `${base} text-white/80 hover:bg-white/10 hover:text-white`
}
