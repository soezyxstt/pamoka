import Link from "next/link";
import { requirePermission } from "@/server/auth/authorization";
import { ArrowUpRight } from "lucide-react";
import { AdminIcon, type AdminIconName } from "@/components/admin/icons";
import { AdminBadge, AdminPage } from "@/components/admin/primitives";
import { getAdminEditionContext } from "@/server/cms/context";

export const metadata = { title: "Ikhtisar konten" };

const modules: { slug: string; label: string; description: string; icon: AdminIconName; accent: string }[] = [
  { slug: "editions", label: "Kelola edisi", description: "Atur periode, kategori, dan aktivasi edisi tahunan.", icon: "calendar", accent: "bg-fb-50 text-fb-600" },
  { slug: "edition-settings", label: "Identitas edisi", description: "Logo, slogan, dan program unggulan edisi terpilih.", icon: "sparkles", accent: "bg-amber-50 text-amber-700" },
  { slug: "site-assets", label: "Aset situs", description: "Slot gambar tetap untuk beranda, tentang, dan kategori.", icon: "images", accent: "bg-dgb-50 text-dgb" },
  { slug: "news", label: "Berita", description: "Tulis berita sebagai draft sebelum preview dan publikasi.", icon: "newspaper", accent: "bg-sky-50 text-sky-700" },
  { slug: "sponsors", label: "Sponsor", description: "Kelola partner dan tingkat penampilannya per edisi.", icon: "handshake", accent: "bg-fb-50 text-fb-600" },
  { slug: "participants", label: "Mojang Jajaka", description: "Kelola peserta, kategori, tahap seleksi, dan QRIS.", icon: "users", accent: "bg-violet-50 text-violet-700" },
  { slug: "events", label: "Acara", description: "Susun kegiatan dan item carousel foto kegiatan.", icon: "calendar", accent: "bg-rose-50 text-rose-700" },
  { slug: "galleries", label: "Galeri", description: "Koleksi album foto dan video kegiatan Pasanggiri.", icon: "gallery", accent: "bg-amber-50 text-amber-700" },
  { slug: "committee", label: "Panitia", description: "Struktur panitia dan penugasan profil per edisi.", icon: "clipboard", accent: "bg-emerald-50 text-emerald-700" },
];

export default async function ContentPage() {
  await requirePermission("content.view");
  const currentEdition = await getAdminEditionContext();

  return (
    <AdminPage
      eyebrow="Studio konten"
      title="Cerita PAMOKA, tertata rapi."
      description={
        currentEdition
          ? `Pilih modul konten untuk edisi ${currentEdition.name} (${currentEdition.year}). Gunakan sidebar untuk akses langsung ke setiap modul.`
          : "Pilih modul yang ingin dikelola. Konten visual menggunakan draft dan preview."
      }
      action={currentEdition ? <AdminBadge value={currentEdition.lifecycle} /> : null}
    >
      <div className="grid border-l border-t border-dgb-100 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module, index) => (
          <Link
            href={`/admin/content/${module.slug}`}
            className="group relative min-h-52 border-b border-r border-dgb-100 p-5 transition-colors hover:bg-dgb-50/45 sm:p-6"
            key={module.slug}
          >
            <div className="flex items-start justify-between gap-4">
              <span className={`grid size-10 place-items-center ${module.accent}`}>
                <AdminIcon name={module.icon} size={19} strokeWidth={1.8} />
              </span>
              <span className="font-montserrat text-xs font-semibold tabular-nums text-dgb-300">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <h2 className="mt-6 font-montserrat text-base font-semibold text-dgb-900">{module.label}</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{module.description}</p>
            <ArrowUpRight
              size={17}
              className="absolute bottom-5 right-5 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-fb-600 sm:bottom-6 sm:right-6"
            />
          </Link>
        ))}
      </div>
    </AdminPage>
  );
}
