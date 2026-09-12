# Runbook Rehearsal Migrasi Laravel 2025

Runbook ini menjalankan rehearsal snapshot publik pada database MySQL test terisolasi. Rehearsal tidak menulis ke database operator `pamoka`, tidak mengubah source Next.js, dan tidak melakukan public cutover.

## Prasyarat

- Jalankan MySQL test lokal pada `127.0.0.1:3308`.
- Siapkan database kosong bernama `pamoka_test`.
- Pastikan `laravel/.env` menunjuk ke database tersebut.
- Pastikan migrasi Laravel sudah tersedia.

## Dry run

```powershell
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '3308'
$env:DB_DATABASE = 'pamoka_test'
& 'D:\Tools\php-8.5.10\php.exe' artisan moka:rehearse-2025
```

Dry run harus menampilkan `Rehearsal lengkap 2025 lulus.` dan tidak membuat record database.

## Apply ke database test

Untuk mengulang rehearsal dari keadaan kosong, jalankan perintah berikut hanya setelah memastikan targetnya adalah `pamoka_test`.

```powershell
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '3308'
$env:DB_DATABASE = 'pamoka_test'
& 'D:\Tools\php-8.5.10\php.exe' artisan migrate:fresh --seed
& 'D:\Tools\php-8.5.10\php.exe' artisan moka:rehearse-2025 --apply
```

Command `--apply` memvalidasi semua fixture terlebih dahulu, kemudian menjalankan import peserta, berita, media publik, organisasi, dan voting dalam satu transaksi. Jika salah satu import gagal, perubahan rehearsal dibatalkan.

Hasil minimum yang diharapkan:

- 1 edisi, 4 kategori, 2 tahap seleksi, dan 60 peserta.
- 3 artikel, 6 acara, 7 album, 69 item album, dan 68 sponsor.
- 19 profil organisasi, 21 penugasan organisasi.
- 1 campaign, 44 peserta snapshot, dan 572 baris tally.

Jalankan `moka:rehearse-2025 --apply` untuk kedua kalinya. Jumlah record harus tetap sama.

## Gate setelah rehearsal

```powershell
& 'D:\Tools\php-8.5.10\php.exe' artisan test tests/Feature/Full2025RehearsalTest.php
```

Test memeriksa dry run, target database, idempotensi, dan route publik utama setelah snapshot diterapkan.

## Batas otorisasi

- Jangan menjalankan `--apply` pada database `pamoka` sebelum ada otorisasi operator untuk import data.
- Jangan mengaktifkan public cutover sebelum checklist Plan 010 dan rollback drill disetujui.
- Handshake UploadThing eksternal dan login Google nyata tetap merupakan gate terpisah.
