# Glossary

- **Aplikasi Next.js lama**: aplikasi yang saat ini menjadi sumber perilaku dan tampilan PAMOKA Garut sebelum cutover migrasi.
- **Aplikasi Laravel target**: aplikasi baru berbasis Laravel, Inertia React, dan MySQL yang dibangun berdampingan selama migrasi.
- **Migration slice**: satu bagian kecil dari fitur atau alur pengguna yang dapat diimplementasikan dan diuji secara mandiri.
- **Parity checkpoint**: titik pemeriksaan ketika hasil aplikasi target dibandingkan dengan perilaku yang disepakati dari aplikasi lama.
- **Cutover**: keputusan eksplisit untuk menjadikan aplikasi Laravel target sebagai runtime publik utama.
- **Edisi**: konteks tahunan Pasanggiri dan konten MOKA yang mengikat kategori, peserta, acara, galeri, panitia, dan voting.
- **Peserta**: pendaftar dalam satu edisi dan kategori yang dapat bergerak melalui tahap seleksi.
- **Tahap seleksi**: urutan proses seleksi dalam satu edisi dengan keputusan pending, advanced, atau eliminated.
- **Kampanye voting**: periode voting yang terikat pada satu edisi, memiliki kelayakan peserta, tally, dan visibilitas hasil.
- **Konten publik**: materi yang dilihat pengunjung dan harus mempertahankan parity selama migrasi.
- **Ruang kerja admin**: permukaan terautentikasi untuk CMS, media, seleksi, organisasi, panitia, voting, dan audit.
