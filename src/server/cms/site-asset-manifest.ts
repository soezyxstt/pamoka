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
    description: "Slot aset visual untuk halaman utama (hero, program, berita, dan ajakan bergabung).",
  },
  {
    key: "about",
    label: "Tentang",
    pageRoute: "/tentang",
    description: "Slot aset visual untuk halaman profil paguyuban, visi misi, dan kilas balik.",
  },
  {
    key: "category",
    label: "Kategori",
    pageRoute: "/kategori",
    description: "Poster dan video profil untuk setiap kategori mojang dan jajaka.",
  },
] as const;

export const SITE_ASSET_SLOTS: readonly SiteAssetSlotDefinition[] = [
  // 1. Beranda (/)
  {
    slotKey: "home.hero.bg",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Background Hero",
    description: "Gambar latar belakang utama pada bagian hero beranda.",
    acceptType: "image",
    aspectRatio: "16:9",
    required: true,
  },
  {
    slotKey: "home.hero.fg",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Foreground Hero",
    description: "Gambar mojang jajaka/foreground beranda dengan latar belakang transparan.",
    acceptType: "image",
    aspectRatio: "4:5",
    required: false,
  },
  {
    slotKey: "home.hero.placeholder",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Placeholder Hero",
    description: "Gambar pengganti saat video hero beranda sedang dimuat.",
    acceptType: "image",
    aspectRatio: "16:9",
    required: false,
  },
  {
    slotKey: "home.programs.bg",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Background Program",
    description: "Gambar latar belakang seksi program unggulan beranda.",
    acceptType: "image",
    aspectRatio: "16:9",
    required: false,
  },
  {
    slotKey: "home.programs.collage.1",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Kolase Program 1",
    description: "Foto kolase program unggulan pertama.",
    acceptType: "image",
    aspectRatio: "4:3",
    required: false,
  },
  {
    slotKey: "home.programs.collage.2",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Kolase Program 2",
    description: "Foto kolase program unggulan kedua.",
    acceptType: "image",
    aspectRatio: "4:3",
    required: false,
  },
  {
    slotKey: "home.programs.collage.3",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Kolase Program 3",
    description: "Foto kolase program unggulan ketiga.",
    acceptType: "image",
    aspectRatio: "4:3",
    required: false,
  },
  {
    slotKey: "home.programs.collage.4",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Kolase Program 4",
    description: "Foto kolase program unggulan keempat.",
    acceptType: "image",
    aspectRatio: "4:3",
    required: false,
  },
  {
    slotKey: "home.news.bg",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Background Berita",
    description: "Gambar latar belakang seksi berita dan artikel beranda.",
    acceptType: "image",
    aspectRatio: "16:9",
    required: false,
  },
  {
    slotKey: "home.cta.bg",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Background Ajakan Bergabung",
    description: "Gambar latar belakang seksi ajakan bergabung (CTA) beranda.",
    acceptType: "image",
    aspectRatio: "16:9",
    required: false,
  },
  {
    slotKey: "home.cta.image",
    group: "home",
    pageRoute: "/",
    pageLabel: "Beranda",
    label: "Gambar Ajakan Bergabung",
    description: "Gambar ilustrasi atau foto pendukung seksi ajakan bergabung.",
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
    label: "Hero Tentang",
    description: "Gambar latar belakang utama pada hero halaman tentang.",
    acceptType: "image",
    aspectRatio: "16:9",
    required: true,
  },
  {
    slotKey: "about.vision.bg",
    group: "about",
    pageRoute: "/tentang",
    pageLabel: "Tentang",
    label: "Background Visi Misi",
    description: "Gambar latar belakang seksi visi dan misi paguyuban.",
    acceptType: "image",
    aspectRatio: "16:9",
    required: false,
  },
  {
    slotKey: "about.intro.image",
    group: "about",
    pageRoute: "/tentang",
    pageLabel: "Tentang",
    label: "Gambar Pengantar",
    description: "Gambar profil atau dokumentasi seksi pengantar tentang PAMOKA.",
    acceptType: "image",
    aspectRatio: "4:3",
    required: false,
  },
  {
    slotKey: "about.vision.image",
    group: "about",
    pageRoute: "/tentang",
    pageLabel: "Tentang",
    label: "Gambar Visi",
    description: "Gambar dokumentasi pendukung seksi visi misi.",
    acceptType: "image",
    aspectRatio: "4:3",
    required: false,
  },
  {
    slotKey: "about.gallery.bg",
    group: "about",
    pageRoute: "/tentang",
    pageLabel: "Tentang",
    label: "Background Galeri",
    description: "Gambar latar belakang seksi galeri kilas balik tentang.",
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
    label: "Poster Jajaka Dewasa (JD)",
    description: "Poster sampul untuk kategori Jajaka Dewasa.",
    acceptType: "image",
    aspectRatio: "9:16",
    required: false,
  },
  {
    slotKey: "category.jd.video",
    group: "category",
    pageRoute: "/kategori",
    pageLabel: "Kategori",
    label: "Video Jajaka Dewasa (JD)",
    description: "Video cuplikan profil kategori Jajaka Dewasa.",
    acceptType: "video",
    aspectRatio: "9:16",
    required: false,
  },
  {
    slotKey: "category.md.poster",
    group: "category",
    pageRoute: "/kategori",
    pageLabel: "Kategori",
    label: "Poster Mojang Dewasa (MD)",
    description: "Poster sampul untuk kategori Mojang Dewasa.",
    acceptType: "image",
    aspectRatio: "9:16",
    required: false,
  },
  {
    slotKey: "category.md.video",
    group: "category",
    pageRoute: "/kategori",
    pageLabel: "Kategori",
    label: "Video Mojang Dewasa (MD)",
    description: "Video cuplikan profil kategori Mojang Dewasa.",
    acceptType: "video",
    aspectRatio: "9:16",
    required: false,
  },
  {
    slotKey: "category.jr.poster",
    group: "category",
    pageRoute: "/kategori",
    pageLabel: "Kategori",
    label: "Poster Jajaka Remaja (JR)",
    description: "Poster sampul untuk kategori Jajaka Remaja.",
    acceptType: "image",
    aspectRatio: "9:16",
    required: false,
  },
  {
    slotKey: "category.jr.video",
    group: "category",
    pageRoute: "/kategori",
    pageLabel: "Kategori",
    label: "Video Jajaka Remaja (JR)",
    description: "Video cuplikan profil kategori Jajaka Remaja.",
    acceptType: "video",
    aspectRatio: "9:16",
    required: false,
  },
  {
    slotKey: "category.mr.poster",
    group: "category",
    pageRoute: "/kategori",
    pageLabel: "Kategori",
    label: "Poster Mojang Remaja (MR)",
    description: "Poster sampul untuk kategori Mojang Remaja.",
    acceptType: "image",
    aspectRatio: "9:16",
    required: false,
  },
  {
    slotKey: "category.mr.video",
    group: "category",
    pageRoute: "/kategori",
    pageLabel: "Kategori",
    label: "Video Mojang Remaja (MR)",
    description: "Video cuplikan profil kategori Mojang Remaja.",
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
