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
| **012** | Admin CMS PAMOKA Berbasis Edisi | `plans/admin-page-overhaul.md` | **DONE** | Overhaul menyeluruh UX admin: selector edisi header, sidebar collapsible, media picker reusable, TipTap WYSIWYG, kepengurusan/panitia terstruktur, dan dedicated gallery. |

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
- **Status**: Selesai (Seluruh 12 Checkpoint 0 sampai 11 telah diimplementasikan dan diverifikasi).

---

## Rangkuman Checkpoint Plan 012

- **Checkpoint 0**: Pulihkan baseline plan dan kunci ruang lingkup. **(DONE)**
- **Checkpoint 1**: Selector edisi dan sidebar collapsible. **(DONE)**
- **Checkpoint 2**: Media picker dan folder edisi. **(DONE)**
- **Checkpoint 3**: Identitas edisi dan aset situs tetap. **(DONE)**
- **Checkpoint 4**: Sponsor. **(DONE)**
- **Checkpoint 5**: Berita WYSIWYG dan live preview. **(DONE)**
- **Checkpoint 6**: Kepengurusan global dan direktori profil. **(DONE)**
- **Checkpoint 7**: Panitia per edisi. **(DONE)**
- **Checkpoint 8**: Mojang Jajaka. **(DONE)**
- **Checkpoint 9**: Acara dan dedicated gallery workspace. **(DONE)**
- **Checkpoint 10**: Voting dan dashboard edition-scoped. **(DONE)**
- **Checkpoint 11**: Cleanup, dokumentasi, dan final verification. **(DONE)**
