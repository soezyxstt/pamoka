# Plan 013, Stage 2: Inventaris Route dan Domain

## Tujuan

Stage ini mengunci peta aplikasi sebelum fitur dipindahkan ke Laravel. Peta ini menjadi acuan untuk memilih migration slice, menentukan sumber data yang harus dipertahankan, dan menyusun parity checkpoint yang dapat diuji satu per satu.

Stage ini bersifat dokumentasi dan audit read-only. Tidak ada penghapusan source Next.js, perubahan route publik lama, migrasi database operator, atau cutover.

## Temuan utama

- Terdapat 47 file `page.tsx` di bawah `src/app`.
- Terdapat 33 route admin, 10 route publik pada source utama, 1 route operasional monitor, dan 3 route internal atau legacy.
- Terdapat 4 layout Next.js.
- Terdapat 2 route handler API; satu untuk Better Auth dan satu untuk boundary upload R2.
- Skema Drizzle memiliki 48 tabel SQLite yang terbagi ke domain auth, CMS, organisasi, seleksi, galeri, voting, dan kompatibilitas legacy.
- Public runtime masih dominan memakai data hardcoded dari `src/lib`. CMS readers sudah tersedia, tetapi public cutover belum diizinkan.
- `/monitor` masih membaca tabel legacy `Semifinalist`, `Finalist`, dan `IncomePerDate`.

## Inventaris route

### Route publik, 10 halaman

| Route | Domain | Sumber perilaku saat ini |
|---|---|---|
| `/` | Beranda | `src/app/page.tsx`, `src/lib/data.ts`, `src/lib/news.ts`, aset publik |
| `/tentang` | Profil organisasi | `src/app/tentang/page.tsx`, data organisasi hardcoded |
| `/rangkaian-kegiatan/[event]` | Acara | `src/app/rangkaian-kegiatan/[event]/page.tsx`, `src/lib/data.ts` |
| `/profil-finalis/[category]` | Daftar finalis | `src/app/profil-finalis/[category]/page.tsx`, `src/lib/data.ts` |
| `/profil-finalis/[category]/[name]` | Detail finalis | `src/app/profil-finalis/[category]/[name]/page.tsx`, `src/lib/data.ts` |
| `/profil-semifinalis/[category]` | Daftar semifinalis | `src/app/profil-semifinalis/[category]/page.tsx`, `src/lib/data.ts` |
| `/profil-semifinalis/[category]/[name]` | Detail semifinalis | `src/app/profil-semifinalis/[category]/[name]/page.tsx`, `src/lib/data.ts` |
| `/voting/[category]` | Daftar kandidat voting | `src/app/voting/[category]/page.tsx`, `src/lib/data.ts` |
| `/voting/[category]/[name]` | Detail kandidat voting | `src/app/voting/[category]/[name]/page.tsx`, `src/lib/data.ts` |
| `/voting/hasil/[category]` | Hasil voting | `src/app/voting/hasil/[category]/page.tsx`, data voting dan hasil |

### Route admin, 33 halaman

| Area | Route |
|---|---|
| Dashboard dan akses | `/admin`, `/admin/login`, `/admin/request-access`, `/admin/profile`, `/admin/users`, `/admin/audit` |
| Konten umum | `/admin/content`, `/admin/content/pages`, `/admin/content/edition-settings`, `/admin/content/site-assets`, `/admin/content/sponsors`, `/admin/content/news`, `/admin/content/news/new`, `/admin/content/news/{id}` |
| Edisi dan organisasi | `/admin/content/editions`, `/admin/organization`, `/admin/organization/periods/{id}`, `/admin/content/people`, `/admin/content/committee` |
| Peserta dan seleksi | `/admin/content/participants`, `/admin/content/participants/new`, `/admin/content/participants/{id}`, `/admin/content/participants/stages`, `/admin/content/participants/stages/{id}`, `/admin/content/participants/titles` |
| Acara dan galeri | `/admin/content/events`, `/admin/content/events/new`, `/admin/content/events/{id}`, `/admin/content/galleries`, `/admin/content/galleries/new`, `/admin/content/galleries/{id}` |
| Media dan voting | `/admin/media`, `/admin/voting` |

### Route operasional dan legacy

| Kelompok | Route | Keputusan migrasi |
|---|---|---|
| Monitor | `/monitor` | Dipindahkan setelah auth, permission, dan tabel legacy sudah memiliki pengganti yang teruji. |
| Internal atau legacy | `/z_contact___`, `/z_pasanggiri__`, `/z_pasanggiri__/voting/{name}` | Sudah memiliki compatibility page di Laravel dengan path yang sama. Route Next.js lama tetap dipertahankan sebagai pembanding dan tidak diberi redirect otomatis. |

Route detail berita `/berita/{slug}` merupakan route target Laravel yang melengkapi public reader CMS. Route ini tidak memiliki file page pada source Next.js saat inventory dibuat, sehingga tidak dihitung sebagai route source utama.

### Layout dan API

Layout yang harus dipetakan ke layout Inertia:

- root `src/app/layout.tsx`
- admin `src/app/admin/layout.tsx`
- detail acara `src/app/rangkaian-kegiatan/[event]/layout.tsx`
- hasil voting `src/app/voting/hasil/[category]/layout.tsx`

Endpoint yang perlu memiliki keputusan pengganti:

- `src/app/api/auth/[...all]/route.ts` untuk Better Auth dan Google OAuth
- `src/app/api/media/upload/route.ts` untuk prepare dan complete upload media R2

## Peta domain

### Edisi dan identitas tahunan

Edisi adalah konteks tahunan untuk Pasanggiri, konten, peserta, acara, galeri, panitia, dan voting. Kategori `JD`, `MD`, `JR`, dan `MR` berada dalam konteks edisi. `organizationPeriod` tetap berbeda karena mewakili periode kepengurusan paguyuban yang dapat mencakup beberapa edisi.

Tabel yang terkait: `edition`, `editionProgram`, `category`, `organizationPeriod`.

### Peserta dan seleksi

Peserta adalah pendaftar pada satu edisi dan kategori. Peserta bergerak melalui tahap seleksi yang terurut. Keputusan tiap tahap harus dapat dibedakan antara pending, advanced, dan eliminated. Gelar, prestasi, sosial, media, dan QRIS merupakan data tambahan peserta dalam konteks edisi.

Tabel yang terkait: `selectionStage`, `participant`, `participantStageEntry`, `editionTitle`, `participantTitleAssignment`, `participantAchievement`, `participantSocialLink`, `participantMedia`.

### Konten publik, media, acara, dan galeri

Konten publik mencakup halaman, berita, sponsor, aset tetap, program acara, dan album. Media memiliki metadata, owner, folder hierarkis, lifecycle, dan policy upload. Item galeri memiliki tepat satu sumber, yaitu media atau video YouTube.

Tabel yang terkait: `pageSection`, `contentDraft`, `contentRevision`, `newsArticle`, `sponsor`, `mediaFolder`, `mediaAsset`, `event`, `gallery`, `galleryItem`, `siteAssetBinding`.

### Organisasi dan panitia

Organisasi paguyuban memakai periode global, direktori orang reusable, unit hierarkis, membership, dan assignment. Panitia pelaksana terisolasi per edisi melalui `committeeUnit` dan `committeeAssignment`.

Tabel yang terkait: `person`, `personSocialLink`, `organizationUnit`, `organizationMembership`, `organizationAssignment`, `committeeUnit`, `committeeAssignment`.

### Voting dan monitoring

Kampanye voting dimiliki satu edisi, memilih tahap kelayakan, membuat snapshot peserta saat dimulai, lalu menerima tally harian per peserta dan tanggal lokal. Hasil memiliki visibility tersendiri. Monitor saat ini adalah alur operasional yang masih bergantung pada tabel legacy.

Tabel yang terkait: `votingCampaign`, `votingCampaignParticipant`, `voteDailyTally`, `Semifinalist`, `Finalist`, `IncomePerDate`.

### Identitas, akses, dan audit

Area admin membutuhkan identitas pengguna, session, account OAuth, permintaan akses, role, permission, override permission, dan audit log immutable. Setiap write pada target harus mempertahankan boundary permission dan audit yang sudah menjadi kontrak aplikasi lama.

Tabel yang terkait: `user`, `session`, `account`, `verification`, `adminProfile`, `role`, `permission`, `rolePermission`, `userRole`, `userPermissionOverride`, `accessRequest`, `auditLog`.

## Sumber kebenaran dan risiko transisi

| Area | Sumber kebenaran saat ini | Risiko |
|---|---|---|
| Public UI | `src/app`, `src/components/custom`, aset publik, dan data hardcoded | Visual atau copy dapat berubah jika target langsung mengambil data CMS yang belum ekuivalen. |
| Public CMS model | `src/server/cms/public-readers.ts` dan `site-asset-manifest.ts` | Model sudah tersedia, tetapi belum menjadi sumber utama seluruh public route. |
| Admin CMS | `src/server/db/schema.ts`, `src/server/cms`, `src/server/auth`, dan route admin | Kontrak permission, audit, lifecycle, serta scope edisi harus dipertahankan. |
| Peserta legacy | `src/lib/data.ts` dan tabel legacy | Data lama tidak boleh hilang sebelum read model baru terbukti setara. |
| Monitoring | `getFinalistsWithIncome` dan tabel income legacy | Tidak dapat dipindahkan hanya dengan menyalin halaman karena perhitungan dan access boundary harus ikut diuji. |
| Auth dan upload | Better Auth, Google OAuth, R2 | Perubahan provider atau session tanpa parity checkpoint dapat memutus akses admin dan aset. |

## Urutan migration slice

Setiap tahap menghasilkan commit terpisah dan harus lulus gate sebelum tahap berikutnya dimulai.

| Stage | Fokus | Hasil minimum |
|---|---|---|
| 1 | Fondasi Laravel dan Inertia | Root template, route home, React entry, test, typecheck, build, dan HTTP smoke. Selesai. |
| 2 | Inventaris route dan domain | Dokumen ini, glossary, status plan, dan batas migration slice. Selesai. |
| 3 | Shell visual publik | Layout root, navigasi, footer, typography, token brand, asset pipeline, 404, dan route contract tanpa mengubah Next.js. |
| 4 | Model MySQL dan data foundation | Migration Laravel, model, enum atau value object yang diperlukan, factory atau fixture minimal, serta mapping dari 48 tabel lama. Tidak menerapkan ke database operator. |
| 5 | Auth, permission, audit, dan admin shell | Session Laravel, Google OAuth atau adapter yang disepakati, request access, role, permission, audit, layout admin, dan redirect boundary. |
| 6 | Public core | Home, tentang, dan konten dasar dengan parity visual, metadata, status response, serta fallback yang disepakati. |
| 7 | Edisi, kategori, peserta, dan profil | Daftar dan detail finalis atau semifinalis, category validation, media peserta, gelar, serta read model publik. |
| 8 | Acara, galeri, berita, sponsor, dan organisasi | Route acara, album, news, sponsor, organisasi, dan konten periodik dengan scope edisi atau periode yang benar. |
| 9 | Voting dan monitor | Kampanye, eligibility, snapshot, tally harian, visibility hasil, dan monitor operasional dengan permission teruji. |
| 10 | Admin authoring lengkap | Media library, page sections, revisions, upload policy, workflow publish, peserta dan stage management, serta committee workspace. |
| 11 | Rehearsal migrasi data dan parity menyeluruh | Import fixture atau data yang diotorisasi, perbandingan route, validasi redirect, error flow, permission, dan rollback drill. |
| 12 | Cutover terkontrol | Hanya setelah otorisasi eksplisit, checklist go or no-go lulus, backup tersedia, dan jalur rollback diuji. |

## Kontrak parity per slice

Sebuah slice dianggap selesai hanya jika seluruh pemeriksaan yang relevan lulus:

1. Route memiliki status HTTP, redirect, dan boundary autentikasi yang benar.
2. Halaman Inertia mengirim component name dan props yang terdokumentasi.
3. Copy, label kategori, metadata, dan format tanggal mempertahankan perilaku yang disepakati.
4. Data kosong, data tidak ditemukan, validation error, dan unauthorized error memiliki hasil yang dapat diuji.
5. Write memiliki validasi server, permission, transaksi, audit, dan test regresi.
6. TypeScript, PHP test, formatter, dan production build lulus sesuai permukaan yang berubah.
7. UI diuji pada desktop dan viewport 380 px bila slice menyentuh tampilan.
8. Tidak ada perubahan pada route Next.js atau public runtime lama kecuali operator memberikan otorisasi terpisah.

## Stop conditions

Pekerjaan harus berhenti pada slice berjalan jika:

- sumber data lama dan target belum dapat dipetakan tanpa asumsi yang mengubah makna data;
- auth, permission, audit, atau upload boundary belum memiliki pengganti yang dapat diuji;
- migration mengharuskan pengubahan database operator tanpa otorisasi eksplisit;
- parity visual atau perilaku belum dapat dibuktikan untuk route yang sedang dipindahkan;
- perubahan target mulai membutuhkan penghapusan atau modifikasi source Next.js;
- ditemukan konflik antara model legacy dan model CMS yang belum memiliki keputusan domain.

## Rekonsiliasi route Stage 10F

Stage 10F menutup tiga route internal atau legacy pada target Laravel tanpa mengubah source Next.js. `/z_contact___` memakai halaman kontak Inertia dengan FAQ dan kanal resmi, `/z_pasanggiri__` membaca finalis dan sponsor dari read model Laravel, sedangkan `/z_pasanggiri__/voting/{name}` mempertahankan halaman spotlight untuk slug lama dan menghubungkan kandidat yang sudah dikenal ke route voting kanonik. Slug yang belum ditemukan tetap menghasilkan halaman 200 dengan fallback aman, sesuai perilaku source lama.

Gate route ini adalah test HTTP atau Inertia untuk ketiga path, rehearsal lokal dengan 44 finalis dan 68 sponsor, TypeScript, Vite production build, Pint, serta pemeriksaan diff. Tidak ada redirect otomatis ke route baru karena bentuk parameter route lama tidak selalu memiliki padanan semantik yang aman.

## Status Stage 2

Stage 2 selesai pada level inventory dan siap menjadi baseline Stage 3. Implementasi fitur belum dimulai. Next.js tetap menjadi sumber pembanding, Laravel tetap berjalan sebagai sidecar, dan belum ada cutover publik.
