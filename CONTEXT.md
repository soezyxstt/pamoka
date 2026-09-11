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
- **Akun admin**: identitas pengguna yang dapat meminta atau menerima akses ke ruang kerja admin.
- **Permintaan akses**: pengajuan dari akun admin berstatus menunggu yang harus ditinjau sebelum area kerja dapat digunakan.
- **Permission**: izin bernama untuk satu kemampuan admin, yang dapat berasal dari role atau override per pengguna.
- **Konteks edisi aktif**: satu edisi yang sedang dipakai sebagai batas kerja untuk operasi admin yang terkait dengan tahun Pasanggiri.
- **Route contract**: kesepakatan sementara tentang path, nama route, parameter, component Inertia, props, dan respons error selama pemindahan fitur.
- **Shell publik**: layout bersama aplikasi target yang memuat navigasi, footer, typography, token brand, dan perilaku responsif pengunjung.
