# Panduan Lengkap PAMOKA CMS

Panduan operasional sistem manajemen konten (CMS) resmi **Paguyuban Mojang Jajaka Kabupaten Garut (PAMOKA Garut)**.

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

---

## 3. Dashboard & Kesiapan Konten Edisi (Readiness Checklist)

Halaman utama dashboard (`/admin`) menyediakan ikhtisar terpadu:
1. **Statistik Utama**: Menampilkan jumlah Finalis Aktif, Berita Published, dan Sponsor Terdaftar untuk edisi terpilih.
2. **Panel Kesiapan Konten (Readiness Checklist)**: Memantau 8 indikator kesiapan sebelum peluncuran edisi:
   - **Identitas Edisi**: Kelengkapan logo resmi (1:1) dan slogan Pasanggiri.
   - **Aset Situs Tetap**: Keterisian slot banner/hero publik (7 slot).
   - **Struktur Panitia**: Susunan panitia pelaksana edisi.
   - **Finalis Pasanggiri**: Peserta berstatus finalis aktif.
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

Menu **Aset Situs Tetap** (`/admin/content/site-assets`) mengelola penempatan media pada 7 slot visual tetap halaman publik (Beranda, Tentang, dan Kategori):
1. Pilih tab halaman tujuan (**Beranda**, **Tentang**, atau **Kategori**).
2. Setiap kartu slot menampilkan nama bagian, kunci slot, jenis media yang diizinkan (gambar/video), rasio yang disarankan, dan status keterisian.
3. Gunakan tombol **Pilih media** untuk memilih dari pustaka atau mengunggah file baru.
4. Anda dapat menyesuaikan **Alt text khusus slot** dan titik fokus gambar (Fokus X dan Y dalam persentase 0 hingga 100).
5. Tombol **Lepas slot** mengosongkan slot terpilih tanpa menghapus file asli dari pustaka media.
6. Tidak tersedia tombol penambahan slot sembarangan guna menjaga integritas desain situs publik.

---

## 6. Sponsor & Mitra

Menu **Sponsor** (`/admin/content/sponsors`) mengelola partner pendukung acara:
1. **Tingkatan Tier**: Kelola sponsor berdasarkan kategori (`Utama`, `Pendukung`, `Pendamping`, `Pelengkap`).
2. **Pencarian & Filter**: Saring berdasarkan nama, tier, atau status aktif/nonaktif.
3. **Logo & Pratinjau**: Pilih logo sponsor dan lihat simulasi kartu mini secara live.
4. **Urutan Tampil**: Atur nomor urut penampilan (display order) untuk menentukan posisi di situs publik.

---

## 7. Berita & Editorial (WYSIWYG TipTap)

Menu **Berita** (`/admin/content/news`) menyediakan studio penulisan cerita dan dokumentasi resmi:
1. **Editor TipTap Kaya Fitur**: Mendukung pemformatan teks lengkap (Heading 2-4, Bold, Italic, Strikethrough, Bullet/Numbered List, Blockquote, Divider, Image inline).
2. **Unggah & Sisip Gambar**: Sisipkan gambar langsung dari Pustaka Media atau unggah aset baru langsung ke dalam artikel.
3. **Autosave Draft**: Draf tersimpan otomatis ke database setiap beberapa detik untuk mencegah kehilangan data.
4. **Live Split Preview**: Kolom kanan menampilkan pratinjau artikel publik dengan tipografi Montserrat & Inter secara real-time.
5. **Siklus Publikasi**: Kontrol status artikel (`draft`, `published`, `archived`) dengan pencatatan tanggal tayang (`publishedAt`).

---

## 8. Kepengurusan Organisasi (Global)

Menu **Kepengurusan** (`/admin/organization`) mengelola struktur kepengurusan PAMOKA lintas periode:
1. **Multi-Tab**: Terbagi menjadi tab *Periode Kepengurusan*, *Direktori Profil*, dan *Perlu Dipetakan*.
2. **Struktur Organisasi Bertingkat (Tree)**: Kelola unit organisasi hierarkis (hingga 4 level kedalaman: Dewan Pembina, Pengurus Harian, Bidang, Divisi).
3. **Penugasan Pengurus**: Hubungkan orang dari Direktori Profil ke unit organisasi dengan jabatan tertentu.
4. **Direktori Orang Bersama**: Profil orang (nama, bio, media sosial, foto) dapat digunakan kembali untuk kepengurusan berbagai periode maupun kepanitiaan edisi.

---

## 9. Panitia Pelaksana Edisi

Menu **Panitia** (`/admin/content/committee`) mengelola susunan panitia pelaksana khusus edisi aktif:
1. **Isolasi Edisi**: Struktur panitia terikat secara ketat pada edisi yang dipilih di header.
2. **Pohon Hierarki Panitia**: Bangun hierarki kepanitiaan (Steering Committee, Organizing Committee, Divisi Acara, Divisi Logistik, dll.).
3. **Tambah Orang Cepat**: Modal pembuatan profil baru instan jika orang yang ditugaskan belum ada di direktori global.

---

## 10. Mojang Jajaka (Peserta & Finalis)

Menu **Mojang Jajaka** (`/admin/content/participants`) mengelola peserta Pasanggiri:
1. **Kategori Standar**: Terbagi dalam 4 kategori baku: `JD` (Jajaka Dewasa), `MD` (Mojang Dewasa), `JR` (Jajaka Remaja), `MR` (Mojang Remaja).
2. **Tahap Seleksi**: Status peserta (`audisi`, `semifinalis`, `finalis`).
3. **Editor Detail Peserta** (`/admin/content/participants/[id]`):
   - **Identitas & Kategori**: Nomor urut, nama lengkap, slug profil, dan bio ringkas.
   - **Prestasi**: Daftar capaian dan prestasi dengan tombol pengurut naik/turun.
   - **Sosial Media**: Tautan akun Instagram, TikTok, YouTube, LinkedIn, dll.
   - **Galeri Multi-Role**: Foto dikelompokkan berdasarkan peran (`Closeup`, `Full Body`, `Detail Busana`, `Karantina`, `Lainnya`). Foto Closeup otomatis tersinkronisasi ke foto profil utama.
   - **QRIS & Voting**: Upload barcode QRIS pembayaran (rasio 1:1) dan tautan e-wallet alternatif.
4. **Live Preview**: Pratinjau kartu finalis publik secara langsung saat mengedit.

---

## 11. Acara & Galeri Dokumentasi

Menu **Rangkaian Acara** (`/admin/content/events`) & **Galeri** (`/admin/content/galleries`):
1. **Rangkaian Acara**: Kelola agenda kegiatan (Audisi, Karantina, Malam Bakat, Grand Final) dengan banner sampul hero dan urutan kegiatan.
2. **Album Galeri**:
   - **Tipe Album**: Mendukung album *Standalone* (kegiatan umum) atau *Terkait Acara* (terhubung ke salah satu agenda acara).
   - **Item Foto & Video**: Tambahkan banyak foto sekaligus dari Pustaka Media atau sematkan video YouTube dengan ID/URL.
   - **Live Split Preview**: Pratinjau album dengan bilah indeks album di sisi kiri dan tata letak grid media responsif.

---

## 12. Operasional Voting Manual

Menu **Voting** (`/admin/voting`) mengelola kampanye voting kameumeut:
1. **Isolasi Kampanye**: Kampanye voting hanya memuat finalis aktif dari edisi yang dipilih.
2. **Input Transaksi Harian**: Masukkan akumulasi pemasukan harian dari dashboard merchant QRIS untuk tiap finalis dan tanggal tertentu.
3. **Kalkulasi Poin Otomatis**: Poin voting dihitung otomatis dari nominal rupiah dibagi harga per poin (pembulatan ke bawah).
4. **Visibilitas Hasil**: Tombol sakelar untuk menampilkan atau menyembunyikan hasil perolehan voting di situs publik.

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
