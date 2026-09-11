# PAMOKA Garut Plans Programme

Dokumen ini adalah sumber otoritatif untuk status rencana kerja (plans), arsitektur, dan evolusi implementasi website resmi Paguyuban Mojang Jajaka Kabupaten Garut (PAMOKA Garut).

## Prinsip dan Aturan Eksekusi

1. **Baseline dan Drift Check**: Baseline acuan untuk perbandingan drift git adalah commit `3874ede` (Replace Prisma with Turso and Drizzle).
2. **Integritas Public Site**: Public site (`src/app/*` dan komponen publik) merupakan referensi visual dan saat ini masih bersumber dari hardcoded content. Publikasi data dinamis dari CMS ke public site baru dilakukan pada Plan 010 setelah otorisasi eksplisit dari operator.
3. **Pemisahan Boundary**: Public routes, import aset hardcoded, upload massal, migrasi remote database Turso, dan cutover public runtime tidak boleh disentuh tanpa otorisasi terpisah.
4. **Authoring Admin**: Form CMS dan antarmuka admin menggunakan komponen reusable (`src/components/admin/primitives.tsx`), radix primitives, Montserrat untuk heading, Inter untuk teks, palet warna brand (`dgb` dan `fb`), serta tanpa em dash atau en dash.
5. **Transaksionalitas & Audit**: Setiap operasi penulisan (write) pada CMS wajib melalui server action dengan validasi skema, otorisasi `requirePermission`, transaksi Drizzle, pencatatan `appendAuditLog`, dan `revalidatePath`.

---

## Daftar Rencana Kerja (Plans Registry)

| Plan | Judul Rencana | Dokumen / Referensi | Status | Keterangan |
|---|---|---|---|---|
| **001** | Replace PostgreSQL and Prisma with Turso and Drizzle | Git commit `3874ede` | **DONE** | Migrasi total ke LibSQL (Turso) dan Drizzle ORM dengan mode `timestamp_ms`. |
| **002** | Restore the verification baseline and upgrade to Next.js 16 | Package & Config | **DONE** | Penyesuaian verifikasi (`typecheck`, `lint`, `test:db`, `verify`) dan upgrade Next.js 16. |
| **003** | Add Google OAuth, access requests, and granular RBAC | `src/server/auth/*` | **DONE** | Better Auth Google login, approval alur permohonan akses, role dan izin granular. |
| **004** | Add annual CMS data models, revisions, and transactional audit logs | `src/server/db/schema.ts` | **DONE** | Skema edisi, entitas konten, riwayat revisi, dan tabel `auditLogs`. |
| **005** | Build the reusable admin shell, dashboard, users, profile, and audit UI | `src/app/admin/*` | **DONE** | Shell admin responsif, manajemen hak akses, profil pengguna, dan viewer audit log. |
| **006** | Add the media library with authenticated UploadThing uploads | `src/app/admin/media/*` | **DONE** | Pustaka media dengan sistem folder hierarkis dan upload terautentikasi UploadThing. |
| **007** | Move global, home, news, sponsor, and organization content into the CMS | `src/server/cms/*` | **DONE** | Fondasi model konten CMS disempurnakan dan distandarisasi di Plan 012. |
| **008** | Move editions, participants, events, carousels, and galleries into the CMS | `src/server/cms/*` | **DONE** | Pengelolaan entitas tahunan disempurnakan berbasis edisi tunggal di Plan 012. |
| **009** | Make voting campaigns, tallies, visibility, and results manageable | `src/app/admin/voting/*` | **DONE** | Pengelolaan kampanye voting, input manual harian QRIS merchant, dan validasi WIB. |
| **010** | Import 2025 content, run end-to-end QA, and perform a reversible cutover | `docs/runbooks/cms-cutover.md` | **IN PROGRESS (Not Authorized)** | Import massal dan cutover publik ditangguhkan hingga disetujui operator. |
| **011** | Unify public and admin design, media navigation, and annual CMS context | `src/components/admin/*` | **DONE** | Penyelarasan token visual admin dengan public design tokens (Montserrat, `dgb`, `fb`). |
| **012** | Admin CMS PAMOKA Berbasis Edisi | `plans/admin-page-overhaul.md` | **IN PROGRESS (Rework)** | Rework UX admin bertahap dengan checkpoint supervisor; fondasi visual dan navigasi sedang ditata ulang sebelum modul fungsional berikutnya. |
| **013** | Migrasi total Next.js ke Laravel + Inertia React | [`013-route-domain-inventory.md`](013-route-domain-inventory.md) dan `laravel/` | **IN PROGRESS (Stage 5)** | Fondasi Laravel, data inti MySQL, autentikasi admin, RBAC, approval akses, audit, dan konteks edisi aktif sudah tersedia sebagai sidecar; Next.js lama tetap tidak diubah sebagai sumber pembanding sampai setiap checkpoint lolos. |

---

## Rincian Ruang Lingkup Setiap Plan

### Plan 001: Replace PostgreSQL and Prisma with Turso and Drizzle
- **Tujuan**: Mengganti ketergantungan Prisma dan PostgreSQL dengan arsitektur database libSQL (Turso) dan Drizzle ORM yang ringan dan cepat di edge/serverless.
- **Deliverables**: Skema Drizzle (`src/server/db/schema.ts`), klien database (`src/server/db/client.ts`), query & mutation helpers, script seed (`npm run db:seed`), dan migrasi SQL `drizzle/0000_gorgeous_blue_marvel.sql`.
- **Status**: Selesai (Baseline commit `3874ede`).

### Plan 002: Restore the verification baseline and upgrade to Next.js 16
- **Tujuan**: Memastikan integritas tooling verifikasi lokal dan kompatibilitas dependensi framework modern (Next.js 16 App Router, React 19, Tailwind CSS v4).
- **Deliverables**: Script verifikasi `npm run verify` (`test:db`, `typecheck`, `lint`, `build`), konfigurasi TypeScript dan ESLint modern.
- **Status**: Selesai.

### Plan 003: Add Google OAuth, access requests, and granular RBAC
- **Tujuan**: Mengamankan area administratif dengan autentikasi Google OAuth via Better Auth, alur registrasi bertingkat, dan sistem hak akses berbasis permission (RBAC).
- **Deliverables**: Modul otentikasi (`src/server/auth/config.ts`), alur minta akses (`/admin/request-access`), boundary otorisasi `requirePermission`, dan runbook promosi super admin manual (`docs/runbooks/bootstrap-super-admin.md`).
- **Status**: Selesai.

### Plan 004: Add annual CMS data models, revisions, and transactional audit logs
- **Tujuan**: Menyediakan struktur data relasional untuk mengelola konten tahunan Pasanggiri Mojang Jajaka dan operasional Paguyuban.
- **Deliverables**: Tabel edisi, kategori, peserta, acara, galeri, berita, sponsor, struktur organisasi, revisi draf, dan log audit transaksional yang tidak dapat diubah (immutable).
- **Status**: Selesai.

### Plan 005: Build the reusable admin shell, dashboard, users, profile, and audit UI
- **Tujuan**: Menyediakan antarmuka dashboard admin yang konsisten dan modular.
- **Deliverables**: Komponen shell admin (`AdminShell`, `AdminPage`, `AdminCard`), halaman manajemen user (`/admin/users`), profil (`/admin/profile`), dan peninjau riwayat aktivitas (`/admin/audit`).
- **Status**: Selesai.

### Plan 006: Add the media library with authenticated UploadThing uploads
- **Tujuan**: Sentralisasi manajemen aset media dengan upload terverifikasi ke UploadThing dan penataan folder hierarkis.
- **Deliverables**: Halaman pustaka media (`/admin/media`), integrasi UploadThing (`src/app/api/uploadthing/*`), kebijakan kuota dan tipe file (`src/server/media/policy.ts`), serta model `mediaAssets` dan `mediaFolders`.
- **Status**: Selesai.

### Plan 007: Move global, home, news, sponsor, and organization content into the CMS
- **Tujuan**: Memungkinkan pengelolaan konten beranda, berita, sponsor, dan organisasi melalui CMS.
- **Status**: Selesai (Disempurnakan dan distandarisasi di Plan 012).

### Plan 008: Move editions, participants, events, carousels, and galleries into the CMS
- **Tujuan**: Memindahkan pengelolaan peserta MOKA, jadwal acara, galeri, dan karosel ke CMS.
- **Status**: Selesai (Disempurnakan berbasis edisi tunggal di Plan 012).

### Plan 009: Make voting campaigns, tallies, visibility, and results manageable
- **Tujuan**: Manajemen voting manual transparan berbasis edisi tahunan dan rekap harian QRIS merchant.
- **Status**: Selesai (Workspace voting aktif di `/admin/voting` dan terisolasi per edisi).

### Plan 010: Import 2025 content, run end-to-end QA, and perform a reversible cutover
- **Tujuan**: Migrasi data konten 2025 hardcoded ke CMS dan pengalihan sumber data public site secara aman dengan opsi rollback instan.
- **Status**: In Progress (Not Authorized). Ditangguhkan sampai operator memberikan izin eksplisit.

### Plan 011: Unify public and admin design, media navigation, and annual CMS context
- **Tujuan**: Penyelarasan estetika admin dengan public design tokens (Montserrat, `dgb`, `fb`, organic radius, background texture, vignette) dan isolasi konteks edisi.
- **Status**: Selesai.

### Plan 012: Admin CMS PAMOKA Berbasis Edisi
- **Dokumen Referensi**: [admin-page-overhaul.md](file:///workspaces/moka/plans/admin-page-overhaul.md)
- **Tujuan**: Transformasi total pengalaman pengguna admin CMS:
  1. Pengendalian konteks edisi tunggal di header (`AdminEditionSelector`) yang secara otomatis menyaring seluruh modul tahunan.
  2. Sidebar modular dengan grup `Konten` yang dapat di-collapse dan statusnya tersimpan.
  3. Reusable Media Picker (`AdminMediaPicker`) terintegrasi di seluruh form.
  4. Manajemen slot aset situs tetap (`/admin/content/site-assets`) tanpa pembuatan struktur sembarangan.
  5. Form sponsor full-width dengan editor modal `Sheet`.
  6. Editor berita WYSIWYG berbasis TipTap dengan live preview desktop dan mobile.
  7. Pemisahan arsitektur Kepengurusan Paguyuban (global, multi-periode) dan Panitia Pasanggiri (per edisi).
  8. Direktori profil orang terpadu yang dapat digunakan lintas periode dan edisi.
  9. Manajemen media peserta multi-role (`closeup`, `full_body`, `detail`, `karantina`, `other`) dan sinkronisasi QRIS voting.
  10. Dedicated gallery workspace dengan dukungan album standalone maupun album acara.
  11. Dashboard indikator kesiapan (readiness overview) edisi aktif.
- **Status**: IN PROGRESS (Rework supervisor-gated). Implementasi baseline tetap dipertahankan; checkpoint rework ditinjau bertahap sebelum modul berikutnya dikerjakan.

### Plan 013: Migrasi total Next.js ke Laravel + Inertia React
- **Tujuan**: Memindahkan aplikasi PAMOKA Garut ke Laravel dengan Inertia React melalui migration slice yang dapat diuji dan dibandingkan sebelum cutover.
- **Boundary**: Direktori `laravel/` berjalan berdampingan dengan aplikasi Next.js pada root. Tidak ada penghapusan source lama, perubahan public route lama, migrasi database operator, atau cutover publik pada tahap ini.
- **Stack target**: Laravel 13, Inertia Laravel, React, Vite, TypeScript, dan MySQL.
- **Stage 1**: Fondasi aplikasi, root template Inertia, middleware, route home, entry React, serta feature test untuk kontrak halaman awal.
- **Gate Stage 1**: `php artisan test`, `npm run typecheck`, `npm run build`, route inspection, dan pemeriksaan HTTP lokal harus lulus sebelum migration slice berikutnya dimulai.
- **Stage 2**: Inventaris 47 route page, 4 layout, 2 route handler API, 48 tabel, domain boundary, sumber kebenaran, urutan slice, dan stop conditions. Detail ada di [`013-route-domain-inventory.md`](013-route-domain-inventory.md).
- **Gate Stage 2**: inventory dapat ditelusuri ke source route, schema, public readers, auth, media, dan legacy operations; tidak ada source Next.js atau database operator yang diubah.
- **Stage 3**: Shell publik Inertia React, token brand target, navigasi desktop dan responsif, footer, home foundation, 9 route publik dinamis, placeholder contract, dan halaman 404 branded.
- **Gate Stage 3**: 5 feature tests, 164 assertions, TypeScript, Vite production build, route list 10 route, HTTP smoke untuk 10 route, Inertia JSON response, 404 response, dan pemeriksaan visual desktop serta viewport sempit lulus.
- **Stage 4**: Fondasi data inti MySQL untuk periode kepengurusan, edisi, kategori, tahap seleksi, dan peserta. Model Laravel memakai UUID, relasi Eloquent, enum kode kategori tetap `JD`, `MD`, `JR`, `MR`, migration factory, dan database test terpisah.
- **Gate Stage 4**: 7 feature tests, 172 assertions, Pint, TypeScript, Vite production build, migration lokal ke database `pamoka`, serta pemeriksaan foreign key dan unique key pada tabel peserta lulus. Tidak ada migration operator atau cutover publik.
- **Stage 5**: Session auth Laravel dengan adapter Google OAuth tanpa menyimpan kredensial di repository, akun baru berstatus `pending`, request access, role dan permission, override deny atau allow, audit log immutable, approval Role Administrator tanpa assignment `super_admin`, halaman auth admin, dan selector konteks edisi aktif.
- **Gate Stage 5 foundation**: 20 feature tests, 263 assertions, Pint, TypeScript, Vite production build, migration dan seed lokal yang menghasilkan 23 permission serta 7 role tanpa user super-admin otomatis, HTTP smoke untuk login dan redirect guest, serta QA visual desktop dan viewport sempit pada login lulus. Handshake OAuth Google nyata belum dijalankan karena memerlukan kredensial operator.
- **Tahap berikutnya**: public core berbasis data, dimulai dari home dan tentang, dengan parity visual, metadata, status response, serta fallback yang diuji.
- **Status**: IN PROGRESS. Stage 5 foundation selesai; admin CMS penuh, OAuth nyata, dan runtime publik belum menjadi target aktif.

---

## Rangkuman Checkpoint Plan 012

- **Checkpoint 0**: Pulihkan baseline plan dan kunci ruang lingkup. **(DONE)**
- **Checkpoint 1**: Selector edisi dan sidebar collapsible. **(ACCEPTED)**
- **Checkpoint 1b**: Pemulihan baseline runtime dan kontrak konstanta server. **(ACCEPTED)**
- **Checkpoint 2A**: Query media berscope edisi, pagination, dan identitas callback upload. **(ACCEPTED)**
- **Checkpoint 2B.1**: Policy uploader bersama, cap MIME dan ukuran, serta identity callback. **(ACCEPTED)**
- **Checkpoint 2B.2A**: Integrasi uploader bersama ke picker dan trigger media native. **(ACCEPTED)**
- **Checkpoint 2B.2B**: Ikon admin semantik dan deskripsi UI ringkas. **(ACCEPTED)**
- **Checkpoint 2B.3**: Pagination picker, reset sesi, guard respons stale, cache pilihan, dan cakupan folder edisi. **(ACCEPTED, QA dataset nonempty dan 380px OPEN)**
- **Checkpoint 2B.4**: Sisa library, multi-selection, upload selection, ordered cache, gallery batch picker dengan duplicate filtering, dan responsive source implementation. **(SOURCE ACCEPTED, bukan penerimaan visual; browser dataset nonempty, runtime upload, true FormData, dan QA 380px OPEN)**
- **Checkpoint 1C.1**: Scrollbar admin scoped dan kontrol shell berbasis primitive shadcn. **(ACCEPTED, QA 380px OPEN)**
- **Checkpoint 1C.2**: Migrasi `AdminSelect` ke Select Radix dan seluruh caller. **(ACCEPTED, QA 380px, true FormData, dan runtime required-error flow OPEN)**
- **Checkpoint 1C.3A**: Migrasi select, input, textarea, dan tombol aksi yang masih raw ke primitive shadcn/Admin wrapper. **(ACCEPTED, raw button 0, native select 0, visible raw input 0)**
- **Checkpoint 1C.3B**: Migrasi checkbox dan radio admin. **(ACCEPTED, 7 checkbox native dimigrasikan; 11 hidden dan 2 file tetap sebagai exception terencana)**
- **Checkpoint 1C.4**: Audit scrollbar admin selain shell. **(ACCEPTED, runtime visual dan QA 380px OPEN)**
- **Checkpoint 3**: Identitas edisi dan aset situs tetap. **(SOURCE DAN DESKTOP ACCEPTED, QA 380px OPEN)**
- **Checkpoint 4**: Sponsor. **(SOURCE DAN DESKTOP ACCEPTED, QA DATASET NONEMPTY DAN 380px OPEN)**
- **Checkpoint 5**: Berita WYSIWYG dan live preview. **(SOURCE DAN DESKTOP ACCEPTED, AUTOSAVE DATASET NONEMPTY DAN QA VIEWPORT 380px OPEN)**
- **Checkpoint 6**: Kepengurusan global dan direktori profil. **(SOURCE DAN DESKTOP ACCEPTED, QA DETAIL DATASET NONEMPTY DAN 380px OPEN)**
- **Checkpoint 7**: Panitia per edisi. **(SOURCE ACCEPTED, RUNTIME VISUAL DAN QA 380px OPEN)**
- **Checkpoint 8A**: Fondasi alur seleksi dinamis. **(SOURCE ACCEPTED, MIGRATION TARGET BELUM DITERAPKAN)**
- **Checkpoint 8B**: Pendaftar manual, pengaturan stage, dan workspace seleksi. **(SOURCE ACCEPTED, RUNTIME VISUAL 380px OPEN)**
- **Checkpoint 8C**: Profil peserta, media, QRIS, dan gelar. **(SOURCE ACCEPTED, RUNTIME VISUAL 380px OPEN)**
- **Checkpoint 9**: Acara dan dedicated gallery workspace. **(SOURCE ACCEPTED, RUNTIME VISUAL 380px OPEN)**
- **Checkpoint 10**: Voting dan dashboard edition-scoped. **(SOURCE ACCEPTED, RUNTIME VISUAL 380px OPEN)**
- **Checkpoint 11**: Cleanup, dokumentasi, dan final verification. **(SOURCE ACCEPTED, RUNTIME QA OPEN)**
- Keputusan CP2B.3: picker memakai cakupan edisi aktif sebagai default bila folder tersedia; folder upload tetap mengikuti pilihan pengguna dan tidak dibuat atau dipilih otomatis.
- Keputusan CP1C: scrollbar kustom hanya scoped pada shell admin; voting tersedia untuk setiap edisi dengan data tetap terisolasi.
- Keputusan CP1C.2: kontrol `AdminSelect` memakai wrapper Select Radix lokal dengan satu bridge form yang validatable; nilai kosong tetap `""` dan sentinel internal tidak masuk FormData.
- Keputusan CP1C.3B: Checkbox lokal berbasis Radix mempertahankan checked state, label, disabled state, dan semantics FormData melalui name/value pada BubbleInput; 7 checkbox native admin sudah dimigrasikan. Sisa 11 hidden input dan 2 file input tetap diizinkan. QA 380px, runtime visual, true FormData, dan runtime required-error flow tetap OPEN/PENDING.
- Keputusan CP1C.4: Scrollbar native pada shell content dan container admin eksplisit memakai helper `adminNativeScrollbarClassName`; sidebar tetap memakai `AdminScrollArea` dark. Runtime visual dan QA 380px tetap OPEN/PENDING.
- Keputusan CP3: identitas edisi memakai form logo dan slogan yang ringkas, indikator kelengkapan 3 bagian, dialog program unggulan, serta pengurutan yang aman. Aset situs memakai 24 slot manifest tetap yang dikelompokkan dalam accordion per halaman; key internal tidak ditampilkan dan public route tetap tidak berubah. Typecheck, lint tanpa error, 8 focused tests, dan QA desktop diterima. QA 380px masih OPEN karena browser responsif tidak memiliki sesi admin.
- Keputusan alur Pasanggiri: pendaftar dimasukkan admin secara manual dari Google Form. Stage dibuat dinamis per edisi, linear, dan memakai target jumlah total lintas kategori. Sistem hanya mencatat keputusan lolos atau tidak lolos. Tahap final dipilih admin, gelar dibuat per edisi dengan capacity, dan satu peserta dapat menerima beberapa gelar. QRIS hanya berupa gambar eksternal yang diunggah atau dibind. Kampanye voting memilih stage, membuat snapshot peserta saat dimulai, lalu dimulai dan ditutup manual.
- Keputusan CP4: sponsor memakai daftar full-width, filter shadcn, Sheet ringkas, media picker gambar, dan pratinjau tanpa simbol dekoratif. Sponsor baru selalu disimpan nonaktif. Aktivasi memerlukan `content.publish`, sedangkan editor tetap dapat menonaktifkan sponsor. Typecheck, lint tanpa error, 5 focused tests, dan QA desktop dataset kosong diterima. QA daftar berisi data dan 380px tetap OPEN.
- Keputusan CP5: berita memakai editor TipTap dengan heading 2 dan 3, pemformatan dasar, gambar dari pustaka media, autosave version-safe, revisi, serta pratinjau desktop dan 380 px. Gambar isi dan sampul divalidasi sebagai aset gambar siap pakai pada transaksi simpan dan terbit. Typecheck, lint tanpa error, 6 focused tests, dan QA visual desktop diterima. Autosave pada artikel nyata, dataset berisi data, upload, dan viewport admin 380 px tetap OPEN.
- Keputusan CP6: kepengurusan tetap global dengan periode, direktori orang reusable, tree maksimal 4 tingkat, misi terurut, dan penugasan berurutan. Detail periode dapat menghubungkan beberapa edisi tanpa perubahan skema. Pemindahan edisi dari periode lain memerlukan konfirmasi eksplisit yang divalidasi ulang dalam transaksi dan dicatat pada audit log. Typecheck, lint file CP6 tanpa temuan, 8 focused tests, serta QA desktop halaman daftar dan form periode diterima. QA detail dengan dataset berisi data dan viewport 380 px tetap OPEN.
- Keputusan CP7: panitia tetap terisolasi oleh selector edisi. Action tree menolak ID ganda, ID hilang, urutan negatif, serta pengurutan lintas induk. Penghapusan penugasan memakai versi optimistik dan seluruh write tetap memakai transaksi serta audit. Workspace memakai tabel shadcn, kontrol keyboard, aksi tree responsif, istilah Indonesia, dan profil reusable yang dapat dibuat inline. Typecheck, lint file CP7 tanpa temuan, dan 4 focused tests lulus. Runtime visual dan QA 380 px tetap OPEN karena sesi browser QA tidak terautentikasi.
- Keputusan CP8A: skema seleksi dinamis bersifat additive dan mempertahankan `participants.stage`, `paymentUrl`, serta seluruh public reader lama. Tahap aktif peserta dan tahap kelayakan kampanye memakai relasi restrict sehingga tahap yang masih digunakan tidak dapat dihapus. Entry tahap lama dan referensi sumber snapshot dibersihkan atau dilepas hanya setelah keterkaitan aktif dilepas. Backfill idempotent membuat tahap per pasangan edisi dan nilai tahap lama, menandai entry `pending` dengan catatan perlu ditinjau, mempertahankan field kompatibilitas, serta menulis audit. Migrasi `0013_married_bloodscream.sql`, `db:check`, typecheck, dan 8 focused tests lulus. Migrasi dan backfill belum diterapkan ke database operator mana pun.
- Keputusan CP9: acara dan album dikelola pada halaman terpisah berbasis edisi. Album umum tidak memerlukan acara, sedangkan album acara memvalidasi owner pada edisi aktif. Item foto dan YouTube ditambahkan ke album yang sedang dibuka, mutation diserialisasi per album, dan constraint `gallery_item_exactly_one_source` menjaga satu sumber per item. `db:check`, typecheck, lint file CP9 tanpa error, dan 6 focused tests lulus. Migrasi `0014_burly_sprite.sql` belum diterapkan dan runtime visual 380 px tetap OPEN.
- Keputusan CP8B: operasi pendaftar, tahap linear, keputusan massal, rollback, close, reopen, dan delete memakai transaksi, audit, versi optimistik, serta isolasi edisi aktif. Empat route admin menyediakan input manual, daftar tahap, keputusan massal, konfirmasi kuota, dan filter tahap dinamis. Reopen membatalkan promosi hanya saat seluruh entry tahap berikutnya masih pending dan belum dipakai voting atau gelar. Action peserta lama dikunci ke konteks edisi, current optimistic version, dan hard delete hanya untuk pendaftar yang belum diproses. Sebelas focused tests, typecheck, lint file UI, dan scan aturan desain lulus. Runtime visual desktop dan 380 px masih OPEN karena sesi admin tidak terautentikasi.
- Keputusan CP8C: detail peserta dikunci ke edisi aktif, current stage hanya-baca, media peserta menerima gambar ready dengan satu closeup aktif, dan QRIS hanya memakai gambar eksternal dari pustaka media. Daftar peserta memiliki filter foto, gelar, dan QRIS. Gelar per edisi memakai capacity, versi optimistik, transaksi, audit, serta hanya dapat diberikan kepada peserta yang berada pada tahap final. Satu peserta dapat menerima beberapa gelar. Empat belas focused tests, typecheck, lint file perubahan, dan scan aturan desain lulus. Runtime visual desktop dan 380 px masih OPEN.
- Keputusan CP10: kampanye voting memakai tahap sumber dinamis dari edisi aktif dan membuat snapshot peserta saat dimulai manual. Tally hanya menerima peserta snapshot dengan gambar QRIS siap pakai, tanggal WIB yang sah, versi optimistik, transaksi, dan audit. Dashboard memakai 10 indikator kesiapan edisi serta informasi periode kepengurusan global. Lima focused tests, typecheck, dan lint file CP10 lulus. Runtime visual, true FormData, dataset browser nonempty, dan viewport 380 px masih OPEN.
- Keputusan CP11: rute Pages dan People dipertahankan sebagai redirect kompatibilitas, overview Konten menjadi daftar ringkas, dan lima implementasi legacy tanpa caller dihapus. Runbook mencatat pemilihan edisi dan pemetaan field lama tanpa penghapusan data. `db:check`, 72 tests, typecheck, lint tanpa error baru, build 36 halaman, scan aturan desain, dan `git diff --check` lulus. Runtime QA terautentikasi tetap OPEN.
