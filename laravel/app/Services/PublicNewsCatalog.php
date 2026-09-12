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
     * @var list<array{slug: string, title: string, description: string, image: string, date: string, href: string, kind: string, body: ?string, bodyJson: mixed}>
     */
    private const SNAPSHOT_ARTICLES = [
        [
            'slug' => 'press-release-semifinalis',
            'title' => 'Press Release Semifinalis Pasanggiri Mojang Jajaka Kabupaten Garut 2025',
            'description' => 'Paguyuban Mojang Jajaka Kabupaten Garut berkolaborasi dengan Dinas Pariwisata dan Kebudayaan Kabupaten Garut dalam Audisi Pasanggiri Mojang Jajaka Kabupaten Garut 2025.',
            'image' => '/berita/press-release-semifinalis.webp',
            'date' => '22 Juni 2025',
            'href' => '/berita/press-release-semifinalis.pdf',
            'kind' => 'file',
            'body' => null,
            'bodyJson' => null,
        ],
        [
            'slug' => 'pasanggiri-mojang-jajaka-garut-2025',
            'title' => 'Pasanggiri Mojang Jajaka Garut 2025',
            'description' => 'Informasi dan perkembangan terbaru dari rangkaian Pasanggiri Mojang Jajaka Kabupaten Garut.',
            'image' => '/bagendit.jpg',
            'date' => '2025',
            'href' => 'https://www.garuters.id/2025/07/pasanggiri-mojang-jajaka-kabupaten-garut-2025.html',
            'kind' => 'external',
            'body' => null,
            'bodyJson' => null,
        ],
        [
            'slug' => 'mojang-jajaka-garut-promosi-budaya',
            'title' => 'Mojang Jajaka Garut dan Promosi Budaya',
            'description' => 'Mengenal peran generasi muda dalam menjaga budaya Sunda, pariwisata, dan ekonomi kreatif Kabupaten Garut.',
            'image' => '/programs.jpg',
            'date' => '2024',
            'href' => 'https://kabarpriangan.pikiran-rakyat.com/kabar-priangan/pr-1487466608/pasanggiri-mojang-dan-jajaka-garut-dorong-promosi-budaya-dan-parawisata',
            'kind' => 'external',
            'body' => null,
            'bodyJson' => null,
        ],
    ];

    /**
     * @return list<array{title: string, description: string, image: string, date: string, href: string}>
     */
    public function featured(): array
    {
        $edition = $this->activeEdition();

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
                return $articles->map(fn (NewsArticle $article): array => $this->presentCard($article))->all();
            }
        }

        return array_map(
            static fn (array $article): array => [
                'title' => $article['title'],
                'description' => $article['description'],
                'image' => $article['image'],
                'date' => $article['date'],
                'href' => $article['href'],
            ],
            self::SNAPSHOT_ARTICLES,
        );
    }

    /**
     * @return array<string, mixed>|null
     */
    public function detail(string $slug): ?array
    {
        $edition = $this->activeEdition();

        if (Schema::hasTable('news_articles')) {
            $article = NewsArticle::query()
                ->with('coverMedia')
                ->where('slug', $slug)
                ->first();

            if ($article !== null) {
                return $this->isPublic($article, $edition)
                    ? $this->presentDetail($article)
                    : null;
            }
        }

        $snapshot = collect(self::SNAPSHOT_ARTICLES)->first(
            static fn (array $article): bool => $article['slug'] === $slug,
        );

        return $snapshot === null ? null : $this->presentSnapshotDetail($snapshot);
    }

    /**
     * @return array{title: string, description: string, image: string, date: string, href: string}
     */
    private function presentCard(NewsArticle $article): array
    {
        return [
            'title' => $article->title,
            'description' => $article->excerpt ?? 'Informasi terbaru dari PAMOKA Garut.',
            'image' => $article->coverMedia?->url ?? '/finalis/hero.webp',
            'date' => $this->formatDate($article->published_at),
            'href' => $article->source_url ?? "/berita/{$article->slug}",
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function presentDetail(NewsArticle $article): array
    {
        $description = $article->excerpt ?? 'Informasi terbaru dari PAMOKA Garut.';

        return [
            'meta' => [
                'title' => "{$article->title} | Berita | MOKA Garut",
                'description' => $description,
            ],
            'article' => [
                'slug' => $article->slug,
                'title' => $article->title,
                'description' => $description,
                'image' => $article->coverMedia?->url ?? '/finalis/hero.webp',
                'imageAlt' => $article->coverMedia?->alt ?? $article->title,
                'date' => $this->formatDate($article->published_at),
                'kind' => $article->kind,
                'sourceUrl' => $article->source_url,
                'body' => $article->body,
                'bodyJson' => $article->body_json,
                'sourceLabel' => $this->sourceLabel($article->kind),
            ],
            'emptyState' => 'Isi artikel sedang disiapkan.',
        ];
    }

    /**
     * @param  array{slug: string, title: string, description: string, image: string, date: string, href: string, kind: string, body: ?string, bodyJson: mixed}  $article
     * @return array<string, mixed>
     */
    private function presentSnapshotDetail(array $article): array
    {
        return [
            'meta' => [
                'title' => "{$article['title']} | Berita | MOKA Garut",
                'description' => $article['description'],
            ],
            'article' => [
                'slug' => $article['slug'],
                'title' => $article['title'],
                'description' => $article['description'],
                'image' => $article['image'],
                'imageAlt' => $article['title'],
                'date' => $article['date'],
                'kind' => $article['kind'],
                'sourceUrl' => $article['href'],
                'body' => $article['body'],
                'bodyJson' => $article['bodyJson'],
                'sourceLabel' => $this->sourceLabel($article['kind']),
            ],
            'emptyState' => 'Isi artikel sedang disiapkan.',
        ];
    }

    private function isPublic(NewsArticle $article, ?Edition $edition): bool
    {
        if ($article->status !== 'published' || $article->published_at === null) {
            return false;
        }

        return $article->edition_id === null
            || ($edition !== null && $article->edition_id === $edition->id);
    }

    private function sourceLabel(string $kind): string
    {
        return match ($kind) {
            'file' => 'Buka dokumen sumber',
            'external' => 'Buka sumber berita',
            default => 'Buka berita',
        };
    }

    private function activeEdition(): ?Edition
    {
        return Edition::query()
            ->where('lifecycle', 'active')
            ->orderByDesc('year')
            ->orderByDesc('id')
            ->first();
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
