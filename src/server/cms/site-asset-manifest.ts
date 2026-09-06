export type SiteAssetGroup = "home" | "about" | "category";

export type SiteAssetSlotDefinition = {
  slotKey: string;
  group: SiteAssetGroup;
  pageRoute: string;
  pageLabel: string;
  label: string;
  description: string;
  acceptType: "image" | "video";
  aspectRatio: string;
  required: boolean;
};

export const SITE_ASSET_GROUPS: readonly {
  key: SiteAssetGroup;
  label: string;
  pageRoute: string;
  description: string;
}[] = [
  {
    key: "home",
    label: "Beranda",
    pageRoute: "/",
    description: "Slot visual untuk halaman utama.",
  },
  {
    key: "about",
    label: "Tentang",
    pageRoute: "/tentang",
    description: "Slot visual untuk halaman tentang PAMOKA.",
  },
  {
    key: "category",
    label: "Kategori",
    pageRoute: "/kategori",
    description: "Poster dan video untuk kategori peserta.",
  },
] as const;

export const SITE_ASSET_SLOTS: readonly SiteAssetSlotDefinition[] = [
  // 1. Beranda (/)
  {
    slotKey: "home.hero.bg",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Latar hero",
    description: "Latar utama hero beranda.",
    acceptType: "image",
    aspectRatio: "16:9",
    required: true,
  },
  {
    slotKey: "home.hero.fg",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Gambar depan hero",
    description: "Gambar depan hero dengan latar transparan.",
    acceptType: "image",
    aspectRatio: "4:5",
    required: false,
  },
  {
    slotKey: "home.hero.placeholder",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Pengganti hero",
    description: "Pengganti saat video hero belum tampil.",
    acceptType: "image",
    aspectRatio: "16:9",
    required: false,
  },
  {
    slotKey: "home.programs.bg",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Latar program",
    description: "Latar bagian program unggulan.",
    acceptType: "image",
    aspectRatio: "16:9",
    required: false,
  },
  {
    slotKey: "home.programs.collage.1",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Kolase program 1",
    description: "Foto kolase program unggulan.",
    acceptType: "image",
    aspectRatio: "4:3",
    required: false,
  },
  {
    slotKey: "home.programs.collage.2",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Kolase program 2",
    description: "Foto kolase program unggulan.",
    acceptType: "image",
    aspectRatio: "4:3",
    required: false,
  },
  {
    slotKey: "home.programs.collage.3",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Kolase program 3",
    description: "Foto kolase program unggulan.",
    acceptType: "image",
    aspectRatio: "4:3",
    required: false,
  },
  {
    slotKey: "home.programs.collage.4",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Kolase program 4",
    description: "Foto kolase program unggulan.",
    acceptType: "image",
    aspectRatio: "4:3",
    required: false,
  },
  {
    slotKey: "home.news.bg",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Latar berita",
    description: "Latar bagian berita beranda.",
    acceptType: "image",
    aspectRatio: "16:9",
    required: false,
  },
  {
    slotKey: "home.cta.bg",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Latar ajakan bergabung",
    description: "Latar bagian ajakan bergabung.",
    acceptType: "image",
    aspectRatio: "16:9",
    required: false,
  },
  {
    slotKey: "home.cta.image",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Gambar ajakan bergabung",
    description: "Gambar pendukung ajakan bergabung.",
    acceptType: "image",
    aspectRatio: "4:3",
    required: false,
  },

  // 2. Tentang (/tentang)
  {
    slotKey: "about.hero.bg",
    group: "about",
    pageRoute: "/tentang",
    pageLabel: "Tentang",
    label: "Hero tentang",
    description: "Latar utama hero halaman tentang.",
    acceptType: "image",
    aspectRatio: "16:9",
    required: true,
  },
  {
    slotKey: "about.vision.bg",
    group: "about",
    pageRoute: "/tentang",
    pageLabel: "Tentang",
    label: "Latar visi dan misi",
    description: "Latar bagian visi dan misi.",
    acceptType: "image",
    aspectRatio: "16:9",
    required: false,
  },
  {
    slotKey: "about.intro.image",
    group: "about",
    pageRoute: "/tentang",
    pageLabel: "Tentang",
    label: "Gambar pengantar",
    description: "Gambar pengantar tentang PAMOKA.",
    acceptType: "image",
    aspectRatio: "4:3",
    required: false,
  },
  {
    slotKey: "about.vision.image",
    group: "about",
    pageRoute: "/tentang",
    pageLabel: "Tentang",
    label: "Gambar visi",
    description: "Gambar pendukung visi dan misi.",
    acceptType: "image",
    aspectRatio: "4:3",
    required: false,
  },
  {
    slotKey: "about.gallery.bg",
    group: "about",
    pageRoute: "/tentang",
    pageLabel: "Tentang",
    label: "Latar galeri",
    description: "Latar bagian galeri kilas balik.",
    acceptType: "image",
    aspectRatio: "16:9",
    required: false,
  },

  // 3. Kategori (/kategori)
  {
    slotKey: "category.jd.poster",
    group: "category",
    pageRoute: "/kategori",
    pageLabel: "Kategori",
    label: "Poster JD",
    description: "Poster sampul kategori JD.",
    acceptType: "image",
    aspectRatio: "9:16",
    required: false,
  },
  {
    slotKey: "category.jd.video",
    group: "category",
    pageRoute: "/kategori",
    pageLabel: "Kategori",
    label: "Video JD",
    description: "Video profil kategori JD.",
    acceptType: "video",
    aspectRatio: "9:16",
    required: false,
  },
  {
    slotKey: "category.md.poster",
    group: "category",
    pageRoute: "/kategori",
    pageLabel: "Kategori",
    label: "Poster MD",
    description: "Poster sampul kategori MD.",
    acceptType: "image",
    aspectRatio: "9:16",
    required: false,
  },
  {
    slotKey: "category.md.video",
    group: "category",
    pageRoute: "/kategori",
    pageLabel: "Kategori",
    label: "Video MD",
    description: "Video profil kategori MD.",
    acceptType: "video",
    aspectRatio: "9:16",
    required: false,
  },
  {
    slotKey: "category.jr.poster",
    group: "category",
    pageRoute: "/kategori",
    pageLabel: "Kategori",
    label: "Poster JR",
    description: "Poster sampul kategori JR.",
    acceptType: "image",
    aspectRatio: "9:16",
    required: false,
  },
  {
    slotKey: "category.jr.video",
    group: "category",
    pageRoute: "/kategori",
    pageLabel: "Kategori",
    label: "Video JR",
    description: "Video profil kategori JR.",
    acceptType: "video",
    aspectRatio: "9:16",
    required: false,
  },
  {
    slotKey: "category.mr.poster",
    group: "category",
    pageRoute: "/kategori",
    pageLabel: "Kategori",
    label: "Poster MR",
    description: "Poster sampul kategori MR.",
    acceptType: "image",
    aspectRatio: "9:16",
    required: false,
  },
  {
    slotKey: "category.mr.video",
    group: "category",
    pageRoute: "/kategori",
    pageLabel: "Kategori",
    label: "Video MR",
    description: "Video profil kategori MR.",
    acceptType: "video",
    aspectRatio: "9:16",
    required: false,
  },
] as const;

export const SITE_ASSET_SLOT_MAP = new Map<string, SiteAssetSlotDefinition>(
  SITE_ASSET_SLOTS.map((slot) => [slot.slotKey, slot])
);

export function isValidSlotKey(slotKey: string): boolean {
  return SITE_ASSET_SLOT_MAP.has(slotKey);
}

export function getSlotDefinition(slotKey: string): SiteAssetSlotDefinition | undefined {
  return SITE_ASSET_SLOT_MAP.get(slotKey);
}

export function getSlotsByGroup(group: SiteAssetGroup): SiteAssetSlotDefinition[] {
  return SITE_ASSET_SLOTS.filter((slot) => slot.group === group);
}
