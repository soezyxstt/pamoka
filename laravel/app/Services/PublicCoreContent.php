<?php

namespace App\Services;

final class PublicCoreContent
{
    /**
     * @param  list<array{title: string, description: string, image: string, date: string, href: string}>  $news
     * @return array<string, mixed>
     */
    public function home(array $news = []): array
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
            'news' => $news,
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
     * @param  list<array{id: string, title: string}>  $videos
     * @return array<string, mixed>
     */
    public function about(array $videos = []): array
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
            'videos' => $videos,
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
