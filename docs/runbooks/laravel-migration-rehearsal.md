# Runbook Rehearsal Migrasi Laravel 2025

Runbook ini menjalankan rehearsal snapshot publik pada database MySQL test terisolasi. Rehearsal tidak menulis ke database operator `pamoka`, tidak mengubah source Next.js, dan tidak melakukan public cutover.

## Prasyarat

- Jalankan MySQL test lokal pada `127.0.0.1:3306`.
- Siapkan database kosong bernama `pamoka_test`.
- Pastikan `laravel/.env` menunjuk ke database tersebut.
- Pastikan migrasi Laravel sudah tersedia.

## Dry run

```powershell
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '3306'
$env:DB_DATABASE = 'pamoka_test'
& 'D:\Tools\php-8.5.10\php.exe' artisan moka:rehearse-2025
```

Dry run harus menampilkan `Rehearsal lengkap 2025 lulus.` dan tidak membuat record database.

## Apply ke database test

Untuk mengulang rehearsal dari keadaan kosong, jalankan perintah berikut hanya setelah memastikan targetnya adalah `pamoka_test`.

```powershell
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '3306'
$env:DB_DATABASE = 'pamoka_test'
& 'D:\Tools\php-8.5.10\php.exe' artisan migrate:fresh --seed
& 'D:\Tools\php-8.5.10\php.exe' artisan moka:rehearse-2025 --apply
```

Command `--apply` memvalidasi semua fixture terlebih dahulu, kemudian menjalankan import identitas edisi, program unggulan, peserta, berita, media publik, organisasi, voting, dan page section dalam satu transaksi. Jika salah satu import gagal, perubahan rehearsal dibatalkan.

Hasil minimum yang diharapkan:

- 1 edisi aktif 2025 dengan slogan `Nu Nyunda Tur Nyakola` dan 6 program unggulan.
- 4 kategori, 2 tahap seleksi, dan 60 peserta.
- 3 artikel, 6 acara, 7 album, 69 item album, dan 68 sponsor.
- 19 profil organisasi, 21 penugasan organisasi.
- 1 page section publik `tentang.misi`.
- 1 campaign, 44 peserta snapshot, dan 572 baris tally.

Jalankan `moka:rehearse-2025 --apply` untuk kedua kalinya. Jumlah record harus tetap sama.

## Gate setelah rehearsal

```powershell
& 'D:\Tools\php-8.5.10\php.exe' artisan test tests/Feature/Full2025RehearsalTest.php
```

Test memeriksa dry run, target database, idempotensi, dan route publik utama setelah snapshot diterapkan.

## Preview deploy Vercel Hobby

Untuk deployment portfolio, buat project Vercel dengan `laravel/` sebagai Root Directory. Vercel akan memakai `Dockerfile.vercel` dan container FrankenPHP pada port 80. Jangan menambahkan `.env.prod` ke repository atau ke build context.

Set environment variables melalui dashboard Vercel, minimal:

- `APP_ENV=production`, `APP_DEBUG=false`, `APP_KEY`, `APP_URL`, `LOG_CHANNEL=stderr`, dan `VIEW_COMPILED_PATH=/tmp/views`.
- `DB_CONNECTION=mysql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, dan `MYSQL_ATTR_SSL_CA` bila CA Aiven diperlukan.
- `SESSION_DRIVER=database`, `CACHE_STORE=database`, dan `QUEUE_CONNECTION=sync`.
- `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`, dan `R2_REGION=auto`.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, dan `GOOGLE_REDIRECT_URI` jika login Google ingin diuji.

Database Aiven harus dapat diakses melalui TLS dari internet, bukan `127.0.0.1`. Upload media tetap melewati alur prepare, direct PUT ke R2, lalu complete, sehingga file besar tidak dikirim melalui request Laravel. Preview Vercel tidak melakukan migrasi atau import otomatis.

Verifikasi lokal sebelum membuat deployment:

```powershell
composer validate
& 'D:\Tools\php-8.5.10\php.exe' artisan test --compact
npm.cmd run typecheck
npm.cmd run build
```

Build image dan preview Vercel masih merupakan gate terpisah. Jangan menghubungkan domain utama, menjalankan import ke `pamoka`, atau melakukan cutover publik sebagai bagian dari rehearsal ini.

## Batas otorisasi

- Jangan menjalankan `--apply` pada database `pamoka` sebelum ada otorisasi operator untuk import data.
- Jangan mengaktifkan public cutover sebelum checklist Plan 010 dan rollback drill disetujui.
- Handshake bucket, CORS, dan domain delivery R2 serta login Google nyata tetap merupakan gate terpisah.
