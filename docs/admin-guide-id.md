# Panduan Lengkap PAMOKA CMS

Panduan operasional sistem manajemen konten (CMS) resmi **Paguyuban Mojang Jajaka Kabupaten Garut (PAMOKA Garut)**.

> Catatan migrasi: panduan ini masih mendeskripsikan CMS Next.js yang menjadi sumber perilaku pembanding. Sidecar Laravel di `laravel/` sudah memiliki fondasi Google OAuth, approval akses, RBAC, audit log, konteks edisi aktif, serta slice authoring berita, sponsor, acara, galeri, peserta, tahap seleksi, gelar, kepengurusan organisasi, panitia, identitas edisi, program unggulan, dan aset situs. Modul CMS lain masih dimigrasikan bertahap dan runtime publik belum diganti.

---

## 1. Masuk dan Manajemen Akses

1. Akses halaman login di `/admin/login` dan lakukan autentikasi dengan akun Google.
2. Pengguna baru otomatis berstatus **Pending**. Buka menu **Minta akses**, jelaskan tugas operasional Anda, dan pilih modul yang diperlukan.
3. Administrator dengan izin `access.approve` akan meninjau dan menyetujui permintaan dari menu **Pengguna** (`/admin/users`).
4. Satu pengguna dapat memegang kombinasi role (misalnya: *Content Editor*, *Media Manager*, *Voting Operator*).
5. Super admin di-bootstrap manual melalui Turso database sesuai runbook; tidak ada bootstrap otomatis.

---

## 2. Selector Edisi & Isolasi Data Tahunan

Bar atas (header) admin dilengkapi dengan **Selector Edisi Aktif**:
- Memilih edisi di header akan mengisolasi ruang kerja admin ke tahun yang dipilih (misal: *Pasanggiri MOKA 2025* atau *2026*).
- Modul-modul berbasis edisi (Identitas, Aset Situs, Sponsor, Berita, Panitia, Mojang Jajaka, Acara, Galeri, dan Voting) otomatis menyesuaikan data dengan edisi aktif.
- Modul global yang berlaku lintas tahun: **Kepengurusan Organisasi** (`/admin/organization`), **Pustaka Media** (`/admin/media`), **Manajemen Pengguna** (`/admin/users`), dan **Audit Log** (`/admin/audit`).
- Pilihan di formulir memakai kontrol Select yang dapat dinavigasi dengan keyboard; nilai kosong tetap dikirim sebagai nilai kosong.

---

## 3. Dashboard & Kesiapan Konten Edisi (Readiness Checklist)

Halaman utama dashboard (`/admin`) menyediakan ikhtisar terpadu:
1. **Statistik Utama**: Menampilkan edisi terpilih, jumlah peserta aktif, berita, dan sponsor.
2. **Panel Kesiapan Konten (Readiness Checklist)**: Memantau 10 indikator kesiapan sebelum peluncuran edisi:
   - **Identitas Edisi**: Kelengkapan logo resmi (1:1) dan slogan Pasanggiri.
   - **Program Unggulan**: Program yang ditampilkan untuk edisi aktif.
   - **Aset Situs Tetap**: Keterisian seluruh slot wajib pada manifest aset.
   - **Struktur Panitia**: Susunan panitia pelaksana edisi.
   - **Peserta Pasanggiri**: Peserta aktif dan kesiapan tahap seleksi edisi.
   - **Rangkaian Acara**: Agenda kegiatan edisi aktif.
   - **Kampanye Voting**: Kampanye voting kameumeut edisi aktif.
   - **Sponsor & Mitra**: Partner pendukung edisi.
   - **Berita Editorial**: Artikel yang telah dipublikasikan.
   - **Galeri Dokumentasi**: Album dokumentasi foto dan video.
3. **Pintas Navigasi Cepat**: Tautan langsung ke modul yang belum lengkap beserta bar persentase kesiapan.
4. **Log Audit Terkini**: Ringkasan aktivitas transaksional admin dalam zona waktu Indonesia Barat (`Asia/Jakarta`).

---

## 4. Identitas Edisi & Program Unggulan

Menu **Identitas Edisi** (`/admin/content/edition-settings`) mengelola brand dan agenda resmi edisi aktif:
1. **Logo Resmi**: Unggah atau pilih logo berlatar transparan (PNG/WebP, rasio 1:1).
2. **Slogan Edisi**: Masukkan tagline resmi edisi (misal: *Nu Nyunda Tur Nyakola*).
3. **Program Unggulan**: Kelola daftar program kerja edisi dengan judul, deskripsi, status aktif, dan tombol pemindah urutan (naik/turun).
4. **Pembaruan Transaksional**: Setiap perubahan dicatat di audit log dengan penguncian versi optimistik (`version`).

---

## 5. Aset Situs Tetap

Menu **Aset Situs Tetap** (`/admin/content/site-assets`) mengelola penempatan media pada 24 slot visual tetap untuk Beranda, Tentang, dan halaman kategori:
1. Buka kelompok halaman yang ingin diubah. Hanya satu kelompok ditampilkan agar halaman tetap ringkas.
2. Setiap kartu slot menampilkan nama bagian, jenis media, rasio, status keterisian, dan pratinjau.
3. Gunakan pilihan media untuk memilih aset `ready` dari pustaka. Upload langsung dari authoring Laravel belum tersedia.
4. Anda dapat menyesuaikan **Alt text khusus slot** dan titik fokus gambar (Fokus X dan Y dalam persentase 0 hingga 100).
5. Tombol **Lepas media** mengosongkan slot terpilih tanpa menghapus file asli dari pustaka media.
6. Tidak tersedia tombol penambahan slot sembarangan guna menjaga integritas desain situs publik.

---

## 6. Sponsor & Mitra

Menu **Sponsor** (`/admin/content/sponsors`) mengelola partner pendukung acara:
1. **Tingkatan Tier**: Kelola sponsor berdasarkan kategori (`Utama`, `Pendukung`, `Pendamping`, `Pelengkap`).
2. **Pencarian & Filter**: Saring berdasarkan nama, tier, atau status aktif/nonaktif.
3. **Logo**: Pilih logo sponsor dari aset gambar berstatus siap. Upload langsung dari form authoring Laravel belum tersedia.
4. **Urutan Tampil**: Atur nomor urut penampilan (display order) untuk menentukan posisi di situs publik.
5. **Penerbitan**: Sponsor baru selalu disimpan nonaktif. Pengguna dengan `content.publish` dapat mengaktifkannya setelah data diperiksa.
6. **Versi dan audit**: Perubahan dibatasi ke edisi aktif, diperiksa dengan `version`, dan dicatat pada audit log.

---

## 7. Berita dan Editorial

Menu **Berita** (`/admin/content/news`) menyediakan studio penulisan cerita dan dokumentasi resmi:
1. **Tulis berita**: Isi judul, alamat berita, ringkasan, dan foto sampul.
2. **Atur isi**: Pada sidecar Laravel, isi ditulis sebagai paragraf terstruktur melalui textarea. Format TipTap lengkap masih mengikuti workflow Next.js sampai slice editor berikutnya selesai.
3. **Pilih media**: Pilih cover dari aset gambar berstatus siap. Upload media langsung dari authoring Laravel belum tersedia.
4. **Simpan draft**: Simpan perubahan secara manual. Setiap simpan membuat snapshot draft, revision history, dan audit log.
5. **Kelola status**: Artikel dapat diterbitkan, ditarik kembali ke draft, diarsipkan, atau dihapus sesuai permission.
6. **Terbitkan**: Cover, ringkasan, dan isi wajib lengkap. Versi artikel diperiksa agar perubahan lama tidak menimpa perubahan baru.

---

## 8. Kepengurusan Organisasi (Global)

Menu **Kepengurusan** (`/admin/organization`) mengelola struktur kepengurusan PAMOKA lintas periode:

1. **Multi-Tab**: Terbagi menjadi tab *Periode Kepengurusan*, *Direktori Profil*, dan *Perlu Dipetakan*.
2. **Struktur Organisasi Bertingkat (Tree)**: Kelola unit organisasi hierarkis (hingga 4 level kedalaman: Dewan Pembina, Pengurus Harian, Bidang, Divisi).
3. **Penugasan Pengurus**: Hubungkan orang dari Direktori Profil ke unit organisasi dengan jabatan tertentu.
4. **Direktori Orang Bersama**: Profil orang (nama, bio, media sosial, foto) dapat digunakan kembali untuk kepengurusan berbagai periode maupun kepanitiaan edisi.
5. **Edisi Terhubung**: Buka detail periode lalu pilih **Atur** pada bagian Edisi terhubung. Satu periode dapat memiliki beberapa edisi. Jika edisi masih terhubung ke periode lain, centang konfirmasi pemindahan sebelum menyimpan.
6. **Visi dan Misi**: Buka **Edit metadata periode** untuk memperbarui visi serta menambah, menghapus, atau mengurutkan poin misi.

Pada sidecar Laravel, Stage 9E menyediakan workflow periode organisasi, hubungan periode dan edisi dengan konfirmasi pemindahan, direktori orang reusable, tautan sosial HTTPS, portrait dari media gambar siap pakai, tree unit maksimal 4 tingkat, penugasan anggota, dan pemetaan assignment legacy. Semua write memakai permission `people.manage`, transaksi, audit log, dan optimistic version pada entitas yang memiliki versi. Upload media langsung, import database operator, dan cutover publik belum dilakukan.

---

## 9. Panitia Pelaksana Edisi

Menu **Panitia** (`/admin/content/committee`) mengelola susunan panitia pelaksana khusus edisi aktif:
1. **Isolasi Edisi**: Struktur panitia terikat secara ketat pada edisi yang dipilih di header.
2. **Pohon Hierarki Panitia**: Bangun hierarki kepanitiaan (Steering Committee, Organizing Committee, Divisi Acara, Divisi Logistik, dll.).
3. **Tambah Orang Cepat**: Modal pembuatan profil baru instan jika orang yang ditugaskan belum ada di direktori global.

Pada sidecar Laravel, Stage 9F menyediakan daftar unit, unit induk hingga 4 tingkat, pengurutan unit sesaudara, pengelolaan status aktif, penugasan profil orang ke unit, pengubahan dan penghapusan penugasan, serta quick create profil dengan portrait dari aset gambar siap pakai. Semua perubahan ditujukan ke edisi pada selector header, memakai permission `content.edit`, optimistic version untuk penugasan, transaksi, dan audit log. Upload media langsung, import data operator, dan visual QA browser terautentikasi belum dilakukan.

Pada sidecar Laravel, Stage 9G menyediakan editor slogan dan logo edisi, CRUD program unggulan, reorder program, serta binding 24 slot aset situs terhadap media `ready` sesuai tipe slot. Binding mendukung alt override, titik fokus 0 sampai 100, optimistic version, isolasi edisi, permission `content.edit`, transaksi, dan audit log. Upload media langsung, import data operator, public cutover, dan visual QA browser terautentikasi belum dilakukan.

---

## 10. Mojang Jajaka dan Seleksi

Menu **Mojang Jajaka** (`/admin/content/participants`) mengelola peserta Pasanggiri:
1. **Atur Tahap**: Buka `/admin/content/participants/stages`, buat alur dari tahap pertama sampai tahap final, lalu buka tahap pertama.
2. **Input Manual**: Buka `/admin/content/participants/new` untuk memasukkan pendaftar dari Google Form. Pendaftar otomatis masuk ke tahap pertama.
3. **Workspace Seleksi**: Buka satu tahap untuk menetapkan `Lolos` atau `Tidak lolos`. Semua peserta harus memiliki keputusan sebelum tahap ditutup.
4. **Pemulihan**: Keputusan dapat di-rollback dengan alasan. Tahap tertutup dapat dibuka kembali hanya jika tahap berikutnya belum diproses.
5. **Kategori Standar**: Peserta memakai kategori baku `JD`, `MD`, `JR`, atau `MR`.
6. **Tahap Dinamis**: Target berlaku untuk seluruh kategori. Sistem tidak menyimpan nilai tes atau ranking.
7. **Tahap Final dan Gelar**: Buka `/admin/content/participants/titles` untuk membuat gelar, mengatur jumlah slot, dan menyematkannya kepada peserta tahap final. Satu peserta dapat menerima beberapa gelar.
8. **Penghapusan Tahap**: Tahap yang masih dipakai peserta atau voting tidak dapat dihapus.
9. **Editor Detail Peserta** (`/admin/content/participants/[id]`):
   - **Identitas & Kategori**: Nomor urut, nama lengkap, slug profil, dan bio ringkas.
   - **Prestasi**: Daftar capaian dan prestasi dengan tombol pengurut naik/turun.
   - **Sosial Media**: Tautan akun Instagram, TikTok, YouTube, LinkedIn, dll.
   - **Galeri Multi-Role**: Foto dikelompokkan berdasarkan peran (`Closeup`, `Full Body`, `Detail Busana`, `Karantina`, `Lainnya`). Foto Closeup otomatis tersinkronisasi ke foto profil utama.
   - **QRIS dan Voting**: QRIS dibuat di luar sistem, lalu gambarnya diunggah atau dipilih dari Pustaka Media.
10. **Live Preview**: Pratinjau kartu peserta secara langsung saat mengedit.

Pada sidecar Laravel, Stage 9C dan 9D sudah menyediakan daftar peserta, input pendaftar baru, editor identitas, prestasi, tautan sosial, foto profil multi-role, QRIS, URL pembayaran, status aktif, penghapusan aman, workspace tahap seleksi, keputusan massal, rollback, lifecycle tahap, pengelolaan gelar, dan assignment peserta final pada route `/admin/content/participants`. Perubahan hanya berlaku untuk edisi yang dipilih, memakai optimistic version, permission `participants.manage`, dan audit transaksional. Upload media langsung, import operator, dan cutover publik belum dilakukan.

---

## 11. Acara dan galeri

Menu **Rangkaian acara** (`/admin/content/events`) mengelola nama, slug, deskripsi, foto hero, status, dan urutan acara pada edisi aktif. Buka detail acara untuk melihat album terkait atau membuat album baru yang langsung terhubung.

Pada sidecar Laravel, perubahan acara memerlukan `events.manage`, foto hero hanya dapat memakai aset gambar siap, dan tombol panah menyimpan urutan secara transaksional.

Menu **Galeri** (`/admin/content/galleries`) menyediakan dua tipe album:

1. **Umum**: album tidak terkait acara.
2. **Terkait acara**: album hanya dapat memilih acara dari edisi aktif.

Di dalam album, admin dapat memilih beberapa foto dari Pustaka Media, menambahkan video YouTube, mengubah keterangan, dan mengatur urutan. Setiap item hanya memiliki satu sumber. Authoring Laravel memerlukan `gallery.manage`, menjaga owner tetap pada edisi aktif, dan mencatat perubahan item pada audit log. Upload media, preview split, serta pratinjau penuh masih mengikuti workflow Next.js sampai slice berikutnya selesai.

---

## 12. Operasional Voting Manual

Menu **Voting** (`/admin/voting`) mengelola kampanye voting kameumeut:
1. **Buat Kampanye**: Pilih tahap sumber dari edisi aktif. Tahap final dipilih otomatis bila tersedia.
2. **Mulai Manual**: Ketik nama kampanye dan alasan. Sistem membekukan daftar peserta tahap sebagai snapshot.
3. **Siapkan QRIS**: Unggah atau pilih gambar QRIS eksternal pada profil peserta. PDF dan media yang belum siap tidak dapat menerima tally.
4. **Catat Tally**: Pilih peserta snapshot dan tanggal, lalu masukkan akumulasi pemasukan harian dari dashboard merchant QRIS.
5. **Tampilkan Hasil**: Ubah visibilitas dengan alasan. Kampanye draf belum dapat ditampilkan.
6. **Tutup Manual**: Tutup kampanye dengan nama dan alasan. Tally terkunci setelah kampanye ditutup.

---

## 13. Pustaka Media & Folder Edisi

Menu **Pustaka Media** (`/admin/media`):
1. **Folder Edisi & Global**: Buat folder khusus edisi untuk mengelompokkan aset tahunan atau folder global untuk aset bersama.
2. **Upload Berbasis UploadThing**: Mendukung unggahan gambar (hingga 20 MB), video (hingga 512 MB), dan PDF (hingga 64 MB).
3. **Manajemen Aset**: Edit alt text, tandai gambar dekoratif, salin URL, atau pindahkan file antar folder tanpa merusak referensi tautan.

---

## 14. Audit Log & Keamanan

Menu **Audit** (`/admin/audit`):
1. Setiap operasi penambahan, perubahan, penghapusan, dan pengunggahan dicatat secara otomatis dalam transaksi database yang sama.
2. Mencatat waktu WIB (`Asia/Jakarta`), identitas operator, jenis sumber daya, aksi, serta rincian sebelum (*before*) dan sesudah (*after*) perubahan.
3. Menjamin transparansi dan akuntabilitas penuh pada seluruh data CMS dan operasional voting.
