<?php

namespace App\Services;

final class PublicNewsCatalog
{
    /**
     * @var list<array{title: string, description: string, image: string, date: string, href: string}>
     */
    private const FEATURED_NEWS = [
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
    ];

    /**
     * @return list<array{title: string, description: string, image: string, date: string, href: string}>
     */
    public function featured(): array
    {
        return self::FEATURED_NEWS;
    }
}
