"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, ChevronDown, ChevronRight, Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AdminScrollArea, adminNativeScrollbarClassName } from "./admin-scroll-area";
import { AdminIcon, type AdminIconName } from "./icons";
import { AdminEditionSelector } from "./edition-selector";
import type { AdminEditionContext } from "@/server/cms/context";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: AdminIconName;
  group: string;
  exact?: boolean;
};

export type AdminUser = { name: string; email: string };

const CONTENT_NAV_STORAGE_KEY = "pamoka_admin_nav_content_open";

const isContentPath = (value: string) =>
  value.startsWith("/admin/content") && value !== "/admin/content/editions";

const contentNavigationFallbacks = new WeakMap<Window, boolean>();

const contentNavigationStore = {
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    contentNavigationStore.listeners.add(listener);
    if (typeof window === "undefined") return () => contentNavigationStore.listeners.delete(listener);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === CONTENT_NAV_STORAGE_KEY || event.key === null) listener();
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      contentNavigationStore.listeners.delete(listener);
      window.removeEventListener("storage", handleStorage);
    };
  },
  getSnapshot() {
    if (typeof window === "undefined") return true;
    try {
      const stored = window.localStorage.getItem(CONTENT_NAV_STORAGE_KEY);
      return stored !== null ? stored === "true" : contentNavigationFallbacks.get(window) ?? true;
    } catch {
      return contentNavigationFallbacks.get(window) ?? true;
    }
  },
  getServerSnapshot() {
    return true;
  },
  setOpen(isOpen: boolean) {
    if (typeof window !== "undefined") {
      contentNavigationFallbacks.set(window, isOpen);
      try {
        window.localStorage.setItem(CONTENT_NAV_STORAGE_KEY, String(isOpen));
      } catch {
        // Persistence is optional; the in-memory value keeps navigation usable.
      }
    }
    contentNavigationStore.listeners.forEach((listener) => listener());
  },
};

export function AdminShell({
  children,
  links,
  user,
  currentEdition,
  allEditions = [],
}: {
  children: React.ReactNode;
  links: AdminNavItem[];
  user: AdminUser;
  currentEdition: AdminEditionContext | null;
  allEditions?: AdminEditionContext[];
}) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const isContentOpen = useSyncExternalStore(
    contentNavigationStore.subscribe,
    contentNavigationStore.getSnapshot,
    contentNavigationStore.getServerSnapshot,
  );
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    const wasContentPath = isContentPath(previousPathnameRef.current);
    const isCurrentContentPath = isContentPath(pathname);

    if (isCurrentContentPath && !wasContentPath) {
      contentNavigationStore.setOpen(true);
    }

    previousPathnameRef.current = pathname;
  }, [pathname]);

  const handleToggleContent = () => {
    contentNavigationStore.setOpen(!isContentOpen);
  };

  const groups = [...new Set(links.map((link) => link.group))];
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isActive = (item: AdminNavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const renderNavGroup = (group: string) => {
    const groupLinks = links.filter((link) => link.group === group);
    if (groupLinks.length === 0) return null;

    if (group === "Konten") {
      return (
        <div key={group} className="space-y-1">
          <Button
            type="button"
            onClick={handleToggleContent}
            aria-expanded={isContentOpen}
            variant="ghost"
            size="sm"
            className="flex h-auto w-full justify-between rounded-md px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/45 hover:bg-white/6 hover:text-white/70"
          >
            <span>{group}</span>
            <span className="flex items-center gap-1 text-[9px] font-normal lowercase tracking-normal text-white/35">
              {isContentOpen ? (
                <ChevronDown size={14} className="text-white/60" />
              ) : (
                <ChevronRight size={14} className="text-white/60" />
              )}
            </span>
          </Button>
          {isContentOpen ? (
            <div className="space-y-1 pt-1">
              {groupLinks.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      "group flex min-h-10 items-center gap-3 border-l-2 px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "border-fb bg-white/9 text-white font-semibold"
                        : "border-transparent text-white/66 hover:border-white/20 hover:bg-white/6 hover:text-white",
                    )}
                  >
                    <AdminIcon name={item.icon} size={15} strokeWidth={1.8} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {active ? <span className="size-1.5 bg-fb" aria-hidden="true" /> : null}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div key={group}>
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/38">
          {group}
        </p>
        <div className="space-y-1">
          {groupLinks.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  "group flex min-h-10 items-center gap-3 border-l-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-fb bg-white/9 text-white"
                    : "border-transparent text-white/66 hover:border-white/20 hover:bg-white/6 hover:text-white",
                )}
              >
                <AdminIcon name={item.icon} size={16} strokeWidth={1.8} />
                <span className="flex-1 truncate">{item.label}</span>
                {active ? <span className="size-1.5 bg-fb" aria-hidden="true" /> : null}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  const navigation = (
    <nav className="space-y-5" aria-label="Navigasi admin">
      {groups.map(renderNavGroup)}
    </nav>
  );

  return (
    <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
      <div className="min-h-screen bg-background text-foreground lg:flex">
        <aside className="relative hidden w-64 shrink-0 overflow-hidden border-r border-white/10 bg-dgb-900 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div className="flex h-16 shrink-0 items-center border-b border-white/8 px-5">
            <Link href="/admin" className="flex items-center gap-3" aria-label="Dashboard PAMOKA CMS">
              <Image src="/logogram-gold.png" alt="" width={30} height={30} className="size-8 object-contain" />
              <span>
                <span className="block font-montserrat text-sm font-semibold tracking-wide text-white">PAMOKA CMS</span>
                <span className="block text-[9px] uppercase tracking-[0.16em] text-fb-300">Ruang kerja admin</span>
              </span>
            </Link>
          </div>
          <AdminScrollArea surface="dark" className="min-h-0 flex-1">
            <div className="px-4 py-5">{navigation}</div>
          </AdminScrollArea>
          <div className="relative border-t border-white/8 p-4">
            <div className="mb-2 border-l-2 border-fb px-3 py-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-fb-300">Edisi terpilih</p>
              <p className="mt-1 truncate text-xs font-medium text-white/75">
                {currentEdition ? `${currentEdition.name}, ${currentEdition.year}` : "Belum ditentukan"}
              </p>
            </div>
            <Link
              href="/"
              target="_blank"
              className="flex items-center justify-between border-l-2 border-transparent px-3 py-2 text-xs text-white/66 transition-colors hover:border-white/20 hover:bg-white/6 hover:text-white"
            >
              Lihat situs publik <ArrowUpRight size={14} />
            </Link>
          </div>
        </aside>

        <SheetContent
          side="left"
          className="w-[min(86vw,19rem)] gap-0 overflow-hidden border-white/10 bg-dgb-900 p-0 text-white sm:max-w-[19rem] [&>button]:text-white/70 [&>button]:hover:bg-white/8 [&>button]:hover:text-white"
        >
          <SheetTitle className="sr-only">Navigasi admin PAMOKA CMS</SheetTitle>
          <SheetDescription className="sr-only">Menu ruang kerja admin PAMOKA.</SheetDescription>
          <div className="flex h-16 shrink-0 items-center border-b border-white/8 px-5 pr-14">
            <Link href="/admin" onClick={() => setIsMobileOpen(false)} className="flex items-center gap-3" aria-label="Dashboard PAMOKA CMS">
              <Image src="/logogram-gold.png" alt="" width={30} height={30} className="size-8 object-contain" />
              <span className="font-montserrat text-sm font-semibold text-white">PAMOKA CMS</span>
            </Link>
          </div>
          <AdminScrollArea surface="dark" className="min-h-0 flex-1">
            <div className="px-4 py-5">{navigation}</div>
          </AdminScrollArea>
        </SheetContent>

        <div className={cn("h-screen min-w-0 flex-1 overflow-y-auto", adminNativeScrollbarClassName)}>
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-dgb-100 bg-dgb-50/88 px-3 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0 border border-dgb-100 bg-dgb-50 text-dgb shadow-none hover:bg-dgb-100 hover:text-dgb lg:hidden"
                  aria-label="Buka navigasi"
                  aria-expanded={isMobileOpen}
                >
                  <Menu size={18} />
                </Button>
              </SheetTrigger>
              <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
                <span className="font-montserrat font-semibold text-dgb-900">PAMOKA CMS</span>
                <ChevronRight size={13} />
                <span>{currentEdition?.name ?? "Ruang kerja"}</span>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <AdminEditionSelector
                currentEdition={currentEdition}
                editions={allEditions}
              />

              <Link
                href="/admin/profile"
                className="flex items-center gap-2.5 rounded-md p-1 transition-colors hover:bg-dgb-100/50"
                aria-label={`Profil ${user.name}`}
              >
                <div className="hidden text-right lg:block">
                  <p className="text-xs font-semibold leading-tight text-dgb-900">{user.name}</p>
                  <p className="max-w-[160px] truncate text-[11px] text-muted-foreground">{user.email}</p>
                </div>
                <div className="grid size-9 place-items-center rounded-md bg-dgb text-xs font-bold text-white shadow-xs">
                  {initials || "A"}
                </div>
              </Link>
            </div>
          </header>
          {children}
        </div>
      </div>
    </Sheet>
  );
}

export function AdminAuthShell({
  children,
  eyebrow,
  title,
  description,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[url(/hero-about.webp)] bg-cover bg-center p-4 text-white sm:p-8">
      <div className="absolute inset-0 bg-radial-[at_50%_50%] from-dgb-900/35 to-90% to-dgb-900" />
      <section className="relative w-full max-w-xl rounded-xl border border-white/20 bg-dgb-900/58 px-6 py-8 shadow-2xl shadow-black/20 backdrop-blur-md sm:px-10 sm:py-10">
        <div className="mx-auto w-full max-w-md [&_.text-dgb-900]:text-white [&_.text-muted-foreground]:text-white/70">
          <Link href="/" className="mb-10 inline-flex">
            <Image src="/logo-w.png" alt="PAMOKA Garut" width={190} height={72} className="h-auto w-44 object-contain object-left" />
          </Link>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-fb-600">{eyebrow}</p>
          <h1 className="mt-3 font-montserrat text-3xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-white/70">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
