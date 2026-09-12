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
     * @param  array{leadership: list<array{name: string, position: string, image: string, gender: string}>, pastLeaders: list<array{name: string, position: string, image: string, gender: string}>}|null  $organization
     * @return array<string, mixed>
     */
    public function about(array $videos = [], ?array $organization = null): array
    {
        $organization ??= PublicOrganizationCatalog::snapshot();

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
            'leadership' => $organization['leadership'],
            'pastLeaders' => $organization['pastLeaders'],
            'videos' => $videos,
            'emptyState' => 'Konten sedang disiapkan.',
        ];
    }
}
