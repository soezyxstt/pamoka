<?php

namespace App\Services;

use App\Models\Edition;
use App\Models\NewsArticle;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;

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
        $edition = Edition::query()
            ->where('lifecycle', 'active')
            ->orderByDesc('year')
            ->first();

        if ($edition !== null && Schema::hasTable('news_articles')) {
            $articles = NewsArticle::query()
                ->with('coverMedia')
                ->where('status', 'published')
                ->whereNotNull('published_at')
                ->where(function (Builder $query) use ($edition): void {
                    $query
                        ->whereNull('edition_id')
                        ->orWhere('edition_id', $edition->id);
                })
                ->orderByDesc('published_at')
                ->limit(3)
                ->get();

            if ($articles->isNotEmpty()) {
                return $articles->map(fn (NewsArticle $article): array => $this->present($article))->all();
            }
        }

        return self::FEATURED_NEWS;
    }

    /**
     * @return array{title: string, description: string, image: string, date: string, href: string}
     */
    private function present(NewsArticle $article): array
    {
        return [
            'title' => $article->title,
            'description' => $article->excerpt ?? 'Informasi terbaru dari PAMOKA Garut.',
            'image' => $article->coverMedia?->url ?? '/finalis/hero.webp',
            'date' => $this->formatDate($article->published_at),
            'href' => $article->source_url ?? '/',
        ];
    }

    private function formatDate(?CarbonInterface $date): string
    {
        if ($date === null) {
            return 'Tanggal belum tersedia';
        }

        $months = [
            1 => 'Januari',
            2 => 'Februari',
            3 => 'Maret',
            4 => 'April',
            5 => 'Mei',
            6 => 'Juni',
            7 => 'Juli',
            8 => 'Agustus',
            9 => 'September',
            10 => 'Oktober',
            11 => 'November',
            12 => 'Desember',
        ];

        return $date->day.' '.($months[$date->month] ?? $date->format('F')).' '.$date->year;
    }
}
