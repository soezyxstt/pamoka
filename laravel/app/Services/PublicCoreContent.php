<?php

namespace App\Services;

final class PublicCoreContent
{
    /**
     * @return array<string, mixed>
     */
    public function home(): array
    {
        return [
            'meta' => [
                'title' => 'PAMOKA Garut',
                'description' => 'Official website Paguyuban Mojang Jajaka Kabupaten Garut.',
            ],
            'hero' => [
                'title' => 'Paguyuban Mojang Jajaka Kabupaten Garut',
                'tagline' => 'Nu Nyunda Tur Nyakola',
                'image' => '/babancong.webp',
                'portrait' => '/hero.webp',
                'portraitAlt' => 'Perwakilan Mojang dan Jajaka Kabupaten Garut',
            ],
            'programImages' => [
                '/program-1.webp',
                '/program-2.webp',
                '/program-3.webp',
                '/bagendit.webp',
            ],
            'programs' => [
                'Pasanggiri Mojang Jajaka Kabupaten Garut.',
                'MOKA Uninga: Mojang Jajaka Ulin Ngaprak Garut.',
                'Balakecrakan: Buka Bersama Lampahan Kanggo Ngakeun Rukun Atikan Maparin Kaberkahan.',
                'Hurub Guyub: Miara Hubungan, Ngabudikeun Guyub.',
                'Berseka: Bersama Sehat Bareng Moka Garut.',
                'Karmisun: Kartu Miara Kasundaan.',
            ],
            'news' => [
                [
                    'title' => 'Press Release Semifinalis Pasanggiri Mojang Jajaka Kabupaten Garut 2025',
                    'description' => 'Paguyuban Mojang Jajaka Kabupaten Garut berkolaborasi dengan Dinas Pariwisata dan Kebudayaan Kabupaten Garut dalam Audisi Pasanggiri Mojang Jajaka Kabupaten Garut 2025.',
                    'image' => '/berita/press-release-semifinalis.webp',
                    'date' => '22 Juni 2025',
                    'href' => '/berita/press-release-semifinalis.pdf',
                ],
                [
                    'title' => 'Pasanggiri Mojang Jajaka Garut 2025',
                    'description' => 'Informasi dan perkembangan terbaru dari rangkaian Pasanggiri Mojang Jajaka Kabupaten Garut.',
                    'image' => '/bagendit.jpg',
                    'date' => '2025',
                    'href' => 'https://www.garuters.id/2025/07/pasanggiri-mojang-jajaka-kabupaten-garut-2025.html',
                ],
                [
                    'title' => 'Mojang Jajaka Garut dan Promosi Budaya',
                    'description' => 'Mengenal peran generasi muda dalam menjaga budaya Sunda, pariwisata, dan ekonomi kreatif Kabupaten Garut.',
                    'image' => '/programs.jpg',
                    'date' => '2024',
                    'href' => 'https://kabarpriangan.pikiran-rakyat.com/kabar-priangan/pr-1487466608/pasanggiri-mojang-dan-jajaka-garut-dorong-promosi-budaya-dan-parawisata',
                ],
            ],
            'join' => [
                'eyebrow' => 'Come Join Us',
                'title' => 'Mari Bergabung Bersama Kami di Mojang Jajaka Kab. Garut',
                'description' => 'Apakah kamu generasi muda Garut yang berbakat, cerdas, berwawasan luas, memiliki jiwa kepemimpinan, dan cinta terhadap budaya Sunda? Inilah saatnya kamu unjuk diri sebagai representasi anak muda Kabupaten Garut.',
                'href' => 'https://linktr.ee/mokagarut',
                'label' => 'Daftar',
                'image' => '/moka.png',
            ],
            'emptyState' => 'Konten sedang disiapkan.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function about(): array
    {
        return [
            'meta' => [
                'title' => 'Tentang Kami | MOKA Garut',
                'description' => 'Profil Paguyuban Mojang Jajaka Kabupaten Garut.',
            ],
            'hero' => [
                'title' => 'To Get To Know Us, Come and Meet Us',
                'image' => '/hero-about.webp',
            ],
            'vision' => [
                'title' => 'Visi Kami',
                'description' => 'Mewujudkan Paguyuban Mojang Jajaka Garut sebagai tempat pengembangan diri yang inspiratif dan berbudaya serta berwawasan global.',
                'image' => '/vision.jpg',
            ],
            'missions' => [
                'Membangun hubungan silih asah, silih asih, silih asuh di lingkungan Paguyuban Mojang Jajaka.',
                'Menjadi wadah pembinaan dan pengembangan potensi generasi muda Kabupaten Garut dalam bidang kepribadian, kepemimpinan, dan kemampuan komunikasi publik.',
                'Melestarikan dan membangun nilai budaya sebagai jati diri pemuda Sunda yang kreatif dan inspiratif.',
                'Membangun jejaring dengan berbagai pemangku kepentingan di tingkat daerah, provinsi, dan nasional untuk memperluas peran Paguyuban dalam promosi pariwisata, budaya, dan ekonomi kreatif Kabupaten Garut.',
                'Mendorong anggota untuk berpikir global dan bertindak lokal, dengan mengedepankan nilai kasundaan yang adaptif terhadap tantangan zaman.',
            ],
            'legal' => [
                'title' => 'Legalitas organisasi',
                'description' => 'Paguyuban Mojang Jajaka Kabupaten Garut merupakan perkumpulan yang sah dan terdaftar secara hukum di Indonesia. Status badan hukum disahkan melalui Keputusan Menteri Hukum dan Hak Asasi Manusia Republik Indonesia Nomor AHU-0001483.AH.01.07.TAHUN 2024.',
                'documentUrl' => '/pdf/SK_MOKA.pdf',
            ],
            'leadership' => $this->leadership(),
            'pastLeaders' => $this->pastLeaders(),
            'videos' => [
                ['id' => '5w0ORZ0XUkE', 'title' => 'Video kegiatan PAMOKA 1'],
                ['id' => 'PEx2wVwReX4', 'title' => 'Video kegiatan PAMOKA 2'],
                ['id' => 'Str4439U-OM', 'title' => 'Video kegiatan PAMOKA 3'],
                ['id' => 'f6rmvU8o6CI', 'title' => 'Video kegiatan PAMOKA 4'],
                ['id' => 'I-R_T7cULcI', 'title' => 'Video kegiatan PAMOKA 5'],
                ['id' => '05GxYCSbhg4', 'title' => 'Video kegiatan PAMOKA 6'],
                ['id' => 'qG8qy-QUxKY', 'title' => 'Video kegiatan PAMOKA 7'],
                ['id' => 'pWTQEm_gCaY', 'title' => 'Video kegiatan PAMOKA 8'],
                ['id' => 'S4NanSPqf00', 'title' => 'Video kegiatan PAMOKA 9'],
            ],
            'emptyState' => 'Konten sedang disiapkan.',
        ];
    }

    /**
     * @return list<array{name: string, position: string, image: string}>
     */
    private function leadership(): array
    {
        return [
            ['name' => 'Cecep Safaatul Barkah', 'position' => 'Ketua Dewan Pengawas', 'image' => '/pengurus/Cecep Safaatul Barkah.png'],
            ['name' => 'Kiki Syarief', 'position' => 'Dewan Pengawas I', 'image' => '/pengurus/Kiki Syarief.png'],
            ['name' => 'Muhammad Khaerul', 'position' => 'Dewan Pengawas II', 'image' => '/pengurus/Muhammad Khaerul.png'],
            ['name' => 'Nurman Purnama Gumilar', 'position' => 'Ketua Umum', 'image' => '/pengurus/Nurman Purnama Gumilar.png'],
            ['name' => 'Salawat Fatih Ibrahim', 'position' => 'Wakil Ketua I', 'image' => '/pengurus/Salawat Fatih Ibrahim.png'],
            ['name' => 'Yudhan Triyana', 'position' => 'Wakil Ketua II', 'image' => '/pengurus/Yudhan Triyana.png'],
            ['name' => 'Syahril', 'position' => 'Sekretaris Umum', 'image' => '/pengurus/Syahril.png'],
            ['name' => 'C Allifiana Fadhilah Jasmine', 'position' => 'Wakil Sekretaris', 'image' => '/pengurus/C Allifiana Fadhilah Jasmine.png'],
            ['name' => 'Rian Nurdiansyah', 'position' => 'Bendahara Umum', 'image' => '/pengurus/Rian Nurdiansyah.png'],
            ['name' => 'Zalfa Fadhilah', 'position' => 'Wakil Bendahara', 'image' => '/pengurus/Zalfa Fadhilah.png'],
            ['name' => 'Moch Adval Ginalingga Darmawan', 'position' => 'Kepala Bidang Penelitian dan Pengembangan', 'image' => '/pengurus/Moch Adval Ginalingga Darmawan.png'],
            ['name' => 'Gina Listya Nuraini', 'position' => 'Kepala Bidang Pengadaan Sumber Daya Organisasi', 'image' => '/pengurus/Gina Listya Nuraini.png'],
            ['name' => 'Roby Akhmad Akbari Santoso', 'position' => 'Kepala Bidang Hubungan Masyarakat', 'image' => '/pengurus/Roby Akhmad Akbari Santoso.png'],
            ['name' => 'Gumilang M Khotib', 'position' => 'Bidang Kreatif dan Media Sosial', 'image' => '/pengurus/Gumilang M Khotib.png'],
            ['name' => 'Riana Ahsan', 'position' => 'Bidang Kreatif dan Media Sosial', 'image' => '/pengurus/Riana Ahsan.png'],
            ['name' => 'Mochamad Haiqal Aditia Pratama', 'position' => 'Kepala Bidang Ekonomi Kreatif', 'image' => '/pengurus/Mochamad Haiqal Aditia Pratama.png'],
        ];
    }

    /**
     * @return list<array{name: string, position: string, image: string}>
     */
    private function pastLeaders(): array
    {
        return [
            ['name' => 'Cecep Safaatul Barkah', 'position' => '2008-2013', 'image' => '/ketua/Cecep Safaatul Barkah.png'],
            ['name' => 'Teguh Ramadhan', 'position' => '2013-2016', 'image' => '/ketua/Teguh Ramadhan.png'],
            ['name' => 'Yesi Haerunisa', 'position' => '2016-2019', 'image' => '/ketua/Yesi Haerunisa.png'],
            ['name' => 'Isnat Ahmad Zulfaqor', 'position' => '2019-2021', 'image' => '/ketua/Isnat Ahmad Zulfaqor.png'],
            ['name' => 'Nurman Purnama Gumilar', 'position' => '2021-Sekarang', 'image' => '/ketua/Nurman Purnama Gumilar.png'],
        ];
    }
}
